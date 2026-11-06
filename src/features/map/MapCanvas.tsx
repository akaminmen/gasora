import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite no copia el worker de MapLibre por sí solo: se importa como recurso y se indica su URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { LocateFixed, Minus, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PricePin, TierSymbol } from '../../components/ui/Station';
import { areaFromView, shouldOfferAreaSearch, type Circle, type ViewRect } from '../../lib/areas';
import { formatPriceNumber } from '../../lib/format';
import type { ResultItem } from '../../lib/resultset';
import { TIER_LABELS, TIERS, type Tier } from '../../lib/tiers';
import { choosePins } from './pins';

maplibregl.setWorkerUrl(workerUrl);

/** Estilos de OpenFreeMap (ADR 012): claro y oscuro según el tema. */
export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const SPAIN_CENTER: [number, number] = [-3.7, 40.4];

export interface MapInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapCanvasProps {
  items: readonly ResultItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Posición del usuario, si la búsqueda es «cerca de ti» */
  user: { lat: number; lng: number } | null;
  /** Punto de referencia cuando no hay resultados (centro del lugar buscado) */
  origin: { lat: number; lng: number };
  /** Cambia cuando hay que volver a encuadrar (lugar, radio, marcas); null = aún no */
  fitKey: string | null;
  theme: 'light' | 'dark';
  /** Zona del mapa tapada por otros elementos (hoja inferior, controles flotantes) */
  inset: MapInset;
  showLegend: boolean;
  onFailure: (message: string) => void;
  /** Zona que cubre la búsqueda activa; con ella se decide cuándo ofrecer «Buscar en esta zona» */
  region?: Circle | null;
  /** Se pulsó «Buscar en esta zona»: la zona visible (centro, radio y si el radio se recortó) */
  onSearchArea?: (area: Circle & { limited: boolean }) => void;
  /** Una persona empezó a mover el mapa (arrastrar, pellizcar, doble toque, rueda); nunca un encuadre programático */
  onUserGesture?: () => void;
  /** Una persona tocó una zona vacía del mapa (ni un pin, ni un grupo, ni el marcador del usuario) */
  onEmptyTap?: () => void;
}

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function tierColors(): Record<Tier, string> {
  return {
    cheap: cssVar('--tier-cheap-bg') || '#16a34a',
    mid: cssVar('--tier-mid-bg') || '#eab308',
    high: cssVar('--tier-high-bg') || '#f97316',
    top: cssVar('--tier-top-bg') || '#dc2626',
  };
}

function toGeoJson(items: readonly ResultItem[]) {
  return {
    type: 'FeatureCollection' as const,
    features: items.map((item) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [item.station.lng, item.station.lat] },
      properties: { id: item.station.id, tier: item.tier },
    })),
  };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Pin {
  id: string;
  el: HTMLDivElement;
}

/** Mapa MapLibre con OpenFreeMap. Se carga con import dinámico (ver MapPanel). */
export default function MapCanvas(props: MapCanvasProps) {
  const { items, selectedId, onSelect, user, origin, fitKey, theme, inset, showLegend } = props;
  const [offerArea, setOfferArea] = useState(false);
  /** Movimiento causado por los botones + / − : cuenta como gesto para ofrecer «Buscar en esta zona» */
  const controlMove = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const userMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinIds, setPinIds] = useState<string[]>([]);

  // Valores que los manejadores del mapa leen sin volver a crear el mapa
  const latest = useRef({
    items,
    selectedId,
    inset,
    theme,
    onFailure: props.onFailure,
    onSelect,
    region: props.region ?? null,
    onUserGesture: props.onUserGesture,
    onEmptyTap: props.onEmptyTap,
  });
  const byId = useMemo(() => new Map(items.map((i) => [i.station.id, i])), [items]);
  const byIdRef = useRef(byId);
  // Va antes que los demás efectos: los manejadores del mapa leen siempre lo último
  useEffect(() => {
    latest.current = {
      items,
      selectedId,
      inset,
      theme,
      onFailure: props.onFailure,
      onSelect,
      region: props.region ?? null,
      onUserGesture: props.onUserGesture,
      onEmptyTap: props.onEmptyTap,
    };
    byIdRef.current = byId;
  });

  /** Elige los pines: los de la vista que no están agrupados, los más relevantes primero. */
  const updatePins = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('points')) return;
    const visible = new Set<string>();
    for (const feature of map.queryRenderedFeatures({ layers: ['points'] })) {
      const id = feature.properties['id'];
      if (typeof id === 'string') visible.add(id);
    }
    const ranked = choosePins(visible, byIdRef.current, latest.current.selectedId);
    setPinIds((previous) =>
      previous.length === ranked.length && previous.every((id, i) => id === ranked[i])
        ? previous
        : ranked,
    );
  }, []);

  const addDataLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || map.getSource('stations')) return;
    const colors = tierColors();
    map.addSource('stations', {
      type: 'geojson',
      data: toGeoJson(latest.current.items),
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 12,
    });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'stations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': cssVar('--brand-500') || '#4f46e5',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 25, 200, 30],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'stations',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    });
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'stations',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match',
          ['get', 'tier'],
          'cheap',
          colors.cheap,
          'mid',
          colors.mid,
          'high',
          colors.high,
          colors.top,
        ],
        'circle-radius': 6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
  }, []);

  const padding = (extra = 0) => {
    const { inset: i } = latest.current;
    return {
      top: i.top + extra,
      right: i.right + extra,
      bottom: i.bottom + extra,
      left: i.left + extra,
    };
  };

  /** Rectángulo visible (sin las zonas tapadas por la hoja y los controles flotantes). */
  const visibleRect = useCallback((): ViewRect | null => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return null;
    const { inset: i } = latest.current;
    const topLeft = map.unproject([i.left, i.top]);
    const bottomRight = map.unproject([
      container.clientWidth - i.right,
      container.clientHeight - i.bottom,
    ]);
    return { north: topLeft.lat, west: topLeft.lng, south: bottomRight.lat, east: bottomRight.lng };
  }, []);

  /** ¿Hay que ofrecer «Buscar en esta zona»? Solo se llama al terminar un gesto. */
  const evaluateOffer = useCallback(() => {
    const { region, items: current } = latest.current;
    const view = visibleRect();
    if (!view || !region) return setOfferArea(false);
    const points = current.map((item) => ({ lat: item.station.lat, lng: item.station.lng }));
    setOfferArea(shouldOfferAreaSearch(view, region, points));
  }, [visibleRect]);

  // Crear el mapa una sola vez
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLES[latest.current.theme],
        center: SPAIN_CENTER,
        zoom: 5,
        minZoom: 3,
        maxZoom: 18,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        maxTileCacheZoomLevels: 2,
      });
    } catch (error) {
      latest.current.onFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    // La atribución de OpenFreeMap/OpenMapTiles/OpenStreetMap siempre visible, sin plegar
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
    map.on('style.load', () => {
      addDataLayers();
      setReady(true);
    });
    map.on('click', 'clusters', (event) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties['cluster_id'];
      const source = map.getSource('stations') as GeoJSONSource | undefined;
      if (typeof clusterId !== 'number' || !source || feature?.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: [lng, lat], zoom: zoom + 0.5, duration: reducedMotion() ? 0 : 350 });
      });
    });
    // Gestos de una persona (con evento original) frente a encuadres programáticos (sin él)
    map.on('movestart', (event) => {
      if (!(event as { originalEvent?: unknown }).originalEvent) return;
      setOfferArea(false);
      latest.current.onUserGesture?.();
    });
    map.on('moveend', (event) => {
      const user = Boolean((event as { originalEvent?: unknown }).originalEvent);
      if (!user && !controlMove.current) return;
      controlMove.current = false;
      evaluateOffer();
    });
    // Tocar una zona vacía (ni pin, ni grupo, ni el marcador del usuario)
    map.on('click', (event) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest('.map-pin-host, .maplibregl-marker')) return;
      if (map.queryRenderedFeatures(event.point, { layers: ['clusters', 'points'] }).length > 0) {
        return;
      }
      latest.current.onEmptyTap?.();
    });
    map.on('click', 'points', (event) => {
      const id = event.features?.[0]?.properties['id'];
      if (typeof id === 'string') latest.current.onSelect(id);
    });
    for (const layer of ['clusters', 'points']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    const publishView = () => {
      const center = map.getCenter();
      container.dataset['zoom'] = map.getZoom().toFixed(2);
      container.dataset['center'] = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    };
    map.on('moveend', publishView);
    map.on('moveend', updatePins);
    map.on('sourcedata', (event) => {
      if (event.sourceId === 'stations' && event.isSourceLoaded) updatePins();
    });
    let styleLoaded = false;
    map.once('style.load', () => (styleLoaded = true));
    map.on('error', (event) => {
      const message = String((event.error as Error | undefined)?.message ?? '');
      // Un error antes de cargar el estilo (sin red, servidor caído) o de WebGL: sin mapa
      if (!styleLoaded || /webgl/i.test(message)) latest.current.onFailure(message);
    });
    const markers = markersRef.current;
    return () => {
      for (const { marker } of markers.values()) marker.remove();
      markers.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
      setPins([]);
    };
  }, [addDataLayers, updatePins, evaluateOffer]);

  // Cambio de tema: otro estilo; las capas de datos se vuelven a añadir en `style.load`
  const appliedTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    map.setStyle(MAP_STYLES[theme]);
  }, [theme]);

  // Datos: el conjunto visible (el mapa nunca cambia el conjunto de resultados)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('stations') as GeoJSONSource | undefined)?.setData(toGeoJson(items));
  }, [items, ready]);

  // Encuadre al buscar / cambiar radio o marcas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || fitKey === null) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const item of latest.current.items) bounds.extend([item.station.lng, item.station.lat]);
    if (user) bounds.extend([user.lng, user.lat]);
    if (bounds.isEmpty()) {
      map.easeTo({ center: [origin.lng, origin.lat], zoom: 11, padding: padding(), duration: 0 });
    } else {
      map.fitBounds(bounds, {
        padding: padding(48),
        maxZoom: 15,
        duration: reducedMotion() ? 0 : 500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la clave de encuadre
  }, [fitKey, ready]);

  // Seleccionar centra el mapa en la estación (con un zoom en el que su pin es visible)
  useEffect(() => {
    const map = mapRef.current;
    const item = selectedId ? byId.get(selectedId) : undefined;
    if (!map || !ready || !item) return;
    // La ficha puede acabar de abrirse y haber cambiado el ancho del mapa: se mide antes de centrar
    map.resize();
    map.easeTo({
      center: [item.station.lng, item.station.lat],
      zoom: Math.max(map.getZoom(), 13),
      padding: padding(),
      duration: reducedMotion() ? 0 : 400,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la selección
  }, [selectedId, ready]);

  // Marcador de la posición del usuario
  useEffect(() => {
    const map = mapRef.current;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!map || !ready || !user) return;
    const el = document.createElement('div');
    el.className = 'user-dot';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Tu ubicación');
    el.innerHTML = '<span></span><span></span><b></b>';
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([user.lng, user.lat])
      .addTo(map);
  }, [user, ready]);

  // Pines HTML: se crean y se quitan al cambiar la lista de pines elegidos
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers = markersRef.current;
    for (const [id, entry] of markers) {
      if (!pinIds.includes(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
    for (const id of pinIds) {
      const item = byId.get(id);
      if (!item || markers.has(id)) continue;
      const el = document.createElement('div');
      el.className = 'map-pin-host';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 6] })
        .setLngLat([item.station.lng, item.station.lat])
        .addTo(map);
      markers.set(id, { marker, el });
    }
    setPins(pinIds.flatMap((id) => (markers.has(id) ? [{ id, el: markers.get(id)!.el }] : [])));
  }, [pinIds, ready, byId]);

  // Si cambia la zona buscada o los resultados con el botón a la vista, se vuelve a decidir
  useEffect(() => {
    if (offerArea) evaluateOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la zona o los resultados
  }, [props.region, items]);

  // Los datos cambian (filtros): se recalculan los pines
  useEffect(() => {
    if (ready) updatePins();
  }, [items, selectedId, ready, updatePins]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    controlMove.current = true;
    if (delta > 0) map.zoomIn({ duration: reducedMotion() ? 0 : 250 });
    else map.zoomOut({ duration: reducedMotion() ? 0 : 250 });
  };
  const searchHere = () => {
    const view = visibleRect();
    setOfferArea(false);
    if (view) props.onSearchArea?.(areaFromView(view));
  };
  const recenter = () => {
    const map = mapRef.current;
    if (!map || !user) return;
    map.easeTo({
      center: [user.lng, user.lat],
      zoom: Math.max(map.getZoom(), 13),
      padding: padding(),
      duration: reducedMotion() ? 0 : 400,
    });
  };

  return (
    <div className="map-host" style={{ ['--map-bottom-inset' as string]: `${inset.bottom}px` }}>
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label="Mapa de gasolineras. La lista tiene la misma información."
        data-testid="map"
        data-ready={ready ? 'true' : 'false'}
      />
      {pins.map(({ id, el }) => {
        const item = byId.get(id);
        if (!item) return null;
        return createPortal(
          <PricePin
            price={item.price}
            tier={item.tier}
            best={item.best}
            selected={id === selectedId}
            label={`${item.station.n}, ${formatPriceNumber(item.price)} euros el litro, precio ${TIER_LABELS[item.tier].toLowerCase()}${item.best ? ', la más barata' : ''}`}
            onClick={() => onSelect(id)}
          />,
          el,
          id,
        );
      })}
      {offerArea && props.onSearchArea && (
        <button
          type="button"
          className="map-search-area"
          style={{ top: inset.top + 8 }}
          onClick={searchHere}
          data-testid="search-area"
        >
          <Search width={18} height={18} aria-hidden />
          Buscar en esta zona
        </button>
      )}
      <div className="map-controls" style={{ top: inset.top + 8 }}>
        <button type="button" className="map-btn" aria-label="Acercar" onClick={() => zoomBy(1)}>
          <Plus width={20} height={20} aria-hidden />
        </button>
        <button type="button" className="map-btn" aria-label="Alejar" onClick={() => zoomBy(-1)}>
          <Minus width={20} height={20} aria-hidden />
        </button>
        {user && (
          <button
            type="button"
            className="map-btn text-link"
            aria-label="Centrar en mi ubicación"
            onClick={recenter}
          >
            <LocateFixed width={20} height={20} aria-hidden />
          </button>
        )}
      </div>
      {showLegend && (
        <ul className="map-legend" aria-label="Leyenda de precios">
          {TIERS.map((tier) => (
            <li key={tier}>
              <span className="tier" data-tier={tier} aria-hidden="true">
                <TierSymbol tier={tier} />
              </span>
              {TIER_LABELS[tier]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
