import { stopPlayback } from '../audio/player';
import { saveStage, useUiStore } from './store';
import type { StagePrefs } from './store';

/**
 * The stage: a clean, full-screen view of the score for filming a performance (screen recording
 * on a phone, or a desktop window). See components/Stage.tsx.
 */
const ui = () => useUiStore.getState();

let wakeLock: { release: () => Promise<void> } | null = null;
type WakeNav = Navigator & {
  wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
};

/** Keep the screen on while the stage is open (a recording must not dim or lock). */
async function holdScreen(): Promise<void> {
  if (!ui().stage || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = (await (navigator as WakeNav).wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null; // not allowed (battery saver, older browser): the screen may dim
  }
}
const onVisible = () => {
  // the system drops the lock when the app is hidden; take it again on return
  wakeLock = null;
  void holdScreen();
};

export function enterStage(): void {
  if (ui().stage) return;
  // no toasts on the stage: they would end up in the recording
  ui().set({ stage: true, overview: false, toast: null });
  window.scrollTo({ top: 0, behavior: 'instant' });
  // desktop browsers: full screen (iPhone Safari has none for pages; a home-screen app already is)
  const root = document.documentElement;
  if (document.fullscreenEnabled && !document.fullscreenElement)
    root.requestFullscreen?.().catch(() => undefined);
  void holdScreen();
  document.addEventListener('visibilitychange', onVisible);
}

export function exitStage(): void {
  if (!ui().stage) return;
  stopPlayback();
  ui().set({ stage: false, overview: false });
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
  document.removeEventListener('visibilitychange', onVisible);
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

export function setStagePrefs(patch: Partial<StagePrefs>): void {
  const p = { ...ui().stagePrefs, ...patch };
  ui().set({ stagePrefs: p });
  saveStage(p);
}
