import { Download, Laptop, Smartphone, Tablet } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageColumn, PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  useDetectedPlatform,
  useStandalone,
  type BrowserId,
  type Device,
} from '../../pwa/platform';
import { usePwaStore } from '../../pwa/store';

/**
 * Cómo instalar Gasora. Los pasos salen de la documentación oficial de cada navegador (consultada
 * el 11/11/2026; fuentes en docs/fuentes-instalacion.md). El dispositivo detectado solo se destaca:
 * todas las secciones quedan visibles.
 */
export const INSTALL_TITLE = 'Instalar Gasora';
export const INSTALL_DESCRIPTION =
  'Cómo instalar Gasora en el iPhone, iPad, Android y el ordenador: pasos para Safari, Chrome, Edge, Samsung Internet y Firefox.';

function Browser({
  id,
  current,
  title,
  children,
}: {
  id: string;
  current: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div data-testid={`install-browser-${id}`} data-current={current ? 'true' : 'false'}>
      <h3 className="text-[1rem] font-bold">
        {title}
        {current && (
          <span className="ml-2 rounded-full bg-brand-50 px-2.5 py-0.5 align-middle text-[0.75rem] font-semibold text-link">
            Tu navegador
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-1.5 ml-5 list-decimal space-y-1.5 marker:font-semibold">{children}</ol>;
}

function DeviceSection({
  id,
  current,
  icon,
  title,
  children,
}: {
  id: Device;
  current: boolean;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`install-${id}`}
      data-testid={`install-${id}`}
      data-current={current ? 'true' : 'false'}
      className={`rounded-2xl border bg-surface p-4 shadow-soft ${
        current ? 'border-brand ring-2 ring-brand-100' : 'border-line'
      }`}
    >
      <h2
        id={`install-${id}`}
        className="flex flex-wrap items-center gap-2 text-[1.125rem] font-bold"
      >
        <span className="text-link">{icon}</span>
        {title}
        {current && (
          <span
            data-testid="install-current-badge"
            className="rounded-full bg-brand px-2.5 py-0.5 text-[0.75rem] font-semibold text-on-brand"
          >
            Parece el tuyo
          </span>
        )}
      </h2>
      <div className="mt-3 space-y-4 text-[0.9375rem]">{children}</div>
    </section>
  );
}

export function InstallPage() {
  usePageMeta(INSTALL_TITLE, INSTALL_DESCRIPTION);
  const platform = useDetectedPlatform();
  const standalone = useStandalone();
  const installEvent = usePwaStore((s) => s.installEvent);
  const installed = usePwaStore((s) => s.installed);
  const is = (device: Device, browser?: BrowserId) =>
    platform.device === device && (browser === undefined || platform.browser === browser);

  return (
    <PageColumn>
      <PageHeader
        title={INSTALL_TITLE}
        subtitle="Gasora en la pantalla de inicio, sin tiendas de aplicaciones"
      />

      <div className="space-y-4 text-[0.9375rem] break-words">
        <p>
          Instalar Gasora es añadir un acceso directo a la web en la pantalla de inicio o en el
          escritorio: se abre en su propia ventana, sin la barra del navegador. No pasa por ninguna
          tienda de aplicaciones, no necesita cuenta y ocupa muy poco espacio.
        </p>
        <p>
          <b>No es una aplicación nativa</b>: es la misma web. Sin conexión abre los últimos precios
          guardados en ese dispositivo y avisa de que pueden no estar al día; del mapa solo se ven
          las zonas que ya habías mirado. Los favoritos y los ajustes se guardan en cada
          dispositivo, y una copia instalada desde otro navegador no comparte datos con las demás.
        </p>

        {(installed || standalone) && (
          <p
            role="status"
            data-testid="install-already"
            className="rounded-xl bg-brand-50 p-3 font-semibold"
          >
            Ya tienes Gasora instalada en este dispositivo.
          </p>
        )}
        {installEvent && !installed && !standalone && (
          <div data-testid="install-now">
            <Button
              size="lg"
              icon={<Download width={18} height={18} aria-hidden />}
              onClick={() => {
                void installEvent.prompt();
              }}
            >
              Instalar ahora
            </Button>
            <p className="mt-1.5 text-[0.8125rem] text-muted">
              Tu navegador permite instalarla desde aquí. Si prefieres, también tienes los pasos
              manuales más abajo.
            </p>
          </div>
        )}

        <DeviceSection
          id="ios"
          current={is('ios')}
          icon={<Smartphone width={22} height={22} aria-hidden />}
          title="iPhone y iPad"
        >
          <Browser id="ios-safari" current={is('ios', 'safari')} title="Safari">
            <Steps>
              <li>Abre gasora.es en Safari.</li>
              <li>
                Toca el botón <b>Compartir</b>. Según cómo tengas la barra de pestañas, puede estar
                dentro del menú de página (⋯).
              </li>
              <li>
                Baja por la lista y toca <b>Añadir a pantalla de inicio</b>. Si no aparece, baja
                hasta el final, toca <b>Editar acciones</b> y añádela.
              </li>
              <li>
                Toca <b>Añadir</b>.
              </li>
            </Steps>
          </Browser>
          <Browser
            id="ios-other"
            current={is('ios') && !is('ios', 'safari')}
            title="Otros navegadores en iOS"
          >
            <p className="mt-1.5">
              Desde iOS y iPadOS 16.4, los navegadores de terceros pueden ofrecer «Añadir a pantalla
              de inicio» en su menú de compartir, pero solo si su desarrollador lo ha activado.
              Antes solo Safari podía. Si tu navegador no lo ofrece, abre gasora.es en Safari y
              sigue los pasos de arriba.
            </p>
          </Browser>
          <p className="text-[0.8125rem] text-muted">
            En iOS no existe un botón de instalar dentro de la web: la instalación siempre se hace
            desde el menú de compartir.
          </p>
        </DeviceSection>

        <DeviceSection
          id="android"
          current={is('android')}
          icon={<Tablet width={22} height={22} aria-hidden />}
          title="Android"
        >
          <Browser id="android-chrome" current={is('android', 'chrome')} title="Chrome">
            <Steps>
              <li>Abre gasora.es en Chrome.</li>
              <li>
                Toca <b>Más</b> (⋮), a la derecha de la barra de direcciones.
              </li>
              <li>
                Toca <b>Instalar y crear acceso directo</b> y después <b>Instalar</b>.
              </li>
              <li>Sigue las indicaciones de la pantalla.</li>
            </Steps>
          </Browser>
          <Browser id="android-samsung" current={is('android', 'samsung')} title="Samsung Internet">
            <Steps>
              <li>Abre gasora.es en Samsung Internet.</li>
              <li>
                Si ves un icono <b>+</b> en la barra de direcciones, tócalo y elige{' '}
                <b>Pantalla de inicio</b>.
              </li>
              <li>
                Si no aparece, abre el menú (⋮) y toca <b>Añadir a pantalla de inicio</b>; en ese
                caso se crea un acceso directo a la web, no una instalación completa.
              </li>
            </Steps>
          </Browser>
          <Browser id="android-firefox" current={is('android', 'firefox')} title="Firefox">
            <p className="mt-1.5">
              Abre el menú de Firefox con la web cargada y busca la opción para añadirla a la
              pantalla de inicio (puede llamarse <b>Instalar</b> o{' '}
              <b>Añadir a pantalla de inicio</b>, según la versión). Mozilla no detalla en su ayuda
              los nombres exactos de la versión actual, así que no podemos concretar más.
            </p>
          </Browser>
          <Browser
            id="android-other"
            current={is('android') && !['chrome', 'samsung', 'firefox'].includes(platform.browser)}
            title="Otros navegadores"
          >
            <p className="mt-1.5">
              Busca en el menú del navegador una opción como <b>Instalar aplicación</b> o{' '}
              <b>Añadir a pantalla de inicio</b>. Los nombres y los cuadros de diálogo cambian según
              el dispositivo y el navegador.
            </p>
          </Browser>
        </DeviceSection>

        <DeviceSection
          id="desktop"
          current={is('desktop')}
          icon={<Laptop width={22} height={22} aria-hidden />}
          title="Ordenador"
        >
          <Browser id="desktop-chrome" current={is('desktop', 'chrome')} title="Chrome">
            <Steps>
              <li>Abre gasora.es en Chrome.</li>
              <li>
                Pulsa el icono de <b>Instalar</b> al final de la barra de direcciones (no siempre
                aparece).
              </li>
              <li>
                Si no lo ves: menú <b>Más</b> (⋮) → <b>Enviar, guardar y compartir</b> →{' '}
                <b>Instalar página como aplicación…</b>
              </li>
              <li>Sigue las indicaciones de la pantalla.</li>
            </Steps>
          </Browser>
          <Browser id="desktop-edge" current={is('desktop', 'edge')} title="Edge">
            <Steps>
              <li>Abre gasora.es en Edge.</li>
              <li>
                Si aparece el aviso o el icono de instalar en la barra de direcciones, púlsalo.
              </li>
              <li>
                Si no: <b>Configuración y más</b> (…) → <b>Más herramientas</b> →{' '}
                <b>Aplicaciones</b> → <b>Instalar este sitio como una aplicación</b>.
              </li>
            </Steps>
          </Browser>
          <Browser id="desktop-safari" current={is('desktop', 'safari')} title="Safari en macOS">
            <Steps>
              <li>Hace falta macOS Sonoma 14 o posterior. Abre gasora.es en Safari.</li>
              <li>
                En la barra de menús, elige <b>Archivo</b> → <b>Añadir al Dock</b> (o el botón{' '}
                <b>Compartir</b> → <b>Añadir al Dock</b>).
              </li>
              <li>
                Escribe el nombre y pulsa <b>Añadir</b>.
              </li>
            </Steps>
          </Browser>
          <Browser id="desktop-firefox" current={is('desktop', 'firefox')} title="Firefox">
            <p className="mt-1.5">
              Firefox para ordenador no permite instalar aplicaciones web por sí mismo (Mozilla
              retiró esa función; según MDN hace falta una extensión, que no hemos probado). Puedes
              seguir usando Gasora en una pestaña, o instalarla desde Chrome, Edge o, en macOS,
              Safari.
            </p>
          </Browser>
        </DeviceSection>

        <section aria-labelledby="install-problems" data-testid="install-problems">
          <h2 id="install-problems" className="text-[1.125rem] font-bold">
            Si no te aparece la opción
          </h2>
          <ul className="mt-2 ml-5 list-disc space-y-1.5">
            <li>
              Hace falta una conexión segura (HTTPS). Gasora se sirve desde https://gasora.es; si
              ves la dirección con http://, cambia a https.
            </li>
            <li>
              Comprueba que abres la web en el navegador que indican los pasos y que está
              actualizado.
            </li>
            <li>
              Recarga la página y espera unos segundos: el navegador comprueba si se puede instalar
              y puede tardar. Algunos navegadores, si no pueden instalarla, ofrecen solo un acceso
              directo a la web.
            </li>
            <li>Los nombres de los menús cambian un poco según la versión y el idioma.</li>
          </ul>
        </section>
      </div>
    </PageColumn>
  );
}

export default InstallPage;
