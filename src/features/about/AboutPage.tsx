import {
  Clock,
  Download,
  Fuel,
  Info,
  Map as MapIcon,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PageColumn, PageHeader } from '../../components/PageHeader';
import { LogoMark, Wordmark } from '../../components/ui/Logo';
import { FUELS } from '../../lib/fuel-ids';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime, formatPrice } from '../../lib/format';
import { useGasoraData } from '../../lib/useGasoraData';
import { usePwaStore } from '../../pwa/store';
import { Button } from '../../components/ui/Button';

/** Instalar la app y versión (sirve para comprobar que una actualización ha llegado). */
function InstallCard() {
  const installEvent = usePwaStore((s) => s.installEvent);
  const installed = usePwaStore((s) => s.installed);
  const offlineReady = usePwaStore((s) => s.offlineReady);
  const standalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  return (
    <InfoCard icon={<Download width={20} height={20} aria-hidden />} title="Instalar la aplicación">
      <p>
        Gasora funciona como aplicación: se instala en el móvil o el ordenador y abre los últimos
        datos guardados aunque no haya conexión.
      </p>
      {installEvent && !installed && !standalone && (
        <Button
          className="mt-3"
          icon={<Download width={18} height={18} aria-hidden />}
          onClick={() => {
            void installEvent.prompt();
          }}
        >
          Instalar Gasora
        </Button>
      )}
      {(installed || standalone) && <p className="mt-2 font-semibold">Ya la tienes instalada.</p>}
      {!installEvent && !installed && !standalone && (
        <p className="mt-2 text-muted">
          En iPhone y iPad: Compartir → «Añadir a pantalla de inicio». En otros navegadores, busca
          «Instalar» en su menú.
        </p>
      )}
      <p className="mt-2 text-xs text-muted" data-testid="app-version">
        Versión {__APP_VERSION__} ({__APP_BUILD__}){offlineReady ? ' · lista sin conexión' : ''}
      </p>
    </InfoCard>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 gap-3.5 rounded-card border border-line bg-surface p-4 shadow-soft">
      <span className="grid size-10 flex-none place-items-center rounded-xl bg-brand-50 text-link">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-display-800 text-[0.97rem]">{title}</h2>
        <div className="mt-1 space-y-2 text-sm text-muted">{children}</div>
      </div>
    </section>
  );
}

/** Acerca de: fuente, fecha, aviso legal, privacidad y exclusiones (F10). */
export function AboutPage() {
  const { state } = useGasoraData({ defer: true });
  const data = state.status === 'ready' ? state.data : null;

  return (
    <PageColumn>
      <PageHeader title="Acerca de" />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-1 pb-2">
          <LogoMark size={52} />
          <div>
            <Wordmark size={26} />
            <p className="mt-1 text-[0.84rem] text-muted">La gasolina más barata, más cerca.</p>
          </div>
        </div>

        <InfoCard
          icon={<Fuel width={20} height={20} aria-hidden />}
          title="De dónde salen los datos"
        >
          <p>
            Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de
            carburantes en las gasolineras españolas (datos.gob.es).
          </p>
          <p>
            Solo se muestran las gasolineras de venta pública: se excluyen las de venta restringida
            (cooperativas, socios, flotas).
          </p>
        </InfoCard>

        <InfoCard icon={<Clock width={20} height={20} aria-hidden />} title="Fecha de los datos">
          <p data-testid="about-date">
            Datos del Ministerio consultados el{' '}
            <b className="text-ink tabular-nums">
              {data ? formatDateTime(data.meta.sourceDate) : '··/··/····, ··:··'}
            </b>
            .
          </p>
        </InfoCard>

        <InstallCard />

        <InfoCard icon={<MapIcon width={20} height={20} aria-hidden />} title="Mapa">
          <p data-testid="about-map">
            © OpenMapTiles, Data from OpenStreetMap, servido por{' '}
            <a
              href="https://openfreemap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenFreeMap
            </a>
            . La atribución también aparece en la esquina del propio mapa.
          </p>
        </InfoCard>

        <InfoCard
          icon={<TriangleAlert width={20} height={20} aria-hidden />}
          title="Los precios pueden variar"
        >
          <p>
            El precio final en el surtidor puede ser distinto del que ves aquí. Confírmalo antes de
            repostar.
          </p>
        </InfoCard>

        <InfoCard icon={<Info width={20} height={20} aria-hidden />} title="Proyecto independiente">
          <p>
            Gasora es un proyecto independiente, no afiliado ni respaldado por el Ministerio ni por
            ninguna marca de gasolineras.
          </p>
          <p className="mt-2" data-testid="about-logos">
            Los logos son marcas de sus respectivos propietarios y se muestran solo para identificar
            la estación; Gasora no está afiliada a ellas.
          </p>
        </InfoCard>

        <InfoCard
          icon={<ShieldCheck width={20} height={20} aria-hidden />}
          title="Sin cookies ni registro"
        >
          <p>
            No usamos cookies, ni analítica de terceros, ni te pedimos cuenta. Tus favoritos y
            preferencias (combustible, tema) se quedan en tu dispositivo. Tu ubicación nunca sale de
            él.
          </p>
        </InfoCard>

        <section
          className="min-w-0 rounded-card border border-line bg-surface p-4 shadow-soft"
          aria-labelledby="cobertura"
        >
          <h2 id="cobertura" className="font-display-800 text-[0.97rem]">
            Estaciones con precio
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="fuel-table">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 font-semibold">Combustible</th>
                  <th className="py-1 text-right font-semibold">Estaciones</th>
                  <th className="py-1 text-right font-semibold">Desde</th>
                </tr>
              </thead>
              <tbody>
                {FUELS.map((fuel, index) => {
                  const values = Object.values(data?.prices.p ?? {})
                    .map((row) => row[index])
                    .filter((v): v is number => typeof v === 'number');
                  return (
                    <tr key={fuel} className="border-t border-line">
                      <td className="py-1.5">{FUEL_LABELS[fuel]}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {data ? values.length.toLocaleString('es-ES') : '…'}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                        {data ? (values.length ? formatPrice(Math.min(...values)) : '—') : '…'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageColumn>
  );
}
