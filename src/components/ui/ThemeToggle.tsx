import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '../../stores/ui';

/** Claro por defecto; el oscuro solo si el usuario lo elige, y se recuerda. */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      data-testid="theme-toggle"
      className="inline-grid size-[44px] flex-none place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-brand-50"
    >
      {dark ? (
        <Sun width={20} height={20} aria-hidden />
      ) : (
        <Moon width={20} height={20} aria-hidden />
      )}
    </button>
  );
}
