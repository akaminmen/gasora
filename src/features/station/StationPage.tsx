import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { PageColumn } from '../../components/PageHeader';
import { Button, LinkButton } from '../../components/ui/Button';
import { EmptyState, ErrorState, StationDetailSkeleton } from '../../components/ui/Feedback';
import { StationDetail } from '../../components/ui/StationDetail';
import { FUELS } from '../../lib/fuel-ids';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime } from '../../lib/format';
import { absoluteUrl } from '../../lib/share';
import { useGasoraData } from '../../lib/useGasoraData';
import { sellableFuel, zoneItem } from '../../lib/zone';
import { useDataStore } from '../../stores/data';
import { useFavoritesStore } from '../../stores/favorites';
import { useSearchStore } from '../../stores/search';
import { useUiStore } from '../../stores/ui';
import { shareStation } from '../results/share';

/** Ficha de una estación por enlace directo (`/e/:id`, F7 y F14). */
export function StationPage() {
  const { id = '' } = useParams();
  const { state, retry } = useGasoraData();
  const stationsById = useDataStore((s) => s.stationsById);
  const index = useDataStore((s) => s.index);
  const loadIndex = useDataStore((s) => s.loadIndex);
  const preferred = useUiStore((s) => s.fuel);
  const liters = useSearchStore((s) => s.liters);
  const favorite = useFavoritesStore((s) => s.ids.includes(id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const removeFavorite = useFavoritesStore((s) => s.remove);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  const data = state.status === 'ready' ? state.data : null;
  const station = stationsById.get(id);
  const fuel = data && station ? sellableFuel(data.prices.p, id, preferred) : null;
  const item = useMemo(
    () =>
      data && station && fuel
        ? zoneItem(data.stations.stations, data.prices.p, station, fuel, liters)
        : null,
    [data, station, fuel, liters],
  );

  useEffect(() => {
    if (!station) return;
    const previous = document.title;
    document.title = `${station.n} · Gasora`;
    return () => {
      document.title = previous;
    };
  }, [station]);

  const back = (
    <LinkButton
      to="/"
      variant="ghost"
      icon={<ArrowLeft width={18} height={18} aria-hidden />}
      className="mb-3"
      aria-label="Volver a la búsqueda"
    >
      Volver
    </LinkButton>
  );

  if (state.status === 'error') {
    return (
      <PageColumn>
        <h1 className="sr-only">Ficha de la gasolinera {id}</h1>
        <ErrorState text={state.message} onRetry={retry} />
      </PageColumn>
    );
  }
  if (!data) {
    return (
      <PageColumn>
        <h1 className="sr-only">Ficha de la gasolinera {id}</h1>
        <StationDetailSkeleton />
      </PageColumn>
    );
  }
  if (!station || !fuel || !item) {
    return (
      <PageColumn>
        <h1 className="sr-only">Ficha de la gasolinera {id}</h1>
        <EmptyState
          title="Esta gasolinera ya no está disponible"
          text="No aparece en los datos actuales del Ministerio. Puede haber cerrado o haber cambiado de código."
          actions={
            <>
              {favorite && (
                <Button variant="secondary" size="lg" onClick={() => removeFavorite(id)}>
                  Quitar de favoritos
                </Button>
              )}
              <LinkButton to="/" size="lg" icon={<Search width={18} height={18} aria-hidden />}>
                Buscar gasolineras
              </LinkButton>
            </>
          }
        />
      </PageColumn>
    );
  }

  const row = data.prices.p[id] ?? [];
  const municipality =
    index.status === 'ready' ? (index.searcher.municipalityName(station.mid) ?? '') : '';
  return (
    <PageColumn>
      {back}
      <h1 className="sr-only">Ficha de la gasolinera {station.n}</h1>
      {fuel !== preferred && (
        <p
          role="status"
          className="mb-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[0.8125rem]"
          data-testid="fuel-note"
        >
          Esta gasolinera no vende {FUEL_LABELS[preferred]}: te mostramos {FUEL_LABELS[fuel]}.
        </p>
      )}
      <div className="rounded-card border border-line bg-surface shadow-soft">
        <StationDetail
          name={station.n}
          brandKey={station.b}
          subtitle={
            municipality ? `Estación de servicio · ${municipality}` : 'Estación de servicio'
          }
          fuel={fuel}
          price={item.price}
          tier={item.tier}
          saving={item.saving}
          liters={liters}
          address={station.a}
          postalCode={station.z}
          municipality={municipality}
          prices={FUELS.map((f, i) => ({ fuel: f, price: row[i] ?? null }))}
          hours={station.h || 'Horario no disponible'}
          dataDate={formatDateTime(data.meta.sourceDate)}
          lat={station.lat}
          lng={station.lng}
          favorite={favorite}
          onToggleFavorite={() => toggleFavorite(id)}
          onShare={() =>
            void shareStation({ id: station.id, name: station.n, url: absoluteUrl(`/e/${id}`) })
          }
          columns={3}
        />
      </div>
      <p className="mt-3 text-[0.78rem] text-muted">
        Comparada con las gasolineras a menos de 10 km. El precio en el surtidor puede ser distinto.
      </p>
    </PageColumn>
  );
}
