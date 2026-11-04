/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Versión del paquete y confirmación (7 caracteres) del build, definidas en vite.config.ts. */
declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;

/** Nombres de los logos que hay en `public/brands/` (lo genera el plugin de vite.config.ts). */
declare module 'virtual:brand-files' {
  const files: string[];
  export default files;
}
