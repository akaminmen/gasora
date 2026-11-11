/** Icono: gota de marcador, surtidor y dos arcos concéntricos (el «radar»). */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={`flex-none ${className ?? ''}`}
    >
      <path
        d="M24 4c-7.7 0-14 6-14 13.6 0 9.2 11 20.4 13 22.3a1.4 1.4 0 0 0 2 0C27 38 38 26.8 38 17.6 38 10 31.7 4 24 4Z"
        fill="#4F46E5"
      />
      <rect x="18" y="10.5" width="9" height="13" rx="1.8" fill="white" />
      <rect x="19.8" y="12.5" width="5.4" height="3.6" rx=".9" fill="#4F46E5" />
      <path
        d="M27 15.2h2a1.3 1.3 0 0 1 1.3 1.3v4a1.2 1.2 0 0 0 2.4 0v-5.3l-2-2"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="16.5" y="23.6" width="12" height="1.7" rx=".85" fill="white" />
      <path
        d="M38.74 6.68A18 18 0 0 1 38.74 27.32M9.26 27.32A18 18 0 0 1 9.26 6.68"
        stroke="#4F46E5"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M42.02 4.38A22 22 0 0 1 42.02 29.62M5.98 29.62A22 22 0 0 1 5.98 4.38"
        stroke="#818CF8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wordmark «Gasora»: «Gas» en tinta y «ora» en color de marca (Plus Jakarta Sans ExtraBold). */
/** `fixed`: tamaño en px que no crece con el texto del sistema (el logotipo de la cabecera móvil). */
export function Wordmark({ size = 24, fixed = false }: { size?: number; fixed?: boolean }) {
  return (
    <span
      className="font-display leading-none font-extrabold tracking-[-0.03em]"
      style={{ fontSize: fixed ? `${size}px` : `${size / 16}rem` }}
    >
      <span className="text-ink">Gas</span>
      <span style={{ color: 'var(--brand-logo)' }}>ora</span>
    </span>
  );
}

export function Logo({
  markSize = 40,
  wordSize = 24,
  fixed = false,
}: {
  markSize?: number;
  wordSize?: number;
  fixed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={markSize} />
      <Wordmark size={wordSize} fixed={fixed} />
    </span>
  );
}
