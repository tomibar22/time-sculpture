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
 * Phones and tablets (iPhone, iPad: any touch screen, or a narrow window): the selection bar sits
 * in the dock above the number pad, by the thumb, and the settings fold into one line. Keep in
 * step with the matching media query in global.css.
 */
export const DOCKED = '(max-width: 560px), (pointer: coarse)';
