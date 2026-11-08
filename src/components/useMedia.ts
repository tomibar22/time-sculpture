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

/** Phones: the layout that docks the selection bar above the number pad. */
export const PHONE = '(max-width: 560px)';
