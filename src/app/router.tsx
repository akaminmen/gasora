import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';
import { AppShell } from './AppShell';

// Cada pantalla secundaria va en su propio trozo: el inicio carga solo lo suyo.
const AboutPage = lazy(() =>
  import('../features/about/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const CalculatorPage = lazy(() =>
  import('../features/calculator/CalculatorPage').then((m) => ({ default: m.CalculatorPage })),
);
const FavoritesPage = lazy(() =>
  import('../features/favorites/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
);
const StationPage = lazy(() =>
  import('../features/station/StationPage').then((m) => ({ default: m.StationPage })),
);

function Loading() {
  // Mientras llega el trozo de la pantalla el pie se oculta: así no «salta» al aparecer el contenido
  useEffect(() => {
    document.body.dataset['routeLoading'] = 'true';
    return () => {
      delete document.body.dataset['routeLoading'];
    };
  }, []);
  return (
    <div className="min-h-[40dvh]">
      <p role="status" className="p-6 text-sm text-muted">
        Cargando…
      </p>
    </div>
  );
}

// /ui-kit es solo para desarrollo (y para los tests, con `vite build --mode e2e`).
const showUiKit = import.meta.env.DEV || import.meta.env.VITE_UI_KIT === 'true';
const UiKitPage = showUiKit ? lazy(() => import('../features/ui-kit/UiKitPage')) : null;

export function AppRouter() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route
            path="e/:id"
            element={
              <Suspense fallback={<Loading />}>
                <StationPage />
              </Suspense>
            }
          />
          <Route
            path="favoritos"
            element={
              <Suspense fallback={<Loading />}>
                <FavoritesPage />
              </Suspense>
            }
          />
          <Route
            path="calculadora"
            element={
              <Suspense fallback={<Loading />}>
                <CalculatorPage />
              </Suspense>
            }
          />
          <Route
            path="acerca"
            element={
              <Suspense fallback={<Loading />}>
                <AboutPage />
              </Suspense>
            }
          />
          {UiKitPage && (
            <Route
              path="ui-kit"
              element={
                <Suspense fallback={<p className="p-6">Cargando galería…</p>}>
                  <UiKitPage />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
