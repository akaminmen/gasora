import { Search } from 'lucide-react';
import { useParams } from 'react-router';
import { LinkButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { PageColumn } from '../../components/PageHeader';

/** Ficha de estación por enlace directo (/e/:id). El contenido real llega en la Fase 5. */
export function StationPage() {
  const { id } = useParams();
  return (
    <PageColumn>
      <h1 className="sr-only">Ficha de la gasolinera {id}</h1>
      <EmptyState
        title="Ficha en preparación"
        text="Pronto podrás abrir aquí la ficha completa de la gasolinera, con todos sus precios y cómo llegar."
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Buscar gasolineras
          </LinkButton>
        }
      />
    </PageColumn>
  );
}
