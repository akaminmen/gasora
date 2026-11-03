import { useEffect } from 'react';
import { StationDetail } from '../../components/ui/StationDetail';
import { FUELS, type FuelId, type Meta, type PricesFile } from '../../lib/data-schema';
import { formatDateTime } from '../../lib/format';
import type { ResultItem } from '../../lib/resultset';
import { useDataStore } from '../../stores/data';
import { useToastStore } from '../../stores/toast';

export const SHARE_PENDING = 'Compartir estará disponible muy pronto.';
export const FAVORITES_PENDING = 'Los favoritos estarán disponibles muy pronto.';

/** Ficha de la estación seleccionada: panel lateral en escritorio y contenido de la hoja en móvil. */
export function DetailPanel({
  item,
  fuel,
  prices,
  meta,
  liters,
  columns,
  onClose,
}: {
  item: ResultItem;
  fuel: FuelId;
  prices: PricesFile['p'];
  meta: Meta;
  liters: number;
  columns: 2 | 3;
  onClose: () => void;
}) {
  const index = useDataStore((s) => s.index);
  const loadIndex = useDataStore((s) => s.loadIndex);
  const showToast = useToastStore((s) => s.show);
  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  const { station } = item;
  const names = index.status === 'ready' ? index.searcher : null;
  const municipality = names?.municipalityName(station.mid) ?? '';
  const row = prices[station.id] ?? [];
  return (
    <StationDetail
      name={station.n}
      brandKey={station.b}
      subtitle={municipality ? `Estación de servicio · ${municipality}` : 'Estación de servicio'}
      fuel={fuel}
      price={item.price}
      tier={item.tier}
      saving={item.saving}
      liters={liters}
      address={station.a}
      postalCode={station.z}
      municipality={municipality}
      distanceKm={item.distanceKm}
      prices={FUELS.map((id, i) => ({ fuel: id, price: row[i] ?? null }))}
      hours={station.h || 'Horario no disponible'}
      dataDate={formatDateTime(meta.sourceDate)}
      lat={station.lat}
      lng={station.lng}
      favorite={false}
      onToggleFavorite={() => showToast(FAVORITES_PENDING)}
      onShare={() => showToast(SHARE_PENDING)}
      onClose={onClose}
      columns={columns}
    />
  );
}
