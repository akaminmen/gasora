import { Calculator, Download, Heart, House, Info } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DataUpdateStrip } from '../components/DataUpdateStrip';
import { PwaBanners } from '../components/PwaBanners';
import { Logo } from '../components/ui/Logo';
import { SearchBox } from '../features/search/SearchBox';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ToastHost } from '../components/ui/Feedback';
import { formatDateTime } from '../lib/format';
import { useGasoraData } from '../lib/useGasoraData';
import { useStandalone } from '../pwa/platform';

const DESKTOP_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/favoritos', label: 'Favoritos' },
  { to: '/calculadora', label: 'Calculadora' },
  { to: '/acerca', label: 'Acerca de' },
];

const MOBILE_LINKS = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
  { to: '/calculadora', label: 'Calculadora', icon: Calculator },
];

function Footer() {
  const { state } = useGasoraData({ defer: true });
  const date = state.status === 'ready' ? formatDateTime(state.data.meta.sourceDate) : null;
  return (
    <footer className="mx-auto w-full max-w-[1100px] flex-none px-4 pt-6 pb-28 text-xs text-muted lg:px-6 lg:pb-6">
      <p>
        Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de
        carburantes en las gasolineras españolas (datos.gob.es). Datos consultados el{' '}
        {/* Reserva el ancho de la fecha: al llegar los datos el pie no cambia de alto */}
        <span className="inline-block min-w-[9.5em] tabular-nums">
          {date ?? '··/··/····, ··:··'}
        </span>
        .
      </p>
      <p className="mt-1">
        Gasora es un proyecto independiente, no afiliado ni respaldado por el Ministerio. Los
        precios pueden diferir de los del surtidor.{' '}
        <Link to="/acerca" className="inline-flex min-h-11 items-center font-semibold">
          Más sobre los datos y el aviso legal
        </Link>
      </p>
    </footer>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const mainRef = useRef<HTMLElement>(null);
  const stripsRef = useRef<HTMLDivElement>(null);
  const standalone = useStandalone();

  // Alto de las franjas bajo la cabecera («Sin conexión», «Hay precios nuevos»): las pantallas de alto
  // fijo (resultados) lo descuentan para no desbordar
  useLayoutEffect(() => {
    const el = stripsRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--top-strips', `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--top-strips');
    };
  }, []);
  const firstRender = useRef(true);

  // Al cambiar de pantalla el foco pasa al contenido (lectores de pantalla y teclado)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app-root flex flex-col">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-brand text-on-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 flex h-16 flex-none items-center gap-1.5 border-b border-line bg-surface px-3 sm:gap-4 sm:px-4 lg:px-6">
        <Link
          to="/"
          aria-label="Gasora, ir al inicio"
          className="inline-flex min-h-11 items-center no-underline"
        >
          <Logo markSize={36} wordSize={24} fixed />
        </Link>
        {!isHome && (
          <div className="hidden max-w-[460px] flex-1 lg:block">
            <SearchBox size="compact" />
          </div>
        )}
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 lg:flex">
          {DESKTOP_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold no-underline hover:bg-brand-50 ${
                  isActive ? 'bg-brand-50 text-link' : 'text-muted'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {!standalone && (
            <Link
              to="/instalar"
              aria-label="Instalar la aplicación"
              data-testid="header-install"
              className="inline-grid size-[44px] place-items-center rounded-full text-muted hover:bg-brand-50 sm:hidden"
            >
              <Download width={20} height={20} aria-hidden />
            </Link>
          )}
          <Link
            to="/acerca"
            aria-label="Acerca de Gasora"
            className="inline-grid size-[44px] place-items-center rounded-full text-muted hover:bg-brand-50 lg:hidden"
          >
            <Info width={20} height={20} aria-hidden />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div ref={stripsRef} data-testid="top-strips">
        <PwaBanners />
        <DataUpdateStrip />
      </div>
      <main id="contenido" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] border-t border-line bg-surface lg:hidden"
      >
        {MOBILE_LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold no-underline ${
                isActive ? 'text-link' : 'text-muted'
              }`
            }
          >
            <Icon width={24} height={24} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}
