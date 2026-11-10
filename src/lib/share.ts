/** Enlace absoluto a una ruta de la app (respeta la ruta base de la build: / con gasora.es). */
export function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}${path}`;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Web Share API con respaldo a copiar el enlace (sección 10 del plan). */
export async function shareLink(data: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // otro error: se intenta copiar
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
