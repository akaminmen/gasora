import { Check, LocateFixed, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { SEARCH_PENDING } from '../../app/AppShell';
import { Button } from '../../components/ui/Button';
import { FuelChips } from '../../components/ui/Controls';
import { SearchField } from '../../components/ui/SearchField';
import { formatDateTime } from '../../lib/format';
import { useGasoraData } from '../../lib/useGasoraData';
import { useToastStore } from '../../stores/toast';
import { useUiStore } from '../../stores/ui';
import { HeroPreview } from './HeroPreview';

function DataStatus() {
  const { state, retry } = useGasoraData();
  if (state.status === 'loading') {
    return (
      <p data-testid="status-line" className="text-[0.8125rem] text-muted">
        Cargando datos…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <p data-testid="status-error" role="alert" className="text-[0.8125rem]">
        {state.message}{' '}
        <button type="button" onClick={retry} className="min-h-11 font-bold text-link underline">
          Reintentar
        </button>
      </p>
    );
  }
  const { meta } = state.data;
  return (
    <div className="flex flex-col gap-1">
      {meta.demo && (
        <p data-testid="demo-label" className="text-[0.8125rem] font-semibold text-link">
          Datos de demostración
        </p>
      )}
      <p data-testid="status-line" className="text-[0.8125rem] text-muted">
        {meta.stationCount.toLocaleString('es-ES')} estaciones · Datos del Ministerio consultados el{' '}
        {formatDateTime(meta.sourceDate)}
      </p>
    </div>
  );
}

/** Inicio: hero de primera visita. Buscar y ubicar llegan con la capa de búsqueda (Fase 3). */
export function HomePage() {
  const fuel = useUiStore((s) => s.fuel);
  const setFuel = useUiStore((s) => s.setFuel);
  const showToast = useToastStore((s) => s.show);
  const [query, setQuery] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 py-6 lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:py-12">
      <section className="flex min-w-0 flex-col gap-6 lg:flex-[1_1_560px]">
        <h1 className="font-display-800 text-[2.5rem] leading-[1.06] lg:text-[4rem] lg:leading-[1.04]">
          La gasolina más barata, <span className="text-link">más cerca</span>
        </h1>
        <p className="max-w-[34rem] text-base leading-normal text-muted lg:text-[1.1875rem]">
          Encuentra en segundos dónde repostar más barato cerca de ti, con los datos abiertos de
          precios de toda España.
        </p>

        <div className="max-w-[600px]">
          <SearchField
            size="hero"
            value={query}
            onChange={setQuery}
            onSubmit={() => showToast(SEARCH_PENDING)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            size="lg"
            icon={<LocateFixed width={20} height={20} aria-hidden />}
            onClick={() => showToast(SEARCH_PENDING)}
          >
            Usar mi ubicación
          </Button>
          <span className="text-sm text-muted">o busca arriba por ciudad o CP</span>
        </div>

        <div className="max-w-[600px]">
          <FuelChips value={fuel} onChange={setFuel} wrap />
        </div>

        <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-2 p-0 text-[0.84rem] font-medium text-muted">
          <li className="inline-flex items-center gap-2">
            <ShieldCheck width={20} height={20} aria-hidden />
            Datos abiertos del Ministerio
          </li>
          <li className="inline-flex items-center gap-2">
            <Check width={20} height={20} aria-hidden />
            Sin registro ni cookies
          </li>
        </ul>
        <DataStatus />
      </section>

      <section
        aria-hidden="true"
        className="hidden min-w-0 lg:block lg:flex-[0_1_600px]"
        data-testid="hero-preview"
      >
        <HeroPreview />
      </section>
    </div>
  );
}
