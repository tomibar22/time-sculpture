import * as E from '../engine';
import type { Doc } from '../engine';
import { stopPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { saveStage, useDocStore, useUiStore } from './store';
import type { BuildDir, StagePrefs } from './store';

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
  // desktop and iPad browsers: full screen (iPhone Safari has none for pages; a home-screen app
  // already is)
  const root = document.documentElement;
  if (document.fullscreenEnabled && !document.fullscreenElement)
    root.requestFullscreen?.().catch(() => undefined);
  void holdScreen();
  document.addEventListener('visibilitychange', onVisible);
}

export function exitStage(): void {
  if (!ui().stage) return;
  stopPlayback();
  ui().set({ stage: false, overview: false, build: null, buildPop: null });
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

/* ------------------------------------------------------------------ build presentation */

/** The sounding groups in time order, with their times in beats: the build's steps. */
export function buildSteps(doc: Doc): { id: string; n: number; t0: number; t1: number }[] {
  const { times } = E.buildGrid(doc.meter);
  const out: { id: string; n: number; t0: number; t1: number }[] = [];
  let k = 0;
  for (const x of doc.items) {
    if (x.kind === 'sound') out.push({ id: x.id, n: x.n, t0: times[k]!, t1: times[k + x.n]! });
    k += x.n;
  }
  return out;
}

/**
 * What the build shows after `step` clicks: a stretch of time [a, b] in beats, from the top (it
 * reaches on through silence to the next group still hidden) or from the end (back to just
 * after the last group still hidden), and the group revealed last.
 */
export function buildReveal(
  doc: Doc,
  dir: BuildDir,
  step: number,
): { a: number; b: number; last: string | null } {
  const steps = buildSteps(doc);
  const NB = E.buildGrid(doc.meter).NB;
  const n = steps.length;
  const k = E.clamp(step, 0, n);
  if (dir === 'start')
    return { a: 0, b: k === 0 ? 0 : k < n ? steps[k]!.t0 : NB, last: steps[k - 1]?.id ?? null };
  return {
    a: k === 0 ? NB : k < n ? steps[n - k - 1]!.t1 : 0,
    b: NB,
    last: k === 0 ? null : (steps[n - k]?.id ?? null),
  };
}

/** Switch the stage between the play and build presentations (the build starts empty). */
export function setBuild(on: boolean): void {
  stopPlayback();
  ui().set({ build: on ? { step: 0 } : null, buildPop: null });
}

/** One click of the build: reveal the next group (+1) or hide the last one (−1). */
export function buildStep(dir: 1 | -1): void {
  const s = ui();
  if (!s.build) return;
  const doc = useDocStore.getState().doc;
  const n = buildSteps(doc).length;
  const step = E.clamp(s.build.step + dir, 0, n);
  if (step === s.build.step) return;
  const r = buildReveal(doc, s.stagePrefs.buildDir, step);
  const group = dir > 0 && r.last ? E.findItem(doc, r.last) : undefined;
  s.set({ build: { step }, buildPop: group ? { id: group.id, at: performance.now() } : null });
  // the group is heard as it appears (unless the stage is silent)
  if (group && s.stagePrefs.sound === 'all') sfx.add(group.n);
}

/** Show nothing (or everything) at once. */
export function buildTo(all: boolean): void {
  const s = ui();
  if (!s.build) return;
  s.set({
    build: { step: all ? buildSteps(useDocStore.getState().doc).length : 0 },
    buildPop: null,
  });
}

/** Build from the start or from the end (starting over). */
export function setBuildDir(dir: BuildDir): void {
  setStagePrefs({ buildDir: dir });
  if (ui().build) ui().set({ build: { step: 0 }, buildPop: null });
}
