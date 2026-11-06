# Disparo externo de la ingesta

Cómo lanzar el workflow «Ingesta y despliegue» (`deploy.yml`) desde fuera de GitHub, para no depender solo del `cron` de GitHub Actions. Este documento no cambia nada por sí solo: es una guía para tres opciones. Se pueden usar a la vez que el `cron` del workflow; no se pisan (ver «Solapes»).

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

## Opción 2: Cloudflare Worker con Cron Trigger

Un Worker gratuito que se ejecuta con un único Cron Trigger y decide si llamar a GitHub según la hora de Madrid. Los Cron Triggers de Cloudflare van en UTC, por eso la decisión (y el horario de verano) se resuelve dentro del Worker.

1. Instala Wrangler (`npm create cloudflare@latest gasora-disparo`, plantilla «Worker only», TypeScript) **fuera de este repositorio**.
2. `wrangler.toml`:

```toml
name = "gasora-disparo"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[triggers]
# Cada 10 minutos, en los minutos 3, 13, 23, 33, 43 y 53 (UTC). El Worker decide si llama.
crons = ["3-59/10 * * * *"]
```

3. Guarda el token como secreto (no va en `wrangler.toml`): `npx wrangler secret put GITHUB_TOKEN`.
4. `src/index.ts`:

```ts
export interface Env {
  GITHUB_TOKEN: string;
}

const API_URL =
  'https://api.github.com/repos/akaminmen/gasora/actions/workflows/deploy.yml/dispatches';

/** Hora y minuto en Madrid (resuelve horario de verano e invierno). */
function madrid(date: Date): { minutes: number; minute: number } {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return { minutes: hour * 60 + minute, minute };
}

/** Entre las 23:30 y la 01:30 de Madrid, en cada paso; el resto del día, solo en los minutos 13 y 43. */
function shouldDispatch(date: Date): boolean {
  const { minutes, minute } = madrid(date);
  const midnightWindow = minutes >= 23 * 60 + 30 || minutes <= 60 + 30;
  return midnightWindow || minute === 13 || minute === 43;
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (!shouldDispatch(new Date(controller.scheduledTime))) return;
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub exige un User-Agent en la API
        'User-Agent': 'gasora-disparo',
      },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (response.status !== 204 && response.status !== 200) {
      // Queda en los registros del Worker (wrangler tail) y en la pestaña de métricas
      throw new Error(`GitHub respondió ${response.status}: ${await response.text()}`);
    }
  },
};
```

5. `npx wrangler deploy`. Para probar sin esperar: `npx wrangler dev --test-scheduled` y `curl "http://localhost:8787/__scheduled?cron=3-59/10+*+*+*+*"`. Revisa en el panel de Cloudflare los límites de tu plan para Cron Triggers y peticiones.

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

## Qué comprobar tras activarlo

- En la pestaña Actions, ejecuciones con evento `workflow_dispatch` a las horas esperadas.
- Que los datos se refrescan: la fecha «consultados el …» de la web avanza.
- Que el token no caduca sin avisar: apunta la fecha de caducidad.
- Sobre el límite de 60 días: no está verificado si una ejecución lanzada con `workflow_dispatch` cuenta como actividad del repositorio. Con un disparo externo, el `cron` de GitHub no es imprescindible: aunque se desactivara, el disparo seguiría funcionando.
