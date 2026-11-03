import { shareLink } from '../../lib/share';
import { useToastStore } from '../../stores/toast';

/** Comparte la ficha de una estación (Web Share o copiar el enlace) y avisa del resultado. */
export async function shareStation(station: {
  id: string;
  name: string;
  url: string;
}): Promise<void> {
  const show = useToastStore.getState().show;
  const result = await shareLink({
    title: `${station.name} · Gasora`,
    text: `Precios de ${station.name} en Gasora`,
    url: station.url,
  });
  if (result === 'copied') show('Enlace copiado.');
  else if (result === 'failed') show('No se ha podido compartir. Copia la dirección de la barra.');
}
