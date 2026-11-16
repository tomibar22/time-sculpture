import { registerSW } from 'virtual:pwa-register';
import { saveNow } from './persistence/session';
import { toast } from './state/actions';

/**
 * The app as a home-screen PWA: new versions install in the background and take over at once.
 * An iPhone home-screen app resumes from memory without reloading, so it would only look for a
 * new version on a cold start; it also looks whenever it comes back to the foreground (the piece
 * was saved when it went away). No timer: an update never reloads in the middle of work.
 */
export function installUpdates(): void {
  // a part of the app loaded on demand (PDF, picture, MIDI, MusicXML) is gone from the server:
  // a newer version was published while this page stayed open. Save, then load the new one.
  let reloading = false;
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    if (reloading) return;
    reloading = true;
    toast('A new version is ready. Reloading… then try again.');
    void saveNow()
      .catch(() => {})
      .then(() => setTimeout(() => location.reload(), 900));
  });
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
