import { Heart, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BottomSheet, type SheetSnap } from '../../components/ui/BottomSheet';
import { Button, LinkButton } from '../../components/ui/Button';
import {
  BrandMultiSelect,
  FuelChips,
  RadiusSlider,
  SortControl,
  type SortKey,
} from '../../components/ui/Controls';
import {
  EmptyState,
  ErrorState,
  LocatingState,
  OfflineBanner,
  PermissionDenied,
  PermissionPrompt,
  StatCard,
  StationCardSkeleton,
  StationDetailSkeleton,
  ToastSample,
} from '../../components/ui/Feedback';
import { Logo, LogoMark } from '../../components/ui/Logo';
import { SearchField, Suggestions, type Suggestion } from '../../components/ui/SearchField';
import {
  BrandAvatar,
  FavoriteButton,
  PricePin,
  StationCard,
  TierCircle,
  TierPill,
} from '../../components/ui/Station';
import { StationDetail } from '../../components/ui/StationDetail';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import type { FuelId } from '../../lib/data-schema';
import { TIERS } from '../../lib/tiers';
import { CARD_SAMPLES, EXTREME_CARD, LONG_ADDRESS, LONG_NAME } from './samples';

const SUGGESTIONS: Suggestion[] = [
  { id: 's1', group: 'Provincia', text: 'Málaga', match: 'Má', count: 312 },
  { id: 's2', group: 'Municipio', text: 'Marbella', match: 'Ma', detail: 'Málaga', count: 41 },
  { id: 's3', group: 'CP', text: '29001', detail: 'Málaga', count: 6 },
];

const BRANDS = [
  { key: 'repsol', label: 'Repsol', count: 2808 },
  { key: 'moeve', label: 'Moeve', count: 626 },
  { key: 'cepsa', label: 'Cepsa', count: 580 },
  { key: 'otras', label: 'Otras', count: 3358 },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="font-display-800 mb-4 text-[1.625rem]">
        {title}
      </h2>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-bold tracking-[0.07em] text-muted uppercase">{children}</p>
  );
}

const DETAIL_PRICES: { fuel: FuelId; price: number | null }[] = [
  { fuel: 'g95e5', price: 1359 },
  { fuel: 'g98e5', price: 1489 },
  { fuel: 'goa', price: 1380 },
  { fuel: 'goap', price: 1459 },
  { fuel: 'glp', price: null },
  { fuel: 'gnc', price: 1399 },
];

function detailProps(columns: 2 | 3, extreme: boolean) {
  return {
    name: extreme ? LONG_NAME : 'Ballenoil',
    brandKey: extreme ? 'otras' : 'ballenoil',
    subtitle: 'Estación de servicio · Málaga',
    fuel: 'g95e5' as FuelId,
    price: extreme ? 1999 : 1359,
    tier: 'cheap' as const,
    saving: extreme ? 123.45 : 3.69,
    address: extreme ? LONG_ADDRESS : 'Av. de Velázquez, 118',
    postalCode: '29004',
    municipality: 'Málaga',
    distanceKm: 0.9,
    prices: DETAIL_PRICES,
    hours: extreme ? 'L-V: 08:00-21:00; S: 09:00-14:00; D y festivos: 10:00-14:00' : 'L-D: 24H',
    dataDate: '28/10/2026, 16:39',
    lat: 36.7213,
    lng: -4.4214,
    favorite: false,
    columns,
  };
}

/** Galería de componentes y estados (solo desarrollo y tests). */
export default function UiKitPage() {
  const [fuel, setFuel] = useState<FuelId>('g95e5');
  const [sort, setSort] = useState<SortKey>('price');
  const [radius, setRadius] = useState(5);
  const [brands, setBrands] = useState<string[]>([]);
  const [query, setQuery] = useState('Má');
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const [fav, setFav] = useState(false);

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-4 py-8 lg:px-8">
        <header className="flex flex-wrap items-end gap-6">
          <div>
            <Caption>Sistema de diseño · v1 · solo desarrollo</Caption>
            <h1 className="font-display-800 text-5xl">Gasora</h1>
          </div>
          <p className="max-w-[32rem] text-sm text-muted lg:ml-auto lg:text-right">
            El índigo es la identidad. La escala verde–amarillo–naranja–rojo existe solo dentro de
            marcadores y etiquetas de precio.
          </p>
          <ThemeToggle />
        </header>

        <Section id="kit-logo" title="Logo">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid place-items-center rounded-card border border-line bg-brand-50 p-7">
              <LogoMark size={96} />
            </div>
            <div className="grid place-items-center rounded-card border border-line bg-surface p-7">
              <Logo markSize={56} wordSize={40} />
            </div>
          </div>
        </Section>

        <Section id="kit-botones" title="Botones y favorito">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Cómo llegar</Button>
            <Button variant="secondary">Compartir</Button>
            <Button variant="ghost">Ahora no</Button>
            <Button disabled>Deshabilitado</Button>
            <Button size="lg">Usar mi ubicación</Button>
            <FavoriteButton active={fav} onToggle={() => setFav((v) => !v)} name="Ballenoil" />
            <FavoriteButton active onToggle={() => undefined} name="Shell" />
            <LinkButton to="/" variant="secondary">
              Enlace con aspecto de botón
            </LinkButton>
          </div>
        </Section>

        <Section id="kit-controles" title="Chips, selectores y filtros">
          <FuelChips value={fuel} onChange={setFuel} wrap />
          <div className="flex flex-wrap items-center gap-3">
            <SortControl value={sort} onChange={setSort} />
            <BrandMultiSelect options={BRANDS} selected={brands} onChange={setBrands} />
          </div>
          <div className="max-w-md">
            <RadiusSlider value={radius} onChange={setRadius} />
          </div>
        </Section>

        <Section id="kit-buscador" title="Buscador con sugerencias">
          <div className="relative h-[330px] max-w-xl">
            <SearchField
              value={query}
              onChange={setQuery}
              listboxId="kit-suggestions"
              expanded
              activeId="s1"
            >
              <Suggestions id="kit-suggestions" items={SUGGESTIONS} activeId="s1" />
            </SearchField>
          </div>
        </Section>

        <Section id="kit-tarjetas" title="Tarjeta de resultado (sección 9.7)">
          <Caption>Casos extremos: rótulo de 86 caracteres y dirección de 104</Caption>
          <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0 md:grid-cols-2">
            {CARD_SAMPLES.map((card) => (
              <StationCard key={card.id} {...card} />
            ))}
          </ul>
          <Caption>Ancho de 288 px (móvil de 320 px) y esqueleto</Caption>
          <ul className="m-0 flex w-[288px] max-w-full list-none flex-col gap-3 p-0">
            <StationCard {...EXTREME_CARD} id="narrow" />
            <StationCardSkeleton />
          </ul>
        </Section>

        <Section id="kit-pines" title="Marcadores de mapa y tramos de precio">
          <div className="map-sample p-6">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-8 pt-4">
              <PricePin
                price={1359}
                tier="cheap"
                best
                label="1,359 euros, barata, la más barata"
                onClick={() => undefined}
              />
              <PricePin
                price={1379}
                tier="cheap"
                selected
                label="1,379 euros, barata, seleccionada"
                onClick={() => undefined}
              />
              <PricePin
                price={1419}
                tier="mid"
                label="1,419 euros, media"
                onClick={() => undefined}
              />
              <PricePin
                price={1489}
                tier="high"
                label="1,489 euros, alta"
                onClick={() => undefined}
              />
              <PricePin
                price={1999}
                tier="top"
                best
                label="1,999 euros, cara, la más barata"
                onClick={() => undefined}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {TIERS.map((tier) => (
              <span key={tier} className="inline-flex items-center gap-2">
                <TierCircle tier={tier} />
                <TierPill tier={tier} />
              </span>
            ))}
            <BrandAvatar name="Ballenoil" brandKey="ballenoil" />
            <BrandAvatar name="Shell" brandKey="shell" />
            <BrandAvatar name="Repsol" brandKey="repsol" />
          </div>
        </Section>

        <Section id="kit-ficha" title="Ficha de estación">
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2">
            <div className="min-w-0 max-w-[360px] rounded-card border border-line bg-surface">
              <StationDetail {...detailProps(2, false)} onClose={() => undefined} />
            </div>
            <div className="min-w-0 max-w-[390px] rounded-card border border-line bg-surface">
              <StationDetail {...detailProps(3, true)} onClose={() => undefined} />
            </div>
          </div>
        </Section>

        <Section id="kit-hoja" title="Hoja inferior · tres alturas">
          <div className="map-sample relative h-[680px] w-full max-w-[390px]">
            <BottomSheet snap={snap} onSnapChange={setSnap} label="Resultados">
              <ul className="m-0 flex list-none flex-col gap-2.5 p-3">
                {CARD_SAMPLES.slice(0, 4).map((card) => (
                  <StationCard key={card.id} {...card} />
                ))}
              </ul>
            </BottomSheet>
          </div>
        </Section>

        <Section id="kit-estados" title="Estados">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface">
              <EmptyState
                title="No hay gasolineras en este radio"
                text="No encontramos ninguna a menos de 5 km. Amplía la zona y te mostramos las más cercanas."
                actions={<Button size="lg">Ampliar radio</Button>}
              />
            </div>
            <div className="rounded-card border border-line bg-surface">
              <ErrorState onRetry={() => undefined} />
            </div>
            <div className="rounded-card border border-line bg-surface">
              <PermissionPrompt />
            </div>
            <div className="flex flex-col gap-6">
              <div className="rounded-card border border-line bg-surface">
                <LocatingState />
              </div>
              <div className="rounded-card border border-line bg-surface">
                <PermissionDenied />
              </div>
            </div>
          </div>
          <OfflineBanner date="27/10/2026, 07:30" />
          <div className="rounded-card border border-line bg-surface">
            <StationDetailSkeleton />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ToastSample message="La búsqueda estará disponible muy pronto." />
            <StatCard label="Ahorras en un depósito de 50 L" value={123.45} />
            <Button variant="secondary" icon={<Heart width={18} height={18} aria-hidden />}>
              Con icono
            </Button>
            <Button icon={<Search width={18} height={18} aria-hidden />}>Buscar</Button>
          </div>
        </Section>
      </div>
    </>
  );
}
