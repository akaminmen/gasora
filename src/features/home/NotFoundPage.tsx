import { House } from 'lucide-react';
import { LinkButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { PageColumn } from '../../components/PageHeader';

export function NotFoundPage() {
  return (
    <PageColumn>
      <h1 className="sr-only">Página no encontrada</h1>
      <EmptyState
        title="Esta página no existe"
        text="Puede que el enlace esté mal escrito o que la gasolinera ya no esté disponible."
        actions={
          <LinkButton to="/" size="lg" icon={<House width={18} height={18} aria-hidden />}>
            Volver al inicio
          </LinkButton>
        }
      />
    </PageColumn>
  );
}
