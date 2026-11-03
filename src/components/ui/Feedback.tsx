import { Check, Fuel, LocateFixed, MapPin, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { formatMoney } from '../../lib/format';
import { useToastStore } from '../../stores/toast';

export function Skeleton({ className = '', style }: { className?: string; style?: object }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Esqueleto de tarjeta: mismas medidas que StationCard para no provocar saltos de layout. */
export function StationCardSkeleton() {
  return (
    <li
      className="station-card-host list-none"
      aria-busy="true"
      aria-label="Cargando gasolinera"
      data-testid="station-card-skeleton"
    >
      <div className="station-card">
        <div className="station-card__avatar">
          <Skeleton className="size-11 rounded-full" />
        </div>
        <div className="station-card__info">
          <Skeleton className="h-[1.2rem] w-3/5" />
          <Skeleton className="mt-1 h-3.5 w-[85%]" />
          <Skeleton className="mt-1 h-3.5 w-1/2" />
        </div>
        <div className="station-card__price">
          <Skeleton className="h-6 w-[4.5rem]" />
          <Skeleton className="size-6 rounded-full" />
        </div>
        <div className="station-card__fav" aria-hidden="true">
          <span className="block size-11" />
        </div>
      </div>
    </li>
  );
}

export function StationDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-[18px] p-5"
      role="status"
      aria-busy="true"
      aria-label="Cargando ficha"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-[52px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-[18px] w-32" />
          <Skeleton className="mt-2 h-3 w-44" />
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-12 w-52" />
        <Skeleton className="mt-2.5 h-3 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}

/** Estado vacío / de error con ilustración, texto y acciones. */
function Message({
  icon,
  title,
  text,
  actions,
  role,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div
      role={role}
      className="mx-auto flex max-w-md min-w-0 flex-col items-center gap-3 px-7 py-8 text-center"
    >
      <div className="illustration mb-3">{icon}</div>
      <h2 className="font-display-800 text-[1.375rem] leading-tight">{title}</h2>
      <p className="text-[0.9375rem] leading-normal text-muted">{text}</p>
      {actions && <div className="mt-2 flex w-full flex-col items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon = <Fuel width={44} height={44} aria-hidden />,
  title,
  text,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  actions?: ReactNode;
}) {
  return <Message icon={icon} title={title} text={text} actions={actions} />;
}

export function ErrorState({
  title = 'No hemos podido cargar los precios',
  text = 'Parece que hay un problema con la conexión. Revísala e inténtalo de nuevo.',
  onRetry,
  actions,
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  return (
    <Message
      role="alert"
      icon={<WifiOff width={44} height={44} aria-hidden />}
      title={title}
      text={text}
      actions={
        <>
          <Button
            size="lg"
            icon={<RefreshCw width={18} height={18} aria-hidden />}
            onClick={onRetry}
          >
            Reintentar
          </Button>
          {actions}
        </>
      }
    />
  );
}

/** Aviso de datos sin conexión: dice de cuándo son los datos que se muestran. */
export function OfflineBanner({ date, onRetry }: { date: string; onRetry?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[0.8125rem] font-medium text-ink shadow-soft"
    >
      <WifiOff width={20} height={20} className="flex-none text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <b>Sin conexión:</b> mostrando datos del {date}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center border-0 bg-transparent px-2 font-bold text-link"
      >
        Reintentar
      </button>
    </div>
  );
}

/** Explicación previa al permiso de ubicación (sección 10 del plan). */
export function PermissionPrompt({
  onAllow,
  onDecline,
}: {
  onAllow?: () => void;
  onDecline?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md min-w-0 flex-col items-center gap-3.5 px-6 py-7 text-center">
      <div className="radar" style={{ '--radar-size': '168px' } as object} aria-hidden="true">
        <span />
        <span />
        <span />
        <div className="illustration bg-surface shadow-raised">
          <LocateFixed width={44} height={44} />
        </div>
      </div>
      <h2 className="font-display-800 text-[1.5rem] leading-tight">
        Encuentra la gasolina más barata a tu alrededor
      </h2>
      <p className="text-[0.9375rem] leading-normal text-muted">
        Gasora usa tu ubicación solo para mostrarte las gasolineras más cercanas y sus precios.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-left text-[0.9375rem]">
        <li className="flex items-center gap-3">
          <ShieldCheck width={20} height={20} className="flex-none text-muted" aria-hidden />
          No guardamos ni compartimos tu ubicación
        </li>
        <li className="flex items-center gap-3">
          <Check width={20} height={20} className="flex-none text-muted" aria-hidden />
          Sin registro ni cuenta
        </li>
      </ul>
      <Button
        size="lg"
        className="w-full"
        icon={<LocateFixed width={18} height={18} aria-hidden />}
        onClick={onAllow}
      >
        Permitir
      </Button>
      <Button variant="secondary" size="lg" className="w-full" onClick={onDecline}>
        Ahora no
      </Button>
    </div>
  );
}

/** «Buscando tu ubicación…» con el radar animado. */
export function LocatingState({ onSearchInstead }: { onSearchInstead?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md min-w-0 flex-col items-center gap-2 px-6 py-6 text-center">
      <div className="radar" style={{ '--radar-size': '96px' } as object} aria-hidden="true">
        <span />
        <span />
        <span />
        <LocateFixed width={32} height={32} className="text-link" />
      </div>
      <h2 className="font-display-800 text-xl" role="status">
        Buscando tu ubicación…
      </h2>
      <p className="text-sm text-muted">Un momento, vamos a localizar las gasolineras cercanas.</p>
      <Button variant="secondary" className="mt-2 w-full" onClick={onSearchInstead}>
        Buscar por ciudad o código postal
      </Button>
    </div>
  );
}

/** Permiso denegado: la alternativa es siempre el buscador. */
export function PermissionDenied({
  cities = ['Málaga', 'Madrid', 'Sevilla', 'Valencia', 'Barcelona'],
  onPickCity,
  onRetry,
}: {
  cities?: string[];
  onPickCity?: (city: string) => void;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md min-w-0 flex-col items-center gap-3.5 px-6 py-7 text-center">
      <div className="illustration mb-2">
        <MapPin width={44} height={44} aria-hidden />
      </div>
      <h2 className="font-display-800 text-[1.5rem] leading-tight">Sin problema, busca por zona</h2>
      <p className="text-[0.9375rem] leading-normal text-muted">
        No tenemos acceso a tu ubicación, pero puedes seguir con una ciudad o un código postal.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {cities.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => onPickCity?.(city)}
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-[0.8125rem] font-semibold text-ink hover:bg-brand-50"
          >
            {city}
          </button>
        ))}
      </div>
      <p className="text-[0.8125rem] text-muted">
        ¿Cambias de idea? Activa la ubicación en los ajustes del navegador y pulsa{' '}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center border-0 bg-transparent p-0 font-semibold text-link underline"
        >
          Reintentar
        </button>
        .
      </p>
    </div>
  );
}

/** Tarjeta de cifra (p. ej. ahorro por depósito). */
export function StatCard({
  label,
  value,
  unit = '€',
  icon = <Fuel width={26} height={26} aria-hidden />,
}: {
  label: string;
  value: number;
  unit?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-3.5 rounded-[20px] border border-line bg-surface py-3.5 pr-5 pl-3.5 shadow-soft">
      <span className="grid size-12 flex-none place-items-center rounded-[14px] bg-brand-100 text-link">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold text-muted">{label}</p>
        <p className="font-display text-[1.875rem] leading-[1.1] font-extrabold whitespace-nowrap tabular-nums">
          {formatMoney(value)} {unit}
        </p>
      </div>
    </div>
  );
}

/** Aviso temporal discreto. Se monta una vez en el shell. */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6"
    >
      {message && (
        <p className="pointer-events-auto max-w-sm rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg shadow-raised">
          {message}
        </p>
      )}
    </div>
  );
}

/** Versión estática del toast para la galería de componentes. */
export function ToastSample({ message }: { message: string }) {
  return (
    <p className="inline-block max-w-sm rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg shadow-raised">
      {message}
    </p>
  );
}
