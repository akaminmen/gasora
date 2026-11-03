import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-semibold whitespace-nowrap no-underline transition active:scale-[0.98]';
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-[26px] text-[0.9375rem]',
};
const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-on-brand shadow-[0_4px_14px_rgb(79_70_229/0.32)] hover:bg-brand-hover disabled:shadow-none',
  secondary: 'bg-surface text-ink border-line hover:bg-brand-50',
  ghost: 'bg-transparent text-link hover:bg-brand-50',
};
const disabled =
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:hover:bg-surface-2';

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${disabled} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

/** Enlace interno con aspecto de botón. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Botón de icono de 44×44 px (zona táctil mínima). */
export function IconButton({
  label,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-grid size-11 flex-none place-items-center rounded-full border-0 bg-transparent text-muted transition hover:bg-brand-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
