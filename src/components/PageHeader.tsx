import type { ReactNode } from 'react';

/** Columna centrada de ancho máximo ≈ 720 px para las pantallas secundarias (sección 9.8). */
export function PageColumn({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[720px] min-w-0 px-4 py-5 lg:py-8">{children}</div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4 min-w-0">
      <h1 className="font-display-800 text-[1.75rem] leading-tight">{title}</h1>
      {subtitle && <p className="text-[0.84rem] text-muted">{subtitle}</p>}
    </header>
  );
}
