/** localStorage sin romper la app si está bloqueado (ventana privada, datos desactivados…). */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la preferencia vale solo para esta sesión.
  }
}
