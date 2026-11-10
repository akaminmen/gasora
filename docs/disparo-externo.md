# Disparo externo de la ingesta

Cómo lanzar el workflow «Ingesta y despliegue» (`deploy.yml`) desde fuera de GitHub, para no depender solo del `cron` de GitHub Actions. Recoge lo que se montó (un Cloudflare Worker, fuera del repositorio) y otras dos opciones por si hiciera falta. Se usa a la vez que el `cron` del workflow, que queda como respaldo; no se pisan (ver «Solapes y ejecuciones en cola»).

## Por qué

El `cron` de GitHub es de «mejor esfuerzo». Su documentación avisa de que el `schedule` puede retrasarse con mucha carga (el comienzo de cada hora es de alta carga) y de que se pueden descartar ejecuciones en cola; además, en repositorios públicos los workflows programados se desactivan tras 60 días sin actividad en el repositorio. En este repositorio, las ejecuciones programadas observadas fueron una cada 5–6 horas de media, no cada 30 minutos.

Una llamada a la API de GitHub (`workflow_dispatch`) lanza el workflow cuando se quiere, con la hora exacta que se elija.

## La llamada a la API

```http
POST https://api.github.com/repos/akaminmen/gasora/actions/workflows/deploy.yml/dispatches
Accept: application/vnd.github+json
Authorization: Bearer <TOKEN>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json

{"ref": "main"}
```

- Respuesta correcta: `204 No Content` (con versiones recientes de la API puede ser `200` con el identificador de la ejecución). Cualquier otro código es un error (`401`/`403`: token o permiso; `404`: repositorio o nombre del workflow; `422`: el workflow no tiene `workflow_dispatch` o la rama no existe).
- `ref` es la rama sobre la que se ejecuta: `main`. El workflow ya tiene `workflow_dispatch:` entre sus disparadores.
- Con `curl`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -d '{"ref":"main"}' \
  https://api.github.com/repos/akaminmen/gasora/actions/workflows/deploy.yml/dispatches
```

## El token de GitHub (acceso mínimo)

Un token de acceso personal **de grano fino** (fine-grained), que solo puede hacer una cosa en un repositorio:

1. GitHub → tu foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `gasora-disparo-ingesta`. **Expiration:** una fecha cercana (por ejemplo 90 días; no marques «sin caducidad»). Apunta en tu calendario renovarlo.
3. **Resource owner:** tu cuenta. **Repository access:** **Only select repositories** → solo `akaminmen/gasora`.
4. **Permissions → Repository permissions → Actions: Read and write.** Ningún otro permiso (`Metadata: Read-only` se añade solo y es obligatorio).
5. **Generate token** y copia el valor (empieza por `github_pat_`). Solo se muestra una vez.

Con eso, el token puede lanzar y consultar workflows de ese repositorio; no puede leer ni escribir el código, ni tocar otros repositorios.

Reglas:

- **El token nunca va en el repositorio**: ni en el código, ni en los workflows, ni en la documentación, ni en issues, ni en capturas. Se guarda solo en el sitio que lo usa (archivo con permisos restringidos, secreto del Worker o campo cifrado del servicio).
- Si se filtra o dejas de usarlo: GitHub → Settings → Developer settings → Fine-grained tokens → **Delete**.
- Comprueba que funciona sin lanzar nada raro: la llamada de arriba debe devolver `204` y aparecer una ejecución «workflow_dispatch» en la pestaña Actions.

## Opción 1: cron en una máquina virtual Linux

Cualquier VM o servidor pequeño que esté siempre encendido (un VPS barato, un Raspberry Pi, una máquina de un proveedor con capa gratuita).

1. Pon la máquina en hora de Madrid, para que `cron` use el horario de verano e invierno: `sudo timedatectl set-timezone Europe/Madrid`.
2. Guarda el token en un archivo que solo lea tu usuario:

```bash
sudo install -d -m 700 -o "$USER" ~/.config/gasora
printf '%s' 'github_pat_...' > ~/.config/gasora/token     # pega aquí tu token
chmod 600 ~/.config/gasora/token
```

3. Script de ejemplo `~/bin/gasora-dispatch.sh` (`chmod +x`):

```bash
#!/usr/bin/env bash
# Lanza el workflow «Ingesta y despliegue» de Gasora. El token se lee de un archivo local.
set -euo pipefail
TOKEN_FILE="${GASORA_TOKEN_FILE:-$HOME/.config/gasora/token}"
REPO="akaminmen/gasora"
WORKFLOW="deploy.yml"

status=$(curl -sS -o /dev/null -w '%{http_code}' \
  --retry 3 --retry-delay 10 --max-time 30 \
  -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -d '{"ref":"main"}' \
  "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches")

echo "$(date -Is) dispatch -> HTTP ${status}"
case "$status" in 200|204) exit 0 ;; *) exit 1 ;; esac
```

4. `crontab -e` (la hora es la de Madrid): cada media hora en los minutos 13 y 43, y cada 10 minutos de 23:30 a 01:30. Evita los minutos 0 y 30.

```cron
MAILTO=""
# Base: cada media hora
13,43 * * * *            $HOME/bin/gasora-dispatch.sh >> $HOME/gasora-dispatch.log 2>&1
# Alrededor de la medianoche de Madrid: cada 10 minutos de 23:33 a 01:23
33,43,53 23 * * *        $HOME/bin/gasora-dispatch.sh >> $HOME/gasora-dispatch.log 2>&1
3,13,23,33,43,53 0 * * * $HOME/bin/gasora-dispatch.sh >> $HOME/gasora-dispatch.log 2>&1
3,13,23 1 * * *          $HOME/bin/gasora-dispatch.sh >> $HOME/gasora-dispatch.log 2>&1
```

Los minutos 13 y 43 de las horas 23, 0 y 1 coinciden con la ventana densa: sobra una de las dos llamadas, sin consecuencias (ver «Solapes»). Para rotar el registro, `logrotate` o `truncate -s 0` mensual.

## Opción 2 (la que está montada): Cloudflare Worker con Cron Triggers

Un Worker de Cloudflare, **fuera de este repositorio** (su código, su cuenta y su dirección `workers.dev` no se publican aquí), lanza «Ingesta y despliegue» con `workflow_dispatch` sobre `main`.

**Dos relojes** (Cron Triggers de Cloudflare, siempre en UTC):

| Reloj               | Cuándo (UTC)                     | Para qué                                                                                                                                    |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `*/5 21-23,0 * * *` | cada 5 minutos de 21:00 a 00:55  | Cubre la medianoche de Madrid en invierno (22:00–01:55 locales) y en verano (23:00–02:55 locales) sin tener que cambiar nada con el horario |
| `*/15 1-20 * * *`   | cada 15 minutos de 01:00 a 20:45 | El resto del día                                                                                                                            |

Eso son 48 llamadas en la franja de 5 minutos más 80 en la de 15 = **128 disparos al día**. Con el comportamiento de «Ingesta y despliegue» (compara con lo publicado y omite compilar y desplegar si los datos son iguales), casi todos terminan en verde sin desplegar nada.

**Qué hace el Worker** (esquema; el código real no está en el repositorio):

```ts
export interface Env {
  GITHUB_TOKEN: string; // secreto del Worker, nunca en el código ni en wrangler.toml
}

const API_URL =
  'https://api.github.com/repos/akaminmen/gasora/actions/workflows/deploy.yml/dispatches';

async function dispatch(token: string): Promise<void> {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'gasora-disparo', // GitHub exige un User-Agent
        },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (response.status === 204 || response.status === 200) return;
      lastError = `HTTP ${response.status}`;
      // Solo se reintenta lo que puede arreglarse solo: 429 y errores del servidor
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = String(error); // error de red: se reintenta
    }
  }
  // Queda en los registros del Worker (wrangler tail / panel) y en sus métricas de errores
  throw new Error(`No se pudo lanzar la ingesta: ${lastError}`);
}

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await dispatch(env.GITHUB_TOKEN);
  },
};
```

- **Reintentos:** hasta 3 intentos con espera de 2 s y 4 s ante errores de red, `429` y `5xx`. Un `401`, `403`, `404` o `422` no se reintentan (no se arreglan solos: ver «Si falla»).
- **Token:** de grano fino, limitado a `akaminmen/gasora`, con el permiso **Actions: Read and write** y fecha de caducidad (ver «El token de GitHub»). Se guarda como secreto del Worker (`npx wrangler secret put GITHUB_TOKEN`, o el panel de Cloudflare: Worker → Settings → Variables and Secrets → Secret). No va en el repositorio, en `wrangler.toml` ni en los registros.
- **Triggers** en `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 21-23,0 * * *", "*/15 1-20 * * *"]
```

### Cómo renovar el token cuando caduque

GitHub avisa por correo antes de que caduque un token personal. Apunta además la fecha en tu calendario (una semana antes). Sin cortes:

1. GitHub → Settings → Developer settings → Fine-grained tokens → **Generate new token** con los mismos ajustes (solo `akaminmen/gasora`, **Actions: Read and write**, nueva caducidad).
2. Sustituye el secreto del Worker: `npx wrangler secret put GITHUB_TOKEN` (pega el valor nuevo) o el panel de Cloudflare. El Worker usa el valor nuevo en la siguiente ejecución, sin volver a desplegar.
3. Comprueba que funciona (ver «Operación»).
4. Borra el token viejo en GitHub (**Delete**).

## Opción 3: servicio externo de tareas programadas

Servicios web gratuitos que lanzan una petición HTTP periódica (por ejemplo cron-job.org u otros equivalentes). Es la opción que menos mantenimiento pide, pero el token queda guardado en un tercero: por eso el token tiene que ser el mínimo de arriba, con caducidad, y no usarse para nada más.

1. Crea una cuenta y una tarea nueva.
2. **URL:** `https://api.github.com/repos/akaminmen/gasora/actions/workflows/deploy.yml/dispatches`, **método** `POST`.
3. **Cabeceras:** `Accept: application/vnd.github+json`, `Authorization: Bearer <TOKEN>`, `X-GitHub-Api-Version: 2022-11-28`, `Content-Type: application/json`. Algunos servicios no envían `User-Agent`, que GitHub exige: si falla con `403`, añade `User-Agent: gasora-disparo`.
4. **Cuerpo:** `{"ref":"main"}`.
5. **Horario:** elige la zona **Europe/Madrid** y crea dos tareas: una «en los minutos 13 y 43 de cada hora» y otra «cada 10 minutos, de 23:30 a 01:30» (en los minutos 3, 13, 23, 33, 43 y 53). Evita los minutos 0 y 30.
6. **Éxito esperado:** `204` (o `200`). Activa el aviso por correo si la tarea falla varias veces seguidas.

## Solapes y ejecuciones en cola

`deploy.yml` tiene `concurrency: { group: pages, cancel-in-progress: false }`. Según la documentación de GitHub, con ese ajuste:

- Solo hay **una ejecución en curso** y **una en espera**. Si llega otra mientras una espera, **la que esperaba se cancela** (queda la más reciente). El despliegue en curso nunca se cancela.
- No se pierde nada importante: cualquier ejecución nueva (programada, `push` o disparo externo) hace checkout de la **última** versión de `main`, descarga los datos más recientes y despliega todo. La que se cancela habría hecho lo mismo, con datos o código más viejos.
- Por tanto, los disparos duplicados (el `cron` de GitHub y los externos a la vez) son inofensivos: como mucho una ejecución se cancela en la cola.
- **Sin cambios, no se despliega.** Las ejecuciones `schedule` y `workflow_dispatch` comparan lo ingerido con lo publicado y, si es igual (y el código publicado es el de la ejecución), omiten las pruebas, la compilación y el despliegue: terminan en verde con el resumen «sin cambios, no se despliega». Los `push`, una entrada manual `force=true` y cualquier duda (no se pudo leer lo publicado) siempre despliegan. Para forzar un despliegue a mano: pestaña Actions → «Ingesta y despliegue» → Run workflow → marca `force`; o por API, con `{"ref":"main","inputs":{"force":"true"}}`.

## Operación: saber si el disparador funciona y qué hacer si falla

**Cómo saber que funciona**

- Pestaña Actions → «Ingesta y despliegue»: ejecuciones con evento `workflow_dispatch` cada 15 minutos (cada 5 de 21:00 a 00:55 UTC), la mayoría con el resumen «sin cambios, no se despliega».
- Por línea de órdenes (solo lectura), las ejecuciones de las últimas 24 h por evento:

```powershell
gh api "repos/akaminmen/gasora/actions/workflows/deploy.yml/runs?per_page=100&event=workflow_dispatch" `
  --jq '.workflow_runs[] | [.created_at, .conclusion] | @tsv' | Select-Object -First 140
```

Esperado: unas 128 en 24 h, con `success` y sin huecos de más de 15 minutos (de más de 5 en la franja nocturna).

- La web sigue al día: abre `https://gasora.es/data/meta.json` y comprueba que `sourceDate` no es de hace horas cuando se sabe que los precios han cambiado. Recuerda que, si no hay cambios, la fecha no avanza (es la de la última publicación).
- En el panel de Cloudflare: Worker → Metrics (peticiones y errores) y Logs.

**Si falla**

| Síntoma                                                                      | Causa probable                                                                                      | Qué hacer                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Deja de haber ejecuciones `workflow_dispatch`; el Worker registra `HTTP 401` | Token caducado o revocado                                                                           | Renovar el token (arriba)                                                           |
| `HTTP 403` o `404`                                                           | Al token le falta el permiso Actions (escritura) o ya no tiene acceso al repositorio                | Revisar los permisos del token; recrearlo                                           |
| `HTTP 422`                                                                   | El workflow no tiene `workflow_dispatch`, el nombre del archivo cambió o la rama no existe          | Comprobar `deploy.yml` y la rama `main`                                             |
| Ejecuciones en rojo                                                          | Falla la ingesta (Ministerio caído), los datos no son válidos o una prueba                          | Abrir la ejecución; con datos inválidos la web sigue con el último despliegue bueno |
| El Worker no se ejecuta                                                      | Cron Triggers borrados o Worker deshabilitado, límite del plan de Cloudflare                        | Revisar `wrangler.toml` y el panel; volver a desplegar (`npx wrangler deploy`)      |
| Todo parece bien pero los precios no avanzan                                 | El Ministerio no ha publicado cambios, o la caché de Pages muestra una respuesta vieja unos minutos | Esperar; comparar con la API del Ministerio                                         |

Mientras el disparador esté caído, el `cron` de `deploy.yml` sigue funcionando como respaldo (con los retrasos y huecos habituales de GitHub). Para probar a mano: la llamada de «La llamada a la API» debe devolver `204`.

**Sobre el límite de 60 días de GitHub.** La documentación actual dice que, en un repositorio público, los workflows programados se desactivan automáticamente cuando no ha habido actividad en el repositorio durante 60 días. No define «actividad», no dice si una ejecución (programada o por `workflow_dispatch`) cuenta y no habla de ningún aviso previo. Re-habilitar: pestaña Actions → el workflow → «Enable workflow», o `gh workflow enable deploy.yml`. Importa menos mientras el disparador externo funcione (no depende del `cron`), pero conviene saberlo: ver la propuesta en `docs/STATUS.md`.
