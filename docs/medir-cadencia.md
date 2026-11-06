# Medir a qué horas cambian los precios

`npm run cadence:watch` toma una foto de los precios del Ministerio cada 15 minutos durante unas 26 horas y, en cada una, cuenta cuántas estaciones han cambiado de precio respecto a la anterior. Sirve para comprobar si los precios cambian de verdad en un momento concreto (por ejemplo, alrededor de la medianoche de Madrid) y, con ello, decidir a qué horas conviene ejecutar la ingesta más a menudo.

El resultado se guarda en `docs/cadencia-horaria.json` (se reescribe tras cada medición, así que puedes abrirlo mientras corre) y contiene, por medición, la hora de Madrid, los minutos desde la anterior, el número de estaciones con algún precio distinto, los cambios por combustible, las estaciones nuevas y retiradas y el `priceHash`; al final, un resumen por hora de Madrid, la hora con más cambios y el total de la ventana 23:30–01:30.

## Cómo ejecutarlo

Necesita Node.js 22 o superior, haber hecho `npm ci` y salida a internet. Debe estar corriendo **sin interrupciones durante 26 horas** y debe incluir la medianoche de Madrid: empieza a media tarde (por ejemplo, a las 17:00) y termina a media tarde del día siguiente.

### Windows (PowerShell)

```powershell
cd C:\dev\gasora
npm run cadence:watch
```

**El PC no puede suspenderse ni hibernar** mientras mide (si lo hace, se pierden las mediciones de ese tramo y el resumen sale incompleto):

- Ajustes → Sistema → Inicio/apagado y suspensión: «Suspender» → **Nunca** (en pantalla y en suspensión, también con batería si es un portátil conectado).
- O desde PowerShell, mientras dure la medición: `powercfg /change standby-timeout-ac 0` (y al terminar, devuelve el valor que tuvieras, p. ej. `powercfg /change standby-timeout-ac 30`).
- No cierres la ventana de PowerShell ni cierres sesión. Si el portátil tiene tapa, que no se cierre o que cerrarla no suspenda.
- Si se interrumpe, vuelve a lanzar `npm run cadence:watch`: continúa con la última foto guardada (`.cache/cadence-watch-prices.json`) y añade mediciones al mismo archivo. El hueco se verá como una comparación con muchos minutos de diferencia.

### Linux (servidor o VM)

```bash
cd ~/gasora
nohup npm run cadence:watch > cadence-watch.log 2>&1 &
tail -f cadence-watch.log
```

En una máquina que no se suspende (un servidor), eso basta; con `tmux` o `screen` es igual. Si es un equipo de sobremesa con suspensión automática: `sudo systemd-inhibit --what=sleep --who=gasora --why="medir cadencia" npm run cadence:watch`.

## Opciones

```powershell
npm run cadence:watch -- --interval 10     # una foto cada 10 minutos (mínimo 5)
npm run cadence:watch -- --hours 12        # durante 12 horas en lugar de 26
npm run cadence:watch -- --once            # una sola foto y salir (para probar)
```

## Límites de uso

Una petición cada 15 minutos son unas 104 en 26 horas al servicio REST del Ministerio. Es el mismo servicio y el mismo cliente (cabeceras, dominios alternativos y reintentos moderados) que usa la ingesta; el ADR 007 no recoge límites publicados para ese servicio, y las descargas de teselas de OpenFreeMap que sí limita no intervienen: este script no usa OpenFreeMap. No bajes el intervalo por debajo de 5 minutos (el script no lo permite).

## Cómo leer el resultado

- `resumen.horaConMasCambios`: la hora de Madrid (0–23) en la que más estaciones cambiaron de precio.
- `resumen.ventanaMedianoche.estacionesConCambios`: cambios acumulados entre las 23:30 y la 01:30.
- `resumen.porHoraMadrid`: lo mismo hora a hora, para ver si hay un pico a medianoche, otro por la mañana, etc.
- Un `error` en una medición indica que esa foto falló (el resto siguen).

Si el pico está a medianoche, conviene mantener la ventana densa del `cron` (cada 10 minutos de 23:30 a 01:30); si no, se puede quitar y dejar solo la cadencia base. Pasa el archivo para revisarlo antes de cambiar nada.
