# Operación: runbook de Gasora

Qué mirar, qué hacer cuando algo falla y cómo mantener el proyecto. Sin secretos ni datos personales: las direcciones y comandos son los del repositorio público (`akaminmen/gasora`, `https://gasora.es/`). Los comandos están en PowerShell salvo que se diga otra cosa. Documentos relacionados: [`disparo-externo.md`](disparo-externo.md) (Worker y token), [ADR 016](decisions/016-omitir-despliegue-y-aviso-de-precios-nuevos.md), [ADR 017](decisions/017-dominio-propio-gasora-es.md) y [ADR 019](decisions/019-rutas-con-estado-200-ci-robusto-y-avisos.md).

## Cómo funciona (una línea)

El Worker de Cloudflare lanza «Ingesta y despliegue» (`deploy.yml`) cada 15 min (cada 5 de noche). El workflow descarga los datos del Ministerio, los valida, los compara con lo publicado y, si hay cambios, compila y despliega a GitHub Pages; después verifica la web. El `cron` de GitHub es el respaldo (≈ 1 ejecución cada 3–4 h en la práctica).

## Revisión mensual (5 minutos)

```powershell
gh api repos/akaminmen/gasora/actions/workflows/deploy.yml --jq .state          # debe ser «active»
gh run list --workflow deploy.yml --limit 5                                      # últimas ejecuciones en verde
gh api repos/akaminmen/gasora/pages --jq '{cname,https_enforced,cert:.https_certificate.expires_at}'
Invoke-RestMethod https://gasora.es/data/meta.json | Select-Object generatedAt, sourceDate, stationCount
```

- `state` distinto de `active`: ver «El workflow está desactivado».
- `https_enforced` debe ser `true`; el certificado lo renueva GitHub (caduca el 07/02/2027 en la última medición).
- `sourceDate` de hace más de 6 h: ver «Los datos están viejos».
- Fecha de caducidad del token del Worker: la que apuntaste en el calendario (ver `disparo-externo.md`).

## Incidentes

| Síntoma                                                                 | Causa probable                                                                   | Qué hacer                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Correo «Datos del Ministerio sin actualizar» (trabajo `data-freshness`) | La API del Ministerio falla o cambió; la web sigue con el último dato bueno      | Ver «Los datos están viejos»                                                                                                                    |
| `meta.json` publicado con `sourceDate` de hace horas                    | Lo anterior, o el disparador no lanza ejecuciones                                | Mira Actions: si hay ejecuciones recientes en verde, es el Ministerio; si no, el Worker/token                                                   |
| Ejecución roja en «Ingesta» (`npm run ingest` o `check:data`)           | No hay dato válido ni de reserva; formato nuevo; la respuesta no pasa el esquema | Abre el log. Si es el formato, hay que adaptar `scripts/normalize.ts`/`ministry.ts`. La web **no se despliega** y sigue con lo último publicado |
| Ejecución roja solo en `verify-site`                                    | Nunca debería ser roja (es un aviso)                                             | Si aparece, es un fallo del propio paso (GitHub): revisa el log                                                                                 |
| Aviso amarillo en `verify-site` / resumen «⚠ La web publicada no pasa»  | La CDN tarda, o una ruta del sitemap no responde 200, o el commit no coincide    | Ejecuta `npm run verify:site` en local pasados 5 min. Si persiste, restaura el despliegue anterior (ver abajo)                                  |
| No hay ejecuciones `workflow_dispatch` nuevas (solo `schedule`)         | Token caducado o revocado (HTTP 401 en los registros del Worker), Worker caído   | «Renovar el token»                                                                                                                              |
| Web en blanco tras tocar el dominio o la base                           | Base `/gasora/` con dominio propio (los ficheros dan 404)                        | `npm run verify:site`; ver ADR 017 y «Revertir el dominio»                                                                                      |
| `startup_failure` en una ejecución                                      | Fallo transitorio de GitHub (visto el 11/11/2026)                                | Nada: la siguiente ejecución lo supera. Si se repite durante horas, comprueba <https://www.githubstatus.com/>                                   |
| CI en rojo con «Failed to fetch … Temporary failure resolving»          | Red del runner                                                                   | Re-ejecuta («Re-run failed jobs»). El CI ya reintenta 3 veces y tiene límite de tiempo                                                          |
| CI en rojo en un test que pasa en local                                 | Prueba inestable (ver «flaky» en el informe) o regresión real                    | Descarga el artefacto `resultados-e2e` (traza) y compara; ver ADR 019                                                                           |

### Los datos están viejos

1. Mira el log del último paso «Ingesta» en la ejecución (Actions → «Ingesta y despliegue» → resumen «Ingesta de datos»): si dice «Se conserva el dataset anterior», la causa está ahí (HTTP 403/503, `ECONNRESET`, respuesta que no supera la validación o caída de estaciones superior al umbral).
2. Prueba la descarga a mano con la propia ingesta (la API rechaza a los clientes que no parecen un navegador, así que un `Invoke-WebRequest` sencillo no vale): `npm run ingest -- --out $env:TEMP\gasora-ingest` imprime el informe o el error (HTTP, tiempo agotado, validación). Las direcciones y cabeceras están en `scripts/ministry.ts` (alterna dos dominios).
3. Si es una caída del Ministerio, no hay nada que arreglar: la web seguirá mostrando el último dato con su fecha («consultados el…»). Si es un cambio de formato, ver la tabla.
4. El aviso por correo llega una vez al pasar de 6 h y luego cada 24 h. Se puede cambiar con `FRESHNESS_ALERT_HOURS` en el paso `freshness` de `deploy.yml`.

### El workflow está desactivado

GitHub desactiva los workflows programados de un repositorio público tras 60 días sin actividad (la documentación no define «actividad»). Reactivar:

```powershell
gh workflow enable deploy.yml
gh workflow run deploy.yml -f force=true   # lanza una ejecución y despliega aunque no haya cambios
```

Para que el Worker lo haga solo, aplica la propuesta de `disparo-externo.md` («Autorreparación diaria»).

## Restaurar un despliegue anterior

GitHub Pages no tiene «deshacer». Dos caminos:

- **Volver al código anterior (recomendado).** El despliegue se hace en cada `push` a `main` y el siguiente despliegue sirve el código y los datos actuales:

```powershell
git switch main; git pull
git log --oneline -10                      # localiza el commit malo
git revert <sha-del-commit-malo>           # crea un commit nuevo que lo deshace (no reescribe la historia)
git push
```

Se despliega solo (un `push` siempre despliega). Comprueba con `npm run verify:site`.

- **Relanzar una ejecución antigua.** Actions → «Ingesta y despliegue» → una ejecución anterior en verde → «Re-run all jobs». Despliega **el código de ese commit** con los **datos de ahora**. Sirve para volver a una versión concreta del código sin tocar `main`, pero la siguiente ejecución normal volverá a desplegar `main`.

Nunca uses `git reset --hard` ni `push --force` sobre `main` para esto.

## Revertir el dominio

Pasos completos en [ADR 017](decisions/017-dominio-propio-gasora-es.md) («Cómo se revierte»). Resumen: quitar el dominio personalizado en Settings → Pages; en `deploy.yml` poner `GASORA_BASE: /${{ github.event.repository.name }}/`, `GASORA_SITE`, `GASORA_PREVIOUS_URL` y `SITE_URL` con la dirección de `github.io`; volver a la base `/gasora/` en los tests y scripts de `build:e2e:base`; desplegar. **Se pierden otra vez** favoritos, ajustes y la PWA instalada (otro origen). El DNS del registrador no hace falta tocarlo, pero conviene dejarlo documentado si se retira el dominio.

## Renovar el token del Worker

Pasos en [`disparo-externo.md`](disparo-externo.md) («Cómo renovar el token cuando caduque»): generar un token de grano fino (solo `akaminmen/gasora`, **Actions: Read and write**, caducidad nueva), sustituir el secreto del Worker (`npx wrangler secret put GITHUB_TOKEN`), comprobar que aparecen ejecuciones `workflow_dispatch` y borrar el token viejo. Qué falla primero si caduca: los disparos del Worker (401) y, con el tiempo, la frescura de los datos (solo quedan las ejecuciones del `cron` de GitHub, ≈ cada 3–4 h) hasta que salta el aviso de 6 h. No pongas el token en el repositorio, en issues ni en capturas.

## Actualizar dependencias y licencias

1. `gh pr list` muestra las PR de Dependabot (semanales).
2. Para cada PR, **sin rotura**:

```powershell
cd C:\dev\gasora
git switch main; git pull
gh pr comment <N> --body "@dependabot rebase"     # la rebasa sobre main (corrige PR creadas antes de un arreglo)
gh pr checks <N> --watch                           # espera al CI en verde (≈ 20–30 min)
```

3. Si el CI queda en verde, fusiona: `gh pr merge <N> --merge --delete-branch`. Después `git pull`.
4. Si el cambio es de una **dependencia de producción** (`dependencies`), regenera los avisos de licencia, para que el archivo publicado lleve la versión nueva:

```powershell
git switch main; git pull; npm ci
npm run licenses        # reescribe public/licencias-de-terceros.txt e imprime la tabla Markdown
npm test                # licenses.test.ts debe pasar
git add public/licencias-de-terceros.txt
git commit -m "chore: regenerar licencias de terceros"
git push
```

La tabla de `docs/licencias-y-atribuciones.md` se actualiza a mano pegando la que imprime el comando (opcional: solo cambia las versiones). 5. `npm audit --omit=dev` debe seguir en 0 (dependencias de producción). El resto del audit (herramientas de desarrollo) se revisa sin prisa. 6. **TypeScript:** fijado en 6.0.x mientras `typescript-eslint` exija `typescript <6.1.0` (ADR 006); la regla de `dependabot.yml` ignora las mayores. Comprueba el motivo con `npm view typescript-eslint@latest peerDependencies.typescript`. 7. Tras fusionar y desplegar: `npm run verify:site` y una ojeada a `https://gasora.es/acerca` (versión visible).

### Las cinco PR abiertas el 12/11/2026 (comandos exactos)

Antes, sube a `main` este conjunto de cambios (incluye el arreglo de `licenses.test.ts`) y espera al CI. Después, **de una en una** y en este orden (de menor a mayor riesgo):

```powershell
cd C:\dev\gasora
git switch main; git pull

# #7 @playwright/test 1.64.1 → 1.65.0 (herramienta de pruebas; puede cambiar la versión de los navegadores)
gh pr comment 7 --body "@dependabot rebase"; gh pr checks 7 --watch
gh pr merge 7 --merge --delete-branch; git pull

# #5 tailwindcss 4.3.3 → 4.3.5 (y @tailwindcss/vite si Dependabot lo propone aparte)
gh pr comment 5 --body "@dependabot rebase"; gh pr checks 5 --watch
gh pr merge 5 --merge --delete-branch; git pull

# #6 @vitejs/plugin-react 6.1.2 → 6.2.1
gh pr comment 6 --body "@dependabot rebase"; gh pr checks 6 --watch
gh pr merge 6 --merge --delete-branch; git pull

# #9 vitest 5.0.5 → 5.1.0
gh pr comment 9 --body "@dependabot rebase"; gh pr checks 9 --watch
gh pr merge 9 --merge --delete-branch; git pull
```

La **#8 (zustand 5.0.16 → 5.1.0, dependencia de producción)** fallaba en `licenses.test.ts` porque el texto de licencias lleva la versión. Con el test ya corregido basta rebasarla; pero como es de producción conviene regenerar el archivo publicado, así que:

```powershell
gh pr comment 8 --body "@dependabot rebase"; gh pr checks 8 --watch   # debe quedar en verde
gh pr merge 8 --merge --delete-branch; git pull
npm ci
npm run licenses | Out-Null          # reescribe public/licencias-de-terceros.txt con zustand 5.1.0
npm test                              # debe pasar
git add public/licencias-de-terceros.txt
git commit -m "chore: regenerar licencias de terceros (zustand 5.1.0)"
git push
```

Si una PR se queda en rojo después de rebasarla, **no la fuerces**: abre el log (`gh run view --log-failed`), y si es un test de verdad, deja la PR sin fusionar (`gh pr close <N>`; Dependabot propondrá la siguiente versión) y apúntalo. Si un `rebase` de Dependabot tarda, espera unos minutos y repite `gh pr checks`.

## Comprobar la web publicada

```powershell
npm run verify:site                       # recursos, manifiesto, direcciones del sitemap (200 y HTML), version.json
$env:EXPECT_SHA = (git rev-parse HEAD); npm run verify:site   # además exige que lo publicado sea ese commit
```

## Buscadores (Google y Bing)

Contexto y límites en el [ADR 020](decisions/020-favicon-texto-inicial-y-metadatos-para-buscadores.md). Lo que ven los buscadores **no se puede comprobar desde el repositorio**: se mira en sus herramientas.

- **Google Search Console** (propiedad de dominio `gasora.es`, verificada por DNS): «Inspección de URL» → `https://gasora.es/` → «Probar URL publicada» (debe decir «La URL está disponible para Google» y mostrar el HTML con el texto) → «Solicitar indexación». Sitemaps → `https://gasora.es/sitemap.xml` (5 direcciones). El favicon se refresca aparte y puede tardar **días o semanas**: no hay botón; comprueba <https://gasora.es/favicon.ico> y busca `site:gasora.es`.
- **Bing Webmaster Tools:** añade el sitio (se puede importar desde Search Console), envía el sitemap y usa «Enviar direcciones URL» con las cinco pantallas. «Discovered but not crawled» significa que conoce la dirección y aún no la ha rastreado: suele resolverse con el tiempo.
- **Comprobaciones tras un despliegue** (`npm run verify:site` ya las hace): las cinco direcciones del sitemap dan 200, el `<head>` declara los cinco iconos y el manifiesto, `robots.txt` permite todo.
- **Datos estructurados:** <https://validator.schema.org/> (Fetch URL) y <https://search.google.com/test/rich-results>; el segundo no mostrará resultado enriquecido de aplicación (falta `aggregateRating`/`review`, que no se inventan).

## Medir el rendimiento

Lighthouse móvil con los ajustes por defecto: `npx lighthouse https://gasora.es/ --form-factor=mobile --screenEmulation.mobile --only-categories=performance,accessibility,best-practices,seo`. **No uses `--preset=perf`** para comparar con el README (da otras cifras: perfil reducido). Varía ±3 puntos entre ejecuciones: repite 2–3 veces. El README fija el método y las cifras.

## Qué avisa y a quién

- **Fallo del CI** o de una ejecución de «Ingesta y despliegue» que lanzas tú (o el token): correo de GitHub, si en Settings → Notifications → Actions está activado (conviene «solo fallos»). Las ejecuciones del `cron` avisan a quien creó el workflow o modificó por última vez el `cron` (documentación de GitHub, 16/11/2026); las lanzadas por `workflow_dispatch` con el token deberían avisar al dueño del token (sin verificar).
- **Datos viejos:** trabajo `data-freshness` (ver arriba).
- **Token a punto de caducar:** correo de GitHub; además tu calendario.
- **Certificado del dominio:** lo renueva GitHub; revísalo en la revisión mensual.
