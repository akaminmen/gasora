import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUiStore } from '../../stores/ui';

const QUERY = '(prefers-color-scheme: dark)';

/** Sigue el sistema hasta que el usuario elige; entonces recuerda su elección. */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      data-testid="theme-toggle"
      className="inline-grid size-11 flex-none place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-brand-50"
    >
      {dark ? (
        <Sun width={20} height={20} aria-hidden />
      ) : (
        <Moon width={20} height={20} aria-hidden />
      )}
    </button>
  );
}
