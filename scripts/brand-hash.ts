import { createHash } from 'node:crypto';

/**
 * Versión de un logo para la URL (`brands/repsol.svg?v=3f2a91c0`): 8 caracteres hexadecimales del
 * SHA-1 del contenido. Si el archivo cambia, la URL cambia y ningún navegador ni caché del service
 * worker sirve el logo viejo; si no cambia, la URL es la misma y se reutiliza la caché (ADR 015).
 */
export function contentHash(bytes: Uint8Array | string): string {
  return createHash('sha1').update(bytes).digest('hex').slice(0, 8);
}
