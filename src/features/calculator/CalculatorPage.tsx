import { Check, Minus, Plus, Search } from 'lucide-react';
import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { PageColumn, PageHeader } from '../../components/PageHeader';
import { AnimatedAmount } from '../../components/ui/AnimatedAmount';
import { LinkButton } from '../../components/ui/Button';
import { FuelChip, FuelChips } from '../../components/ui/Controls';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { calcSaving, type CompareMode } from '../../lib/calc';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatKm, formatMoney, formatPrice } from '../../lib/format';
import { hasOrigin, type Place } from '../../lib/place';
import { buildResultSet } from '../../lib/resultset';
import { useGasoraData } from '../../lib/useGasoraData';
import { useDataStore } from '../../stores/data';
import { MAX_LITERS, MIN_LITERS, useSearchStore } from '../../stores/search';
import { useUiStore } from '../../stores/ui';

const PRESETS = [30, 40, 50, 60];

function zoneName(place: Place): string {
  return place.kind === 'location' ? 'cerca de ti' : `en ${place.label}`;
}

/** Calculadora de ahorro (F9): litros, combustible y con qué se compara la más barata. */
export function CalculatorPage() {
  const { state, retry } = useGasoraData();
  const brandGroups = useDataStore((s) => s.brandGroups);
  const fuel = useUiStore((s) => s.fuel);
  const setFuel = useUiStore((s) => s.setFuel);
  const place = useSearchStore((s) => s.place);
  const radiusKm = useSearchStore((s) => s.radiusKm);
  const liters = useSearchStore((s) => s.liters);
  const setLiters = useSearchStore((s) => s.setLiters);
  const [mode, setMode] = useState<CompareMode>('avg');
  const literInput = useId();

  const data = state.status === 'ready' ? state.data : null;
  const result = useMemo(() => {
    if (!data || !place) return null;
    return buildResultSet({
      stations: data.stations.stations,
      prices: data.prices.p,
      fuel,
      place,
      radiusKm,
      brands: [],
      sort: 'price',
      liters,
      brandGroups,
    });
  }, [data, place, fuel, radiusKm, liters, brandGroups]);

  const canNear = place ? hasOrigin(place) : false;
  const effectiveMode: CompareMode = canNear ? mode : 'avg';
  const calc = useMemo(
    () =>
      result?.stats ? calcSaving(result.items, effectiveMode, liters, result.stats.mean) : null,
    [result, effectiveMode, liters],
  );

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseFloat(event.target.value);
    if (Number.isFinite(parsed)) setLiters(parsed);
  };

  let body;
  if (state.status === 'error') {
    body = <ErrorState text={state.message} onRetry={retry} />;
  } else if (!place) {
    body = (
      <EmptyState
        title="Primero busca gasolineras"
        text="La calculadora usa los precios de la zona que busques para decirte cuánto ahorras por depósito."
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Buscar gasolineras
          </LinkButton>
        }
      />
    );
  } else if (!data) {
    body = <Skeleton className="h-52 w-full rounded-3xl" />;
  } else if (!calc) {
    body = (
      <EmptyState
        title="No hay precios que comparar"
        text={`Ninguna gasolinera ${zoneName(place)} vende ${FUEL_LABELS[fuel]}. Prueba con otro combustible o amplía la búsqueda.`}
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Volver a la búsqueda
          </LinkButton>
        }
      />
    );
  } else {
    const rounded = Math.round(calc.saving * 100) / 100;
    body = (
      <section
        aria-labelledby="calc-result"
        className="rounded-3xl bg-brand p-5 text-on-brand shadow-[0_10px_30px_rgb(79_70_229/0.35)]"
        data-testid="calc-result"
      >
        <h2 id="calc-result" className="text-[0.8125rem] font-semibold opacity-90">
          Ahorras
        </h2>
        <p className="font-display-800 my-0.5 text-[3.25rem] leading-[1.05] tabular-nums">
          <AnimatedAmount
            value={rounded}
            testId="calc-amount"
            announce={`Ahorras ${formatMoney(rounded)} euros por depósito de ${liters} litros`}
          />{' '}
          €
        </p>
        <p className="text-[0.9375rem] font-semibold">por depósito de {liters} L</p>
        <p className="mt-2.5 text-[0.78rem] leading-snug opacity-95" data-testid="calc-detail">
          {calc.best.station.n} a {formatPrice(calc.best.price)} frente a {calc.reference.label} (
          {formatPrice(Math.round(calc.reference.price))}), con {liters} L.
          {rounded === 0 ? ' Hoy no hay diferencia con esa referencia.' : ''}
        </p>
      </section>
    );
  }

  return (
    <PageColumn>
      <PageHeader
        title="Calculadora de ahorro"
        subtitle="Cuánto te ahorras al repostar en la más barata"
      />
      <div className="flex min-w-0 flex-col gap-5">
        <section
          aria-labelledby="calc-liters"
          className="rounded-card border border-line bg-surface p-4 shadow-soft"
        >
          <h2 id="calc-liters" className="font-display-800 mb-2.5 text-[0.9375rem]">
            Litros del depósito
          </h2>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="map-btn"
              aria-label="Quitar 5 litros"
              onClick={() => setLiters(Math.max(MIN_LITERS, liters - 5))}
            >
              <Minus width={20} height={20} aria-hidden />
            </button>
            <label
              htmlFor={literInput}
              className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5"
            >
              <input
                id={literInput}
                type="number"
                inputMode="numeric"
                min={MIN_LITERS}
                max={MAX_LITERS}
                value={liters}
                onChange={onInput}
                aria-label="Litros del depósito"
                className="font-display w-24 min-w-0 border-0 bg-transparent text-right text-[2.75rem] font-extrabold tracking-[-0.03em] text-ink tabular-nums outline-0"
              />
              <span className="text-lg font-semibold text-muted">L</span>
            </label>
            <button
              type="button"
              className="map-btn"
              aria-label="Añadir 5 litros"
              onClick={() => setLiters(Math.min(MAX_LITERS, liters + 5))}
            >
              <Plus width={20} height={20} aria-hidden />
            </button>
          </div>
          <div
            role="group"
            aria-label="Litros habituales"
            className="mt-3 flex flex-wrap justify-center gap-2"
          >
            {PRESETS.map((n) => (
              <FuelChip
                key={n}
                label={`${n} L`}
                active={liters === n}
                onClick={() => setLiters(n)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="calc-fuel">
          <h2 id="calc-fuel" className="font-display-800 mb-2 text-[0.9375rem]">
            Combustible
          </h2>
          <FuelChips value={fuel} onChange={setFuel} wrap />
        </section>

        <section aria-labelledby="calc-compare">
          <h2 id="calc-compare" className="font-display-800 mb-2 text-[0.9375rem]">
            Comparar la más barata con
          </h2>
          <div className="flex flex-col gap-2" role="group" aria-label="Referencia de comparación">
            {[
              {
                id: 'avg' as const,
                label: 'La media de la zona',
                sub: calc
                  ? `Media de ${calc.count} gasolineras: ${formatPrice(Math.round(calc.mean))}`
                  : 'Media de las gasolineras de la zona',
                disabled: false,
              },
              {
                id: 'near' as const,
                label: 'La más cercana',
                sub: !canNear
                  ? 'Disponible al buscar por ubicación o código postal'
                  : calc?.nearest
                    ? `${calc.nearest.station.n} a ${formatKm(calc.nearest.distanceKm ?? 0)}: ${formatPrice(calc.nearest.price)}`
                    : 'La gasolinera más próxima a ti',
                disabled: !canNear,
              },
            ].map((option) => {
              const on = effectiveMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  disabled={option.disabled}
                  onClick={() => setMode(option.id)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left text-[0.9rem] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70 ${
                    on ? 'border-brand bg-brand-50' : 'border-line bg-surface hover:bg-brand-50'
                  }`}
                >
                  <span
                    className={`grid size-6 flex-none place-items-center rounded-full border-2 ${
                      on ? 'border-brand bg-brand text-on-brand' : 'border-line'
                    }`}
                    aria-hidden="true"
                  >
                    {on && <Check width={14} height={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {option.label}
                    <br />
                    <span className="text-[0.78rem] font-medium text-muted [overflow-wrap:anywhere]">
                      {option.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {place && (
          <p className="text-[0.78rem] text-muted" data-testid="calc-zone">
            Zona: gasolineras {zoneName(place)}
            {hasOrigin(place) || (place.kind === 'municipality' && place.expanded)
              ? ` a menos de ${radiusKm} km`
              : ''}
            .
          </p>
        )}
        <div>{body}</div>
      </div>
    </PageColumn>
  );
}
