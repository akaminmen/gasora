import { Heart, Search } from 'lucide-react';
import { LinkButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { PageColumn, PageHeader } from '../../components/PageHeader';

/** Favoritos: por ahora solo el estado vacío; la lista llega con `gasora:favorites:v1` (Fase 5). */
export function FavoritesPage() {
  return (
    <PageColumn>
      <PageHeader title="Favoritos" subtitle="Nada guardado todavía" />
      <EmptyState
        icon={<Heart width={44} height={44} aria-hidden />}
        title="Aún no tienes favoritos"
        text="Guarda tus gasolineras habituales con el corazón y consulta sus precios de un vistazo."
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Buscar gasolineras
          </LinkButton>
        }
      />
    </PageColumn>
  );
}
