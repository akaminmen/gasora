import { Calculator, Search } from 'lucide-react';
import { LinkButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { PageColumn, PageHeader } from '../../components/PageHeader';

/** Calculadora: la pantalla real (litros, combustible, comparación, conteo animado) es de la Fase 5. */
export function CalculatorPage() {
  return (
    <PageColumn>
      <PageHeader
        title="Calculadora de ahorro"
        subtitle="Cuánto te ahorras al repostar en la más barata"
      />
      <EmptyState
        icon={<Calculator width={44} height={44} aria-hidden />}
        title="Muy pronto"
        text="Primero busca gasolineras cerca de ti: la calculadora usará esos precios para decirte cuánto ahorras por depósito."
        actions={
          <LinkButton to="/" icon={<Search width={18} height={18} aria-hidden />}>
            Buscar gasolineras
          </LinkButton>
        }
      />
    </PageColumn>
  );
}
