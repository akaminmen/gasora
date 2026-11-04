import { Crown, Heart, Minus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import brandFiles from 'virtual:brand-files';
import { logoFileFor } from '../../lib/brand-logos';
import { formatKm, formatMoney, formatPriceNumber } from '../../lib/format';
import { TIER_LABELS, TIER_SYMBOLS, type Tier } from '../../lib/tiers';

/** Inicial del rótulo real (los rótulos como «Nº 10.935» dan «N»). */
export function initialOf(name: string): string {
  return /[\p{L}\p{N}]/u.exec(name)?.[0].toUpperCase() ?? '·';
}

/** Variante de color estable (1–3) derivada de la marca, no del orden. */
export function avatarVariant(brandKey: string): 1 | 2 | 3 {
  let hash = 0;
  for (const char of brandKey) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ((hash % 3) + 1) as 1 | 2 | 3;
}

/** Avatar circular con la inicial de la marca: respaldo cuando no hay logo (ver BrandLogo). */
export function BrandAvatar({
  name,
  brandKey,
  size,
}: {
  name: string;
  brandKey: string;
  size?: number;
}) {
  return (
    <span
      className="brand-avatar"
      data-variant={avatarVariant(brandKey)}
      style={size ? ({ '--avatar-size': `${size}px`, fontSize: `${size * 0.42}px` } as object) : {}}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}

const AVAILABLE_LOGOS: ReadonlySet<string> = new Set(Object.keys(brandFiles));

/**
 * Icono de la estación: el logo de la marca si el usuario lo ha aportado (`public/brands/`, ADR 015)
 * y, si no, el avatar con la inicial. Cuadrado del tamaño del avatar, sobre fondo claro también en
 * el tema oscuro. `alt` vacío: el nombre ya aparece en texto. No se usa en los pines del mapa.
 */
export function BrandLogo({
  name,
  brandKey,
  size,
}: {
  name: string;
  brandKey: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const file = logoFileFor(brandKey, AVAILABLE_LOGOS);
  if (!file || failed) return <BrandAvatar name={name} brandKey={brandKey} size={size} />;
  const px = size ?? 44;
  return (
    <span
      className="brand-logo"
      style={size ? ({ '--avatar-size': `${size}px` } as object) : {}}
      data-brand={brandKey}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}brands/${file}?v=${brandFiles[file]}`}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** ▼ / — / ▲ dibujados en SVG: no dependen de que la fuente tenga el glifo. */
export function TierSymbol({ tier, size = 12 }: { tier: Tier; size?: number }) {
  const symbol = TIER_SYMBOLS[tier];
  if (symbol === 'dash') return <Minus width={size} height={size} strokeWidth={3} aria-hidden />;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d={symbol === 'down' ? 'M1.5 3.5h9L6 10z' : 'M1.5 8.5h9L6 2z'} fill="currentColor" />
    </svg>
  );
}

/** Círculo de 24 px del tramo; el texto accesible dice el tramo con palabras. */
export function TierCircle({ tier }: { tier: Tier }) {
  return (
    <span
      className="tier"
      data-tier={tier}
      role="img"
      aria-label={`Precio ${TIER_LABELS[tier].toLowerCase()}`}
    >
      <TierSymbol tier={tier} />
    </span>
  );
}

/** Etiqueta con símbolo y texto («▼ Barata»). */
export function TierPill({ tier }: { tier: Tier }) {
  return (
    <span className="tier-pill" data-tier={tier}>
      <TierSymbol tier={tier} size={11} />
      {TIER_LABELS[tier]}
    </span>
  );
}

export function BestBadge() {
  return (
    <span className="badge-best">
      <Crown width={12} height={12} aria-hidden />
      <span className="badge-best__text">Más barata</span>
    </span>
  );
}

export function FavoriteButton({
  active,
  onToggle,
  name,
}: {
  active: boolean;
  onToggle?: () => void;
  name?: string;
}) {
  const label = active
    ? `Quitar${name ? ` ${name}` : ''} de favoritos`
    : `Guardar${name ? ` ${name}` : ''} en favoritos`;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onToggle}
      className={`inline-grid size-11 flex-none place-items-center rounded-full border-0 bg-transparent transition hover:bg-brand-50 active:scale-90 ${
        active ? 'text-link' : 'text-muted'
      }`}
    >
      <Heart width={20} height={20} fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}

export interface StationCardProps {
  id: string;
  /** Rótulo real de la estación (nunca el grupo «Otras» del filtro). */
  name: string;
  brandKey: string;
  address: string;
  distanceKm?: number;
  /** Precio del combustible elegido, en milésimas de euro. */
  price: number;
  tier: Tier;
  /** Es la más barata del conjunto de resultados. */
  best?: boolean;
  /** Ahorro por depósito en euros; solo se muestra si es positivo. */
  saving?: number;
  selected?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onSelect?: () => void;
  /** Destino si la tarjeta es un enlace (por defecto, la ficha /e/:id). */
  to?: string;
}

/** Tarjeta de resultado. Estructura y reglas de la sección 9.7 del plan (anti-solape). */
export function StationCard({
  id,
  name,
  brandKey,
  address,
  distanceKm,
  price,
  tier,
  best,
  saving,
  selected,
  favorite = false,
  onToggleFavorite,
  onSelect,
  to,
}: StationCardProps) {
  const title = onSelect ? (
    <button type="button" className="station-card__link" onClick={onSelect} aria-pressed={selected}>
      {name}
    </button>
  ) : (
    <Link className="station-card__link" to={to ?? `/e/${id}`} aria-current={selected || undefined}>
      {name}
    </Link>
  );
  const hasMeta = distanceKm !== undefined || address;
  return (
    <li className="station-card-host list-none" data-station-id={id}>
      <article
        className="station-card"
        data-testid="station-card"
        data-selected={selected ? 'true' : 'false'}
      >
        <div className="station-card__avatar">
          <BrandLogo name={name} brandKey={brandKey} />
        </div>
        <div className="station-card__info">
          <h3 className="station-card__name" title={name}>
            {title}
          </h3>
          {best && <BestBadge />}
          {hasMeta && (
            <p className="station-card__meta">
              {distanceKm !== undefined && (
                <span className="station-card__dist">{formatKm(distanceKm)}</span>
              )}
              {distanceKm !== undefined && address && (
                <span className="station-card__sep"> · </span>
              )}
              {address && (
                <span className="station-card__addr" title={address}>
                  {address}
                </span>
              )}
            </p>
          )}
          {saving !== undefined && saving > 0 && (
            <p className="station-card__saving">Ahorras {formatMoney(saving)} € por depósito</p>
          )}
        </div>
        <div className="station-card__price">
          <span className="station-card__amount">
            <span className="station-card__value">{formatPriceNumber(price)}</span>
            <span className="station-card__unit">€/L</span>
          </span>
          <TierCircle tier={tier} />
        </div>
        <div className="station-card__fav">
          <FavoriteButton active={favorite} onToggle={onToggleFavorite} name={name} />
        </div>
      </article>
    </li>
  );
}

/** Pin de precio del mapa: se ensancha con el contenido, nunca recorta el precio. */
export function PricePin({
  price,
  tier,
  best,
  selected,
  label,
  onClick,
}: {
  price: number;
  tier: Tier;
  best?: boolean;
  selected?: boolean;
  label: string;
  /** Sin onClick el pin es decorativo (span no enfocable); con onClick es un botón de 44×44 px. */
  onClick?: () => void;
}) {
  const body = (
    <span className="price-pin__body" data-tier={tier} data-selected={selected ? 'true' : 'false'}>
      {best && (
        <span className="price-pin__crown" aria-hidden="true">
          <Crown width={11} height={11} />
        </span>
      )}
      <span data-testid="price-pin-text">{formatPriceNumber(price)} €</span>
      <TierSymbol tier={tier} size={11} />
    </span>
  );
  if (!onClick) {
    return (
      <span className="price-pin" data-testid="price-pin">
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="price-pin"
      data-testid="price-pin"
      aria-label={label}
      aria-pressed={selected ? true : undefined}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
