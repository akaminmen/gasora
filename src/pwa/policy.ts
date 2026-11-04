/** Cada cuánto se busca una versión nueva con la app abierta. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Cuándo se activa una versión nueva ya descargada (estrategia contra versiones viejas, ADR 014):
 *  - con la app a la vista, se avisa y la persona decide («Actualizar»);
 *  - en cuanto la app pasa a segundo plano se activa sola: así no se pierde nada de lo que se
 *    estuviera haciendo y nadie se queda semanas con una versión antigua.
 */
export function shouldApplyInBackground(input: {
  needRefresh: boolean;
  visibility: DocumentVisibilityState;
}): boolean {
  return input.needRefresh && input.visibility === 'hidden';
}
