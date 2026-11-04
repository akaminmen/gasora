import darkMap from '../../assets/hero/hero-map-dark.webp';
import lightMap from '../../assets/hero/hero-map-light.webp';
import { PricePin } from '../../components/ui/Station';
import { StatCard } from '../../components/ui/Feedback';
import { BrandAvatar } from '../../components/ui/Station';
import { useUiStore } from '../../stores/ui';

/** Ilustración decorativa de la primera visita. Los importes son un ejemplo, no precios reales. */
export function HeroPreview() {
  const theme = useUiStore((s) => s.theme);
  return (
    <div className="map-sample h-[560px] rounded-[32px] shadow-raised">
      {/*
        Fondo: captura del mapa real (OpenFreeMap, Málaga), generada una vez con
        `npm run hero-map`. No carga MapLibre. Es diferida: la sección está oculta por debajo de lg.
      */}
      <img
        key={theme}
        src={theme === 'dark' ? darkMap : lightMap}
        alt=""
        width={600}
        height={560}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
        data-testid="hero-map"
      />
      <div className="absolute top-[56%] left-1/2 size-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-brand/25 bg-brand/10" />
      <div className="absolute top-[56%] left-1/2 size-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-brand/35 bg-brand/15" />
      <div
        className="radar absolute top-[56%] left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ '--radar-size': '80px' } as object}
      >
        <span />
        <span />
        <b className="size-[18px] rounded-full border-[3px] border-white bg-brand shadow-soft" />
      </div>
      <div className="absolute top-[26%] left-[30%]">
        <PricePin price={1359} tier="cheap" best label="Ejemplo" />
      </div>
      <div className="absolute top-[16%] left-[62%]">
        <PricePin price={1379} tier="cheap" label="Ejemplo" />
      </div>
      <div className="absolute top-[42%] left-[68%]">
        <PricePin price={1419} tier="mid" label="Ejemplo" />
      </div>
      <div className="absolute top-[68%] left-[20%]">
        <PricePin price={1489} tier="high" label="Ejemplo" />
      </div>
      <div className="absolute top-[78%] left-[66%]">
        <PricePin price={1529} tier="top" label="Ejemplo" />
      </div>
      <div className="absolute top-6 right-6 flex items-center gap-2.5 rounded-[18px] border border-line bg-surface py-2.5 pr-4 pl-2.5 shadow-soft">
        <BrandAvatar name="Ejemplo" brandKey="ejemplo" size={38} />
        <div className="min-w-0">
          <p className="text-sm font-bold whitespace-nowrap">Una gasolinera</p>
          <p className="text-xs whitespace-nowrap text-muted">a 0,9 km</p>
        </div>
      </div>
      <div className="absolute bottom-6 left-6">
        <StatCard label="Ahorras en un depósito de 50 L" value={3.69} />
      </div>
      <p className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-surface px-2 py-px text-[0.625rem] whitespace-nowrap text-muted">
        OpenFreeMap © OpenMapTiles Data from OpenStreetMap
      </p>
      <p className="absolute right-6 bottom-6 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-soft">
        Ejemplo ilustrativo
      </p>
    </div>
  );
}
