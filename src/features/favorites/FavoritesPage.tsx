import { Heart, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useMemo } from 'react';
import { PageColumn, PageHeader } from '../../components/PageHeader';
import { Button, LinkButton } from '../../components/ui/Button';
import { FuelChips } from '../../components/ui/Controls';
import { EmptyState, ErrorState, StationCardSkeleton } from '../../components/ui/Feedback';
import { BrandAvatar, StationCard } from '../../components/ui/Station';
import { DEFAULT_LITERS } from '../../lib/pricing';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime } from '../../lib/format';
import { useGasoraData } from '../../lib/useGasoraData';
import { zoneItem } from '../../lib/zone';
import { useDataStore } from '../../stores/data';
import { useFavoritesStore } from '../../stores/favorites';
import { useSearchStore } from '../../stores/search';
import { useUiStore } from '../../stores/ui';

/** Fila de una favorita que ya no existe o que no vende el combustible elegido. */
function PlainRow({
  id,
  name,
  brandKey,
  text,
  to,
  onRemove,
}: {
  id: string;
  name: string;
  brandKey: string;
  text: string;
  to?: string;
  onRemove: () => void;
}) {
  return (
    <li
      className="flex min-w-0 items-center gap-3 rounded-card border border-line bg-surface p-3"
      data-testid="favorite-row"
      data-station-id={id}
    >
      <BrandAvatar name={name} brandKey={brandKey} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold" title={name}>
          {to ? (
            <Link to={to} className="text-ink no-underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </p>
        <p className="text-[0.8125rem] text-muted">{text}</p>
      </div>
      <Button
        variant="secondary"
        icon={<Trash2 width={16} height={16} aria-hidden />}
        onClick={onRemove}
        aria-label={`Quitar ${name} de favoritos`}
      >
        Quitar
      </Button>
    </li>
  );
}

/** Favoritos (F8): guardados en `gasora:favorites:v1`, con su precio actual. */
export function FavoritesPage() {
  const { state, retry } = useGasoraData();
  const ids = useFavoritesStore((s) => s.ids);
  const remove = useFavoritesStore((s) => s.remove);
  const fuel = useUiStore((s) => s.fuel);
  const setFuel = useUiStore((s) => s.setFuel);
  const liters = useSearchStore((s) => s.liters);
  const stationsById = useDataStore((s) => s.stationsById);
  const data = state.status === 'ready' ? state.data : null;

  const rows = useMemo(() => {
    if (!data) return null;
    return ids.map((id) => {
      const station = stationsById.get(id);
      if (!station) return { id, station: null, item: null };
      const item = zoneItem(
        data.stations.stations,
        data.prices.p,
        station,
        fuel,
        liters || DEFAULT_LITERS,
      );
      return { id, station, item };
    });
  }, [data, ids, stationsById, fuel, liters]);

  const count = ids.length;
  const subtitle =
    count === 0
      ? 'Nada guardado todavía'
      : `${count} ${count === 1 ? 'gasolinera guardada' : 'gasolineras guardadas'}`;

  let body;
  if (count === 0) {
    body = (
      <EmptyState
        icon={<Heart width={44} height={44} aria-hidden />}
        title="Aún no tienes favoritos"
        text="Guarda tus gasolineras habituales con el corazón y consulta sus precios de un vistazo."
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Buscar gasolineras
          </LinkButton>
        }
      />
    );
  } else if (state.status === 'error') {
    body = <ErrorState text={state.message} onRetry={retry} />;
  } else if (!rows || !data) {
    body = (
      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-busy="true">
        {ids.slice(0, 3).map((id) => (
          <li key={id} className="list-none">
            <StationCardSkeleton />
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <>
        <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="favorites-list">
          {rows.map(({ id, station, item }) => {
            if (!station) {
              return (
                <PlainRow
                  key={id}
                  id={id}
                  name="Gasolinera"
                  brandKey="otras"
                  text="Ya no disponible: el Ministerio no la publica ahora."
                  onRemove={() => remove(id)}
                />
              );
            }
            if (!item) {
              return (
                <PlainRow
                  key={id}
                  id={id}
                  name={station.n}
                  brandKey={station.b}
                  text={`No vende ${FUEL_LABELS[fuel]}.`}
                  to={`/e/${id}`}
                  onRemove={() => remove(id)}
                />
              );
            }
            return (
              <StationCard
                key={id}
                id={id}
                name={station.n}
                brandKey={station.b}
                address={station.a}
                price={item.price}
                tier={item.tier}
                best={item.best}
                saving={item.saving}
                favorite
                onToggleFavorite={() => remove(id)}
              />
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[0.78rem] text-muted">
          {FUEL_LABELS[fuel]} · Datos del Ministerio consultados el{' '}
          {formatDateTime(data.meta.sourceDate)}. Toca una gasolinera para ver su ficha completa.
        </p>
      </>
    );
  }

  return (
    <PageColumn>
      <PageHeader title="Favoritos" subtitle={subtitle} />
      {count > 0 && (
        <div className="mb-4">
          <FuelChips value={fuel} onChange={setFuel} />
        </div>
      )}
      {body}
    </PageColumn>
  );
}
