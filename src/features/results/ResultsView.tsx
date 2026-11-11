import { Expand, List, Map as MapIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BottomSheet, type SheetSnap } from '../../components/ui/BottomSheet';
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
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { searchedRegion, type Circle } from '../../lib/areas';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime, formatPrice } from '../../lib/format';
import {
  EXPANDED_MUNICIPALITY_KM,
  MAX_RADIUS_KM,
  hasOrigin,
  usesRadius,
  type Place,
} from '../../lib/place';
import { buildResultSet, type ResultItem, type ResultSet } from '../../lib/resultset';
import { useGasoraData } from '../../lib/useGasoraData';
import { useFooterHidden } from '../../lib/useFooterHidden';
import { useWhenIdle } from '../../lib/useWhenIdle';
import { useDataStore } from '../../stores/data';
import { MAX_LIST, useSearchStore } from '../../stores/search';
import { useUiStore } from '../../stores/ui';
import { MapPanel, MapPlaceholder } from '../map/MapPanel';
import { SearchBox } from '../search/SearchBox';
import { useFavoritesStore } from '../../stores/favorites';
import { DetailPanel } from './DetailPanel';

function title(place: Place): string {
  if (place.kind === 'area') return 'Gasolineras en esta zona del mapa';
  return place.kind === 'location' ? 'Gasolineras cerca de ti' : `Gasolineras en ${place.label}`;
}

/** Puede ampliarse: municipio sin ampliar, o búsqueda por radio por debajo del máximo. */
function canWiden(place: Place, radiusKm: number): boolean {
  if (place.kind === 'municipality' && !place.expanded) return true;
  return usesRadius(place) && radiusKm < MAX_RADIUS_KM;
}

const placeKey = (place: Place) =>
  `${place.kind}:${place.label}:${place.lat},${place.lng}:${'expanded' in place ? place.expanded : ''}`;

/** Resultados de la búsqueda activa: lista, mapa y ficha sincronizados. */
export function ResultsView({ place }: { place: Place }) {
  const { state, retry } = useGasoraData();
  const brandGroups = useDataStore((s) => s.brandGroups);
  const fuel = useUiStore((s) => s.fuel);
  const setFuel = useUiStore((s) => s.setFuel);
  const favorites = useFavoritesStore((s) => s.ids);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const mode = useLayoutMode();
  const { radiusKm, sort, brands, liters, limit, selectedId } = useSearchStore();
  const {
    setRadius,
    setSort,
    setBrands,
    showMore,
    widen,
    clearPlace,
    select,
    revealIndex,
    searchArea,
  } = useSearchStore.getState();
  const [snap, setSnap] = useState<SheetSnap>('mid');
  // Modo exploración (móvil): la hoja replegada a una línea mientras se explora el mapa
  // Replegada para una búsqueda y una selección concretas: otra búsqueda u otra estación la reabren
  const [collapsedAt, setCollapsedAt] = useState<string | null>(null);
  const currentKey = placeKey(place);
  const contextKey = `${currentKey}|${selectedId ?? ''}`;
  const collapsed = collapsedAt === contextKey;
  const setCollapsed = (value: boolean) => setCollapsedAt(value ? contextKey : null);
  // «Buscar en esta zona»: la búsqueda pendiente de anunciar y el aviso si el radio se recortó
  const pendingArea = useRef<{ limited: boolean } | null>(null);
  const [mapSearchKey, setMapSearchKey] = useState<string | null>(null);
  const [areaMsg, setAreaMsg] = useState<{ key: string; text: string; limited: boolean } | null>(
    null,
  );
  const [sheetHeight, setSheetHeight] = useState(0);
  const [floatingHeight, setFloatingHeight] = useState(124);
  const floatingRef = useRef<HTMLDivElement>(null);
  const onSheetHeight = useCallback((h: number) => setSheetHeight(h), []);

  const data = state.status === 'ready' ? state.data : null;
  const result = useMemo<ResultSet | null>(
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
  const selectedItem: ResultItem | undefined = useMemo(
    () => (selectedId ? result?.items.find((i) => i.station.id === selectedId) : undefined),
    [result, selectedId],
  );

  // Alto real del buscador y los chips flotantes (crece con el tamaño de letra del sistema)
  useEffect(() => {
    const el = floatingRef.current;
    if (!el) return;
    const measure = () => setFloatingHeight(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  // La pantalla de mapa en móvil ocupa todo el alto: el pie de página se consulta en «Acerca de»
  useEffect(() => {
    document.body.dataset['mapScreen'] = 'true';
    return () => {
      delete document.body.dataset['mapScreen'];
    };
  }, []);

  // Seleccionar (en el mapa o en la lista) lleva la lista hasta la tarjeta
  useEffect(() => {
    if (!selectedId || !result) return;
    const index = result.visible.findIndex((i) => i.station.id === selectedId);
    if (index >= 0) revealIndex(index);
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector(`[data-station-id="${CSS.escape(selectedId)}"]`);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, result, revealIndex, limit, mode]);

  const selectFromMap = useCallback(
    (id: string) => {
      select(id);
      setSnap((s) => (s === 'compact' ? 'mid' : s));
      setCollapsedAt(null);
    },
    [select],
  );

  const fuelLabel = FUEL_LABELS[fuel];
  // Zona que cubre la búsqueda (para decidir cuándo ofrecer «Buscar en esta zona»)
  const region = useMemo<Circle | null>(
    () =>
      result
        ? searchedRegion(
            place,
            radiusKm,
            result.items.map((i) => ({ lat: i.station.lat, lng: i.station.lng })),
          )
        : null,
    [result, place, radiusKm],
  );
  const searchHere = useCallback(
    (area: Circle & { limited: boolean }) => {
      const origin =
        place.kind === 'location'
          ? { lat: place.lat, lng: place.lng }
          : place.kind === 'area'
            ? place.origin
            : undefined;
      const next: Place = {
        kind: 'area',
        label: 'Zona del mapa',
        lat: area.lat,
        lng: area.lng,
        ...(origin ? { origin } : {}),
      };
      pendingArea.current = { limited: area.limited };
      setMapSearchKey(placeKey(next)); // el mapa se queda donde está: no se vuelve a encuadrar
      setSnap('compact');
      searchArea(next, area.radiusKm);
    },
    [place, searchArea],
  );

  const widenLabel =
    place.kind === 'municipality' && !place.expanded
      ? `Ampliar a ${EXPANDED_MUNICIPALITY_KM} km`
      : 'Ampliar radio';

  const summary = result
    ? result.stats
      ? `${result.items.length.toLocaleString('es-ES')} ${
          result.items.length === 1 ? 'gasolinera' : 'gasolineras'
        } con ${fuelLabel} · media ${formatPrice(Math.round(result.stats.mean))}`
      : `Sin gasolineras con ${fuelLabel}`
    : 'Buscando…';

  // Tras «Buscar en esta zona»: lista arriba y aviso educado con el número de gasolineras
  useEffect(() => {
    const pending = pendingArea.current;
    if (!pending || !result || place.kind !== 'area') return;
    pendingArea.current = null;
    const n = result.visible.length;
    setAreaMsg({
      key: `${currentKey}|${radiusKm}|${fuel}`,
      text: `${n.toLocaleString('es-ES')} ${n === 1 ? 'gasolinera' : 'gasolineras'} en esta zona`,
      limited: pending.limited,
    });
    document
      .querySelector('[data-testid="list-scroll"], [data-testid="sheet-content"]')
      ?.scrollTo({ top: 0 });
  }, [result, place, currentKey, radiusKm, fuel]);
  const areaNow = areaMsg && areaMsg.key === `${currentKey}|${radiusKm}|${fuel}` ? areaMsg : null;
  const areaNote =
    areaNow?.limited && place.kind === 'area' ? (
      <p
        className="mb-3 rounded-card border border-line bg-surface p-3 text-sm text-muted"
        data-testid="area-limited"
      >
        Acerca el mapa para ver todas las gasolineras de la zona.
      </p>
    ) : null;

  // Aviso para lectores de pantalla cuando llegan los resultados o cambian (combustible, radio…)
  const announcement = (
    <p className="sr-only" role="status" data-testid="results-announcement">
      {result
        ? areaNow
          ? `${areaNow.text}.${areaNow.limited ? ' Acerca el mapa para ver todas las gasolineras de la zona.' : ''}`
          : `${title(place)}. ${summary}`
        : ''}
    </p>
  );

  // En móvil la cabecera de la hoja ya lleva el selector de orden: aquí no se repite
  const controls = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {usesRadius(place) && (
        <div className="min-w-[14rem] flex-1">
          <RadiusSlider value={radiusKm} onChange={setRadius} />
        </div>
      )}
      {hasOrigin(place) && mode !== 'mobile' && <SortControl value={sort} onChange={setSort} />}
      {result && result.brands.length > 1 && (
        <BrandMultiSelect
          options={result.brands}
          selected={brands}
          onChange={setBrands}
          modal={mode === 'mobile'}
        />
      )}
      {place.kind === 'municipality' && !place.expanded && (
        <Button variant="secondary" onClick={widen}>
          {widenLabel}
        </Button>
      )}
    </div>
  );

  let list: ReactNode;
  if (state.status === 'error') {
    list = <ErrorState text={state.message} onRetry={retry} />;
  } else if (!result || !data) {
    list = (
      <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="list-none">
            <StationCardSkeleton />
          </li>
        ))}
      </ul>
    );
  } else if (result.items.length === 0) {
    list = (
      <EmptyState
        title="No encontramos gasolineras aquí"
        text={
          place.kind === 'area'
            ? `Aleja el mapa o prueba otra zona. Ninguna gasolinera de esta zona vende ${fuelLabel}.`
            : `Ninguna gasolinera de esta zona vende ${fuelLabel}. Prueba con otro combustible o con una zona más amplia.`
        }
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
    list = (
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
    list = (
      <>
        <ul
          data-testid="results-list"
          className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0"
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
              selected={item.station.id === selectedId}
              onSelect={() => selectFromMap(item.station.id)}
              favorite={favorites.includes(item.station.id)}
              onToggleFavorite={() => toggleFavorite(item.station.id)}
            />
          ))}
        </ul>
        {result.visible.length > shown.length &&
          (limit < MAX_LIST ? (
            <Button variant="secondary" size="lg" className="mx-auto mt-3" onClick={showMore}>
              Ver más
            </Button>
          ) : (
            <p className="mt-3 text-center text-sm text-muted">
              Mostramos las {MAX_LIST} primeras. Afina la búsqueda para ver el resto.
            </p>
          ))}
      </>
    );
  }

  const detail = (columns: 2 | 3) =>
    selectedItem && data ? (
      <DetailPanel
        item={selectedItem}
        fuel={fuel}
        prices={data.prices.p}
        meta={data.meta}
        liters={liters}
        columns={columns}
        onClose={() => select(null)}
      />
    ) : null;

  const user =
    place.kind === 'location'
      ? { lat: place.lat, lng: place.lng }
      : place.kind === 'area' && place.origin
        ? place.origin
        : null;
  const fitKey =
    result && !(place.kind === 'area' && mapSearchKey === currentKey)
      ? `${placeKey(place)}|${usesRadius(place) ? radiusKm : ''}|${brands.join(',')}`
      : null;
  const offline = data?.fromCache ? (
    <OfflineBanner date={formatDateTime(data.meta.sourceDate)} onRetry={retry} />
  ) : null;
  // El código del mapa (≈ 1,1 MB) no se pide hasta que hay resultados y el navegador está libre
  const mapReady = useWhenIdle(result !== null);
  // Hasta que llegan los datos el pie no se ve: así no se desplaza al pintarse la lista
  useFooterHidden(state.status === 'loading');
  const map = (inset: { top: number; right: number; bottom: number; left: number }) =>
    !mapReady ? (
      <MapPlaceholder />
    ) : (
      <MapPanel
        items={result?.visible ?? []}
        selectedId={selectedId}
        onSelect={selectFromMap}
        user={user}
        origin={{ lat: place.lat, lng: place.lng }}
        fitKey={fitKey}
        inset={inset}
        showLegend={mode !== 'mobile'}
        region={region}
        onSearchArea={searchHere}
        {...(mode === 'mobile'
          ? { onUserGesture: () => setCollapsed(true), onEmptyTap: () => setCollapsed(true) }
          : {})}
      />
    );

  // ---------- Móvil: mapa a pantalla casi completa + hoja inferior de tres alturas ----------
  if (mode === 'mobile') {
    const minPrice = result?.stats ? formatPrice(result.stats.min) : null;
    const header = selectedItem ? undefined : (
      <div className="flex flex-col gap-2 px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="font-display-800 text-[1.0625rem] leading-tight"
              data-testid="sheet-count"
            >
              {result ? `${result.items.length.toLocaleString('es-ES')} gasolineras` : 'Buscando…'}
            </p>
            <p className="text-[0.78rem] text-muted" data-testid="results-summary">
              {minPrice ? `Desde ${minPrice}` : fuelLabel}
              {usesRadius(place) ? ` · radio ${radiusKm} km` : ''}
            </p>
          </div>
          {hasOrigin(place) && <SortControl value={sort} onChange={setSort} />}
        </div>
        {snap === 'full' && controls}
      </div>
    );
    return (
      <section
        aria-label="Resultados"
        className="relative h-[calc(100dvh-4rem-72px-var(--top-strips,0px))] overflow-hidden"
        data-testid="results-mobile"
      >
        <h1 id="results-title" data-testid="results-title" className="sr-only">
          {title(place)}
        </h1>
        {announcement}
        <div className="absolute inset-0">
          {map({ top: floatingHeight, right: 0, bottom: sheetHeight, left: 0 })}
        </div>
        <div
          ref={floatingRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3"
        >
          <div className="pointer-events-auto">
            <SearchBox size="compact" />
          </div>
          <div className="pointer-events-auto -mx-3 px-3">
            <FuelChips value={fuel} onChange={setFuel} />
          </div>
        </div>
        {/* Con la hoja expandida el botón queda abajo, sobre la lista: encima de la hoja taparía los chips */}
        <div
          className="absolute right-3 z-20"
          style={{ bottom: snap === 'full' && !collapsed ? 12 : sheetHeight + 12 }}
        >
          <Button
            icon={
              snap === 'full' && !collapsed ? (
                <MapIcon width={18} height={18} aria-hidden />
              ) : (
                <List width={18} height={18} aria-hidden />
              )
            }
            onClick={() => {
              setCollapsed(false);
              setSnap(snap === 'full' && !collapsed ? 'compact' : 'full');
            }}
            data-testid="sheet-toggle"
          >
            {snap === 'full' && !collapsed ? 'Mapa' : 'Lista'}
          </Button>
        </div>
        <BottomSheet
          snap={snap}
          onSnapChange={setSnap}
          label="Gasolineras"
          header={header}
          onHeightChange={onSheetHeight}
          topReserve={floatingHeight + 8}
          collapsed={collapsed}
          collapsedLabel={`Mostrar lista de gasolineras${result ? ` (${result.visible.length})` : ''}`}
          onExpand={() => setCollapsed(false)}
        >
          {offline && <div className="px-3 pb-2">{offline}</div>}
          {selectedItem ? (
            detail(3)
          ) : (
            <div className={`px-3 ${snap === 'full' ? 'pb-20' : 'pb-4'}`}>
              {areaNote}
              {list}
              <div className="mt-3 flex justify-center">
                <Button variant="ghost" onClick={clearPlace} data-testid="clear-search">
                  Borrar búsqueda
                </Button>
              </div>
            </div>
          )}
        </BottomSheet>
      </section>
    );
  }

  // ---------- Tablet y escritorio: lista · mapa · ficha ----------
  const desktop = mode === 'desktop';
  return (
    <section
      aria-label="Resultados"
      className="flex h-[calc(100dvh-4rem-var(--top-strips,0px))] min-h-[560px] flex-col"
      data-testid="results-desktop"
    >
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 lg:px-6">
        <div className="w-full max-w-[460px] min-w-[16rem] flex-1">
          <SearchBox size="compact" />
        </div>
        <div className="min-w-0 flex-1">
          <FuelChips value={fuel} onChange={setFuel} />
        </div>
      </div>
      {announcement}
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Lista de gasolineras"
          className={`flex min-w-0 flex-none flex-col border-r border-line bg-bg ${
            desktop ? 'w-[400px]' : 'w-[340px]'
          }`}
        >
          <div className="flex flex-none flex-col gap-3 px-4 pt-4 pb-3">
            {offline}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1
                  id="results-title"
                  data-testid="results-title"
                  className="font-display-800 text-[1.125rem] leading-tight"
                >
                  {title(place)}
                </h1>
                <p data-testid="results-summary" className="mt-1 text-[0.8125rem] text-muted">
                  {summary}
                </p>
              </div>
              <Button
                variant="ghost"
                icon={<X width={18} height={18} aria-hidden />}
                onClick={clearPlace}
                data-testid="clear-search"
                className="flex-none"
              >
                Borrar búsqueda
              </Button>
            </div>
            {controls}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5" data-testid="list-scroll">
            {areaNote}
            {list}
          </div>
        </aside>
        <div className="relative min-w-0 flex-1">
          {map({ top: 0, right: desktop || !selectedItem ? 0 : 360, bottom: 0, left: 0 })}
          {!desktop && selectedItem && (
            <aside
              aria-label="Ficha de la gasolinera"
              className="absolute inset-y-0 right-0 z-10 w-[360px] max-w-full overflow-y-auto border-l border-line bg-surface shadow-raised"
            >
              {detail(2)}
            </aside>
          )}
        </div>
        {desktop && selectedItem && (
          <aside
            aria-label="Ficha de la gasolinera"
            className="w-[360px] flex-none overflow-y-auto border-l border-line bg-surface"
          >
            {detail(2)}
          </aside>
        )}
      </div>
    </section>
  );
}
