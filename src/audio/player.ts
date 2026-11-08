import { buildGrid, EPS, nextPulse } from '../engine';
import { useDocStore, useUiStore } from '../state/store';
import { audioNow, ensureAudio } from './context';
import { playClick, playGroup } from './voices';

/**
 * Lookahead scheduler. It walks beat-time T (not pulse indices), asking the engine for the next
 * pulse at or after T against the *current* document each time, so edits, drags and subdivision
 * changes are heard at once and never make the playhead jump.
 */
const LOOKAHEAD_S = 0.12;
const INTERVAL_MS = 25;

interface Slot {
  t: number;
  T0: number;
  T1: number;
  dur: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let raf = 0;
let T = 0;
let next = 0;
let queue: Slot[] = [];
let current: Slot | null = null;

const activeDoc = () => useUiStore.getState().preview ?? useDocStore.getState().doc;

function schedule(): void {
  const ui = useUiStore.getState();
  const beatDur = 60 / ui.tempo;
  const now = audioNow();
  while (next < now + LOOKAHEAD_S) {
    const doc = activeDoc();
    const { NB } = buildGrid(doc.meter);
    const ev = nextPulse(doc, T);
    if (ev.k === 0 && T > EPS) {
      next += Math.max(0, NB - T) * beatDur; // finish the cycle, then wrap to 1
      T = 0;
    } else if (ev.t0 > T + EPS) {
      next += (ev.t0 - T) * beatDur;
      T = ev.t0;
    }
    playClick(next, ev.click, ui.ticks);
    if (ev.onset) playGroup(next, ev.onset.n);
    const dur = (ev.t1 - ev.t0) * beatDur;
    queue.push({ t: next, T0: ev.t0, T1: ev.t1, dur });
    next += dur;
    T = ev.t1 >= NB - EPS ? 0 : ev.t1;
  }
}

function frame(): void {
  const now = audioNow();
  while (queue.length && queue[0]!.t <= now) current = queue.shift()!;
  if (current) {
    const p = Math.min(1, Math.max(0, (now - current.t) / current.dur));
    useUiStore.getState().set({ playhead: current.T0 + (current.T1 - current.T0) * p });
  }
  raf = requestAnimationFrame(frame);
}

/** Start playing from beat-time `from` (default: the top). */
export function startPlayback(from = 0): void {
  if (timer) return;
  if (!ensureAudio()) return;
  T = from;
  next = audioNow() + 0.08;
  queue = [];
  current = null;
  timer = setInterval(schedule, INTERVAL_MS);
  schedule();
  useUiStore.getState().set({ playing: true });
  raf = requestAnimationFrame(frame);
}

export function stopPlayback(): void {
  if (timer) clearInterval(timer);
  timer = null;
  cancelAnimationFrame(raf);
  useUiStore.getState().set({ playing: false, playhead: null });
}

export function togglePlayback(): void {
  if (timer) stopPlayback();
  else startPlayback(0);
}
