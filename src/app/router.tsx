import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AboutPage } from '../features/about/AboutPage';
import { CalculatorPage } from '../features/calculator/CalculatorPage';
import { FavoritesPage } from '../features/favorites/FavoritesPage';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';
import { StationPage } from '../features/station/StationPage';
import { AppShell } from './AppShell';

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
          <Route path="e/:id" element={<StationPage />} />
          <Route path="favoritos" element={<FavoritesPage />} />
          <Route path="calculadora" element={<CalculatorPage />} />
          <Route path="acerca" element={<AboutPage />} />
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
