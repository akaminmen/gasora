# 015 — Logos de marcas como icono de la estación

Estado: **aceptada** · Fecha: 04/11/2026

## Decisión

El propietario del proyecto autoriza mostrar los logos de las marcas de gasolineras como icono de la estación. Queda sin efecto la regla del plan original «sin logos de marcas (marcas registradas)». El avatar con la inicial sobre color (`BrandAvatar`) se mantiene como respaldo.

## Cómo funciona

- **Los logos los aporta el propietario**: el repositorio no los descarga ni los dibuja. Van en `public/brands/`, un archivo por marca: `<nombre>.svg` o, si no hay SVG, `<nombre>.webp` o `<nombre>.png` (se usa el primero que exista, en ese orden).
- **Tabla marca → archivo**: `src/lib/brand-logos.ts` (`BRAND_LOGO_FILES`). Tiene una entrada por cada marca que reconoce la ingesta (`scripts/brands.ts`); un test unitario exige que coincidan. Dos marcas pueden compartir archivo si se decide (p. ej. `cepsa: 'moeve'`).
- **Qué archivos existen**: un plugin de Vite (`virtual:brand-files`, en `vite.config.ts`) lista `public/brands/` al compilar. Así la aplicación solo pide al servidor los logos que existen: no hay peticiones 404 por los que faltan. Si un archivo falla al cargar, el componente vuelve al avatar.
- **Componente `BrandLogo`** (`src/components/ui/Station.tsx`): en las tarjetas de resultado, la ficha y los favoritos; **no** en los pines del mapa. Contenedor cuadrado del tamaño del avatar (44 px, 36 px en tarjeta estrecha, 52 px en la ficha), `object-fit: contain`, fondo neutro claro (`#f8fafc`) también en el tema oscuro y `alt` vacío: el nombre de la estación ya está en texto. No cambia el layout de las tarjetas (los tests de layout y axe pasan con el rótulo de 86 caracteres y con logos).
- **Validación**: `npm run brands:check` comprueba que cada archivo corresponde a una marca de la tabla, que los SVG pesan como máximo 8 KB y no contienen scripts, manejadores de eventos, `foreignObject`, `@import` ni referencias externas (solo `#id` internos), y lista las marcas sin logo. Las marcas sin logo no son un error.
- **Service worker**: los logos **no** van en la precarga (`globIgnores: brands/**`). Se guardan al usarse (`CacheFirst`, caché `gasora-brand-logos-v1`, hasta 60 entradas, 30 días), así que se ven sin conexión tras la primera visita. `check:build` vigila ambas cosas.
- **Versión en la URL (Fase 7).** Cada logo se pide como `brands/<nombre>.svg?v=<hash>`, con los 8 primeros caracteres del SHA-1 de su contenido (`scripts/brand-hash.ts`, calculado por el mismo plugin que lista los archivos). Si cambias el archivo, la URL cambia: ni la caché HTTP ni la del service worker sirven el logo viejo, aunque no hayan caducado los 30 días; si no cambia, se reutiliza. Se sigue soltando el archivo en `public/brands/` con su nombre de siempre. Las entradas viejas caducan solas (tope de 60). GitHub Pages ignora la consulta.
- **Pruebas**: el build de los tests e2e (`--mode e2e`) incluye dos logos de prueba rectangulares (Ballenoil y Shell, escritos por `scripts/e2e-data.ts`); el resto de marcas usa el avatar, de modo que ambos caminos se prueban en la misma pantalla.

## Aviso legal y licencia

Los logos son marcas de sus respectivos propietarios y se muestran solo para identificar la estación; Gasora no está afiliada a ellas. Este aviso figura en «Acerca de» y en el README. **`public/brands/` no está bajo la licencia MIT del repositorio.** Un titular de marca puede pedir la retirada de su logo: basta con borrar el archivo (la interfaz vuelve al avatar).

## Consecuencias

- Un logo mal nombrado no se muestra y `brands:check` lo señala como error.
- Los logos raster (WebP, PNG) se recomiendan de hasta 30 KB; el aviso no bloquea.
- Añadir una marca nueva a la ingesta exige añadirla a la tabla de logos (lo comprueba un test).
