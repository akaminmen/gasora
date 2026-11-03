import { Clock, MapPin, Navigation, Share2, X } from 'lucide-react';
import { buttonClass, Button, IconButton } from './Button';
import { BrandAvatar, FavoriteButton, TierPill } from './Station';
import { formatKm, formatMoney, formatPriceNumber } from '../../lib/format';
import type { FuelId } from '../../lib/data-schema';
import { FUEL_LABELS } from '../../lib/fuels';
import type { Tier } from '../../lib/tiers';

export interface DetailPrice {
  fuel: FuelId;
  /** milésimas de euro; null = no vende */
  price: number | null;
}

export interface StationDetailProps {
  name: string;
  brandKey: string;
  /** p. ej. «Estación de servicio · Málaga» */
  subtitle: string;
  fuel: FuelId;
  price: number;
  tier: Tier;
  /** Ahorro por depósito en euros (solo se muestra si es positivo) */
  saving?: number;
  liters?: number;
  address: string;
  postalCode: string;
  municipality: string;
  distanceKm?: number;
  prices: DetailPrice[];
  /** Horario tal cual lo da el Ministerio */
  hours: string;
  /** Fecha de la consulta ya formateada */
  dataDate: string;
  lat: number;
  lng: number;
  favorite: boolean;
  onToggleFavorite?: () => void;
  onClose?: () => void;
  onShare?: () => void;
  /** 2 columnas en el panel de escritorio, 3 en la hoja móvil */
  columns?: 2 | 3;
}

/** Enlaces de «Cómo llegar» (sección 6 del plan). */
export function directionLinks(lat: number, lng: number) {
  return [
    {
      label: 'Google Maps',
      href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    },
    { label: 'Apple Maps', href: `https://maps.apple.com/?daddr=${lat},${lng}` },
    { label: 'Waze', href: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
  ];
}

export function DirectionsMenu({ lat, lng }: { lat: number; lng: number }) {
  return (
    <details className="group relative flex-1">
      <summary
        className={`${buttonClass('primary', 'md', 'w-full list-none cursor-pointer')} [&::-webkit-details-marker]:hidden`}
      >
        <Navigation width={18} height={18} aria-hidden />
        Cómo llegar
      </summary>
      <ul className="absolute right-0 bottom-[calc(100%+8px)] left-0 z-20 m-0 list-none rounded-2xl border border-line bg-surface p-2 shadow-raised">
        {directionLinks(lat, lng).map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center rounded-xl px-3 text-[0.9375rem] font-medium text-ink no-underline hover:bg-brand-50"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Contenido de la ficha: panel lateral en escritorio y hoja en móvil. */
export function StationDetail(props: StationDetailProps) {
  const {
    name,
    brandKey,
    subtitle,
    fuel,
    price,
    tier,
    saving,
    liters = 50,
    address,
    postalCode,
    municipality,
    distanceKm,
    prices,
    hours,
    dataDate,
    lat,
    lng,
    favorite,
    columns = 2,
  } = props;
  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4 p-5" data-testid="station-detail">
      <div className="flex items-center gap-3">
        <BrandAvatar name={name} brandKey={brandKey} size={52} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display-800 truncate text-xl" title={name}>
            {name}
          </h2>
          <p className="truncate text-[0.8125rem] text-muted">{subtitle}</p>
        </div>
        <FavoriteButton active={favorite} onToggle={props.onToggleFavorite} name={name} />
        {props.onClose && (
          <IconButton label="Cerrar ficha" onClick={props.onClose}>
            <X width={20} height={20} aria-hidden />
          </IconButton>
        )}
      </div>

      <div>
        <p className="text-[0.8125rem] font-semibold text-muted">{FUEL_LABELS[fuel]}</p>
        <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
          <span
            className="font-display text-5xl leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap tabular-nums"
            data-testid="detail-price"
          >
            {formatPriceNumber(price)}
          </span>
          <span className="mb-1.5 font-semibold whitespace-nowrap text-muted">€/L</span>
          <span className="mb-2 ml-auto">
            <TierPill tier={tier} />
          </span>
        </div>
        {saving !== undefined && saving > 0 && (
          <p className="mt-1.5 text-[0.78rem] font-semibold text-link">
            Ahorras {formatMoney(saving)} € por depósito (depósito de {liters} L)
          </p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <MapPin width={20} height={20} className="mt-0.5 flex-none text-muted" aria-hidden />
        <div className="min-w-0">
          <b className="[overflow-wrap:anywhere]">{address}</b>
          <br />
          <span className="text-muted">
            {postalCode} {municipality}
            {distanceKm !== undefined ? ` · a ${formatKm(distanceKm)} de ti` : ''}
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-label="Precios de todos los combustibles"
        className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {prices.map((entry) => (
          <div
            key={entry.fuel}
            className={`min-w-0 rounded-xl border-[1.5px] px-3 py-2.5 ${
              entry.fuel === fuel ? 'border-brand bg-brand-50' : 'border-transparent bg-surface-2'
            }`}
          >
            <small className="block truncate text-[0.72rem] font-semibold text-muted">
              {FUEL_LABELS[entry.fuel]}
            </small>
            <b className="font-display text-lg font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums">
              {entry.price === null ? '—' : formatPriceNumber(entry.price)}
            </b>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3">
        <Clock width={20} height={20} className="mt-0.5 flex-none text-muted" aria-hidden />
        <b className="min-w-0 [overflow-wrap:anywhere]">{hours}</b>
      </div>
      <p className="text-xs text-muted">Datos del Ministerio consultados el {dataDate}</p>

      <div className="mt-auto flex flex-wrap gap-2">
        <DirectionsMenu lat={lat} lng={lng} />
        <Button
          variant="secondary"
          icon={<Share2 width={18} height={18} aria-hidden />}
          onClick={props.onShare}
        >
          Compartir
        </Button>
      </div>
    </div>
  );
}
