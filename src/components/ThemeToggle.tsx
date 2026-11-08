import { useEffect } from 'react';
import { useUiStore } from '../state/store';
import type { Theme } from '../state/store';
import { ThemeIcon } from './Icons';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const LABEL: Record<Theme, string> = {
  system: 'Theme: follows the system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export function useApplyTheme() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const set = useUiStore((s) => s.set);
  return (
    <button
      type="button"
      className="icon ghost"
      aria-label={`${LABEL[theme]}. Change theme`}
      title={LABEL[theme]}
      onClick={() => set({ theme: ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]! })}
    >
      <ThemeIcon />
      <span className="theme-tag">{theme === 'system' ? 'auto' : theme}</span>
    </button>
  );
}
