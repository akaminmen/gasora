import {
  Clock,
  Download,
  Fuel,
  Info,
  Map as MapIcon,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PageColumn, PageHeader } from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';
import { pageMeta } from '../../lib/page-meta';
import { LogoMark, Wordmark } from '../../components/ui/Logo';
import { FUELS } from '../../lib/fuel-ids';
import { FUEL_LABELS } from '../../lib/fuels';
import { formatDateTime, formatPrice } from '../../lib/format';
import { useGasoraData } from '../../lib/useGasoraData';
import { usePwaStore } from '../../pwa/store';
import { LinkButton } from '../../components/ui/Button';

/** Instalar la app y versión (sirve para comprobar que una actualización ha llegado). */
function InstallCard() {
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
      {(installed || standalone) && <p className="mt-2 font-semibold">Ya la tienes instalada.</p>}
      <LinkButton
        to="/instalar"
        variant="secondary"
        className="mt-3"
        icon={<Download width={18} height={18} aria-hidden />}
      >
        Ver instrucciones
      </LinkButton>
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
  usePageMeta(pageMeta('acerca').title, pageMeta('acerca').description);
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
          <p className="mt-2" data-testid="about-date-note">
            Es la fecha de la consulta con la que se publicaron estos datos. Cuando una consulta no
            trae cambios, no se vuelve a publicar: la fecha puede ser anterior a la última
            comprobación.
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

        <InfoCard icon={<Scale width={20} height={20} aria-hidden />} title="Licencias de terceros">
          <p>
            Gasora usa software libre de terceros. Los avisos y los textos de sus licencias están en{' '}
            <a
              href={`${import.meta.env.BASE_URL}licencias-de-terceros.txt`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              data-testid="about-licenses"
            >
              licencias-de-terceros.txt
            </a>
            .
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

        <InfoCard icon={<ShieldCheck width={20} height={20} aria-hidden />} title="Privacidad">
          <div data-testid="about-privacy" className="space-y-2">
            <p>No usamos cookies, analítica, publicidad ni cuentas.</p>
            <p>
              <b>Lo que se guarda en tu dispositivo</b> (y no sale de él):
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>los códigos de tus favoritos (hasta 100);</li>
              <li>
                el combustible elegido, el tema claro u oscuro y los litros de la calculadora;
              </li>
              <li>
                una copia de la aplicación, de los últimos precios, de los logos y de las partes del
                mapa que has mirado, para abrirla sin conexión.
              </li>
            </ul>
            <p>
              <b>Tu ubicación</b> solo se usa en tu dispositivo para ordenar y medir distancias: no
              se envía a ningún servidor de Gasora ni se escribe en la dirección de la página. Si
              usas «Buscar en esta zona», la dirección sí incluye el centro del mapa, y quien reciba
              ese enlace verá ese punto.
            </p>
            <p>
              <b>Lo que sí reciben otros servidores:</b> el mapa se descarga de OpenFreeMap, que ve
              tu dirección IP y las teselas que pides, es decir, la zona que miras (será la tuya si
              centras el mapa en tu posición). La web está alojada en GitHub Pages, que ve tu
              dirección IP y tu navegador, como cualquier servidor. Al pulsar «Cómo llegar» se abre
              Google Maps, Apple Maps o Waze con las coordenadas de la gasolinera, y se rigen por su
              propia política.
            </p>
          </div>
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
