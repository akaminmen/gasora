/**
 * Límites de uso de OpenFreeMap (ADR 007): las descargas sin conexión no pueden pasar de 3.000
 * teselas ni de 50 MB. La app no descarga nada en bloque: solo guarda las teselas que el usuario
 * llega a ver, hasta un máximo de 600 (≈ 20 % del límite de teselas; a 20–60 KB cada una, entre
 * 12 y 36 MB, por debajo de los 50 MB) y caducan a los 7 días.
 */
export const MAX_CACHED_TILES = 600;

/** Peticiones del mapa que se guardan en la caché de ejecución (host: tiles.openfreemap.org). */
export const TILES_URL =
  /^https:\/\/tiles\.openfreemap\.org\/(planet\/[^/]+\/\d+\/\d+\/\d+\.pbf|natural_earth\/.+\.png)$/;
export const STYLE_URL = /^https:\/\/tiles\.openfreemap\.org\/(styles\/|sprites\/|planet$)/;
export const FONTS_URL = /^https:\/\/tiles\.openfreemap\.org\/fonts\//;

/** Logos de marca (`public/brands/`): solo se piden al servidor los que existen, y se guardan al verlos. */
export const BRANDS_URL = /\/brands\/[^/?#]+\.(svg|webp|png)$/;
