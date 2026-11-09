import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query (false where matchMedia is missing). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia === 'undefined') return () => {};
      const mq = matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  );
}

/** Phones: the compact header and transport. */
export const PHONE = '(max-width: 560px)';

/**
 * Every screen (iPhone, iPad and desktop, at the user's request): the selection bar sits in the
 * dock above the number pad, next to the subdivision row, and the settings fold into one line.
 * Keep in step with the matching media queries in global.css.
 */
export const DOCKED = 'all';
