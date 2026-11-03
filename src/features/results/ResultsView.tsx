import { Expand, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import {
  BrandMultiSelect,
  FuelChips,
  RadiusSlider,
  SortControl,
} from '../../components/ui/Controls';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  StationCardSkeleton,
} from '../../components/ui/Feedback';
import { StationCard } from '../../components/ui/Station';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime, formatPrice } from '../../lib/format';
import {
  EXPANDED_MUNICIPALITY_KM,
  MAX_RADIUS_KM,
  hasOrigin,
  usesRadius,
  type Place,
} from '../../lib/place';
import { buildResultSet } from '../../lib/resultset';
import { useGasoraData } from '../../lib/useGasoraData';
import { MAX_LIST, useSearchStore } from '../../stores/search';
import { useToastStore } from '../../stores/toast';
import { useUiStore } from '../../stores/ui';
import { useDataStore } from '../../stores/data';

export const FAVORITES_PENDING = 'Los favoritos estarán disponibles muy pronto.';

function title(place: Place): string {
  return place.kind === 'location' ? 'Gasolineras cerca de ti' : `Gasolineras en ${place.label}`;
}

/** Puede ampliarse: municipio sin ampliar, o búsqueda por radio por debajo del máximo. */
function canWiden(place: Place, radiusKm: number): boolean {
  if (place.kind === 'municipality' && !place.expanded) return true;
  return usesRadius(place) && radiusKm < MAX_RADIUS_KM;
}

/** Resultados de la búsqueda activa (lista sencilla; el mapa llega en la Fase 4). */
export function ResultsView({ place }: { place: Place }) {
  const { state, retry } = useGasoraData();
  const brandGroups = useDataStore((s) => s.brandGroups);
  const fuel = useUiStore((s) => s.fuel);
  const setFuel = useUiStore((s) => s.setFuel);
  const showToast = useToastStore((s) => s.show);
  const { radiusKm, sort, brands, liters, limit } = useSearchStore();
  const { setRadius, setSort, setBrands, showMore, widen, clearPlace } = useSearchStore.getState();

  const data = state.status === 'ready' ? state.data : null;
  const result = useMemo(
    () =>
      data
        ? buildResultSet({
            stations: data.stations.stations,
            prices: data.prices.p,
            fuel,
            place,
            radiusKm,
            brands,
            sort,
            liters,
            brandGroups,
          })
        : null,
    [data, fuel, place, radiusKm, brands, sort, liters, brandGroups],
  );

  const fuelLabel = FUEL_LABELS[fuel];
  const widenLabel =
    place.kind === 'municipality' && !place.expanded
      ? `Ampliar a ${EXPANDED_MUNICIPALITY_KM} km`
      : 'Ampliar radio';

  let body;
  if (state.status === 'error') {
    body = <ErrorState text={state.message} onRetry={retry} />;
  } else if (!result || !data) {
    body = (
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="list-none">
            <StationCardSkeleton />
          </li>
        ))}
      </ul>
    );
  } else if (result.items.length === 0) {
    body = (
      <EmptyState
        title="No encontramos gasolineras aquí"
        text={`Ninguna gasolinera de esta zona vende ${fuelLabel}. Prueba con otro combustible o con una zona más amplia.`}
        actions={
          canWiden(place, radiusKm) ? (
            <Button size="lg" icon={<Expand width={18} height={18} aria-hidden />} onClick={widen}>
              {widenLabel}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (result.visible.length === 0) {
    body = (
      <EmptyState
        title="Ninguna con esas marcas"
        text="Ninguna gasolinera de las marcas elegidas vende este combustible en esta zona."
        actions={
          <Button size="lg" onClick={() => setBrands([])}>
            Quitar el filtro de marcas
          </Button>
        }
      />
    );
  } else {
    const shown = result.visible.slice(0, limit);
    body = (
      <>
        <ul
          data-testid="results-list"
          className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 md:grid-cols-2"
        >
          {shown.map((item) => (
            <StationCard
              key={item.station.id}
              id={item.station.id}
              name={item.station.n}
              brandKey={item.station.b}
              address={item.station.a}
              distanceKm={item.distanceKm}
              price={item.price}
              tier={item.tier}
              best={item.best}
              saving={item.saving}
              onToggleFavorite={() => showToast(FAVORITES_PENDING)}
            />
          ))}
        </ul>
        {result.visible.length > shown.length &&
          (limit < MAX_LIST ? (
            <Button variant="secondary" size="lg" className="mx-auto" onClick={showMore}>
              Ver más
            </Button>
          ) : (
            <p className="text-center text-sm text-muted">
              Mostramos las {MAX_LIST} primeras. Afina la búsqueda para ver el resto.
            </p>
          ))}
      </>
    );
  }

  const stats = result?.stats;
  return (
    <section aria-labelledby="results-title" className="flex min-w-0 flex-col gap-5">
      {data?.fromCache && (
        <OfflineBanner date={formatDateTime(data.meta.sourceDate)} onRetry={retry} />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id="results-title"
            data-testid="results-title"
            className="font-display-800 text-[1.75rem] leading-tight lg:text-[2.25rem]"
          >
            {title(place)}
          </h1>
          <p data-testid="results-summary" className="mt-1 text-sm text-muted">
            {result
              ? stats
                ? `${result.items.length.toLocaleString('es-ES')} ${
                    result.items.length === 1 ? 'gasolinera' : 'gasolineras'
                  } con ${fuelLabel} · media ${formatPrice(Math.round(stats.mean))}`
                : `Sin gasolineras con ${fuelLabel}`
              : 'Buscando…'}
          </p>
        </div>
        <Button
          variant="ghost"
          icon={<X width={18} height={18} aria-hidden />}
          onClick={clearPlace}
          data-testid="clear-search"
        >
          Borrar búsqueda
        </Button>
      </div>

      <FuelChips value={fuel} onChange={setFuel} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {usesRadius(place) && (
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <RadiusSlider value={radiusKm} onChange={setRadius} />
          </div>
        )}
        {hasOrigin(place) && <SortControl value={sort} onChange={setSort} />}
        {result && result.brands.length > 1 && (
          <BrandMultiSelect options={result.brands} selected={brands} onChange={setBrands} />
        )}
        {place.kind === 'municipality' && !place.expanded && (
          <Button variant="secondary" onClick={widen}>
            {widenLabel}
          </Button>
        )}
      </div>

      {body}
    </section>
  );
}
