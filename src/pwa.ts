import { registerSW } from 'virtual:pwa-register';

/**
 * The app as a home-screen PWA: new versions install in the background and take over at once.
 * An iPhone home-screen app resumes from memory without reloading, so it would only look for a
 * new version on a cold start; it also looks whenever it comes back to the foreground (the piece
 * was saved when it went away). No timer: an update never reloads in the middle of work.
 */
export function installUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => {});
      });
    },
  });
}
