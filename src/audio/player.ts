import { EPS, nextPulse, playOrder, toMain } from '../engine';
import type { Meter, Span } from '../engine';
import { useDocStore, useUiStore } from '../state/store';
import { audioNow, ensureAudio } from './context';
import { playClick, playGroup } from './voices';

/**
 * Lookahead scheduler. It walks beat-time T (not pulse indices), asking the engine for the next
 * pulse at or after T against the *current* document each time, so edits, drags and subdivision
 * changes are heard at once and never make the playhead jump. Repeats and endings: it follows the
 * piece's play order (stretches of written time), recomputed from the current document too.
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
/** Index of the stretch of the play order being played. */
let seg = 0;
let next = 0;
let queue: Slot[] = [];
let current: Slot | null = null;
/** Count-in: when it began and when the piece itself starts (audio time), and its bar size. */
let countFrom = 0;
let startAt = 0;
let countBar = 0;
let countBeat = 1;
/** Count-in clicks still to schedule (lazily, so a stop silences the rest). */
let countClicks: { t: number; kind: 'beat' | 'downbeat' }[] = [];
/** Playing once (stage): the time it lands on 1, after which nothing more is scheduled. */
let endAt: number | null = null;
let endT = 0;
/** How long the landing stays on the screen before the player stops. */
const HOLD_S = 1.6;

const activeDoc = () => useUiStore.getState().preview ?? useDocStore.getState().doc;

let orderFor: Meter | null = null;
let order: Span[] = [];
const playOrderOf = (m: Meter) => {
  if (m !== orderFor) {
    orderFor = m;
    order = playOrder(m);
  }
  return order;
};

/** Practice loop (written time, beats): only this stretch plays, round and round. */
const loopPlan = (NB: number): Span[] | null => {
  const l = useUiStore.getState().loop;
  if (!l) return null;
  const a = Math.max(0, Math.min(l.a, NB));
  const b = Math.min(l.b, NB);
  return b - a > EPS ? [{ a, b, pass: 1 }] : null;
};

/** What is heard: everything, only the click, or nothing (stage settings; elsewhere all). */
const soundMode = () => {
  const ui = useUiStore.getState();
  return ui.stage ? ui.stagePrefs.sound : 'all';
};

function schedule(): void {
  if (endAt !== null) return;
  const ui = useUiStore.getState();
  const beatDur = 60 / ui.tempo;
  const now = audioNow();
  const sound = soundMode();
  const once = ui.stage && !ui.stagePrefs.loop;
  while (countClicks.length && countClicks[0]!.t < now + LOOKAHEAD_S) {
    const c = countClicks.shift()!;
    if (sound !== 'off') playClick(c.t, c.kind, false);
  }
  for (let guard = 0; next < now + LOOKAHEAD_S && guard < 10_000; guard++) {
    const doc = activeDoc();
    const plan = loopPlan(doc.meter.subdivision.length) ?? playOrderOf(doc.meter);
    // durations go through main time, so modulated sections play at their own tempo
    const span = (a: number, b: number) => (toMain(doc.meter, b) - toMain(doc.meter, a)) * beatDur;
    if (seg >= plan.length) seg = 0;
    const s = plan[seg]!;
    if (T < s.a - EPS) T = s.a; // the stretch moved under an edit
    const ev = nextPulse(doc, T);
    // the end of this stretch: finish it, then go on to the next one (back to 1 after the last)
    if (T >= s.b - EPS || ev.t0 >= s.b - EPS || ev.t0 < T - EPS) {
      next += Math.max(0, span(T, s.b));
      if (once && seg + 1 >= plan.length) {
        // the last stretch is over: land on 1 and stop there
        if (sound !== 'off') playClick(next, 'landing', false);
        endAt = next;
        endT = s.b;
        return;
      }
      seg = (seg + 1) % plan.length;
      T = plan[seg]!.a;
      continue;
    }
    if (ev.t0 > T + EPS) {
      next += span(T, ev.t0);
      T = ev.t0;
    }
    // inside a practice loop the piece's own "1" is just a bar line
    const click = ev.click === 'landing' && ui.loop ? 'downbeat' : ev.click;
    if (sound !== 'off') playClick(next, click, ui.ticks, ui.click || ui.stage);
    const dur = span(ev.t0, ev.t1);
    if (ev.onset && sound === 'all') playGroup(next, ev.onset.n, dur * ev.onset.n);
    queue.push({ t: next, T0: ev.t0, T1: ev.t1, dur });
    next += dur;
    T = ev.t1;
  }
}

function frame(): void {
  const now = audioNow();
  const ui = useUiStore.getState();
  if (countBar) {
    const i = now < startAt ? Math.max(0, Math.floor((now - countFrom) / countBeat)) : -1;
    const cd = i >= 0 ? { beat: (i % countBar) + 1, of: countBar } : null;
    if (cd?.beat !== ui.countdown?.beat) ui.set({ countdown: cd });
    if (!cd) countBar = 0;
  }
  if (endAt !== null && now >= endAt) {
    // landed: hold the end on the screen for a moment, then stop
    if (ui.playhead !== endT) ui.set({ playhead: endT });
    if (now >= endAt + HOLD_S) return stopPlayback();
    raf = requestAnimationFrame(frame);
    return;
  }
  while (queue.length && queue[0]!.t <= now) current = queue.shift()!;
  if (current) {
    const p = Math.min(1, Math.max(0, (now - current.t) / current.dur));
    useUiStore.getState().set({ playhead: current.T0 + (current.T1 - current.T0) * p });
  }
  raf = requestAnimationFrame(frame);
}

/**
 * Start playing from beat-time `from` (default: the top). With `loop`, only that stretch of
 * written time plays, again and again (for practising a passage).
 */
export function startPlayback(from = 0, loop: { a: number; b: number } | null = null): void {
  if (timer) return;
  if (!ensureAudio()) return;
  useUiStore.getState().set({ loop });
  // start in the first stretch of the play order that holds `from`
  const meter = activeDoc().meter;
  const plan = loopPlan(meter.subdivision.length) ?? playOrderOf(meter);
  if (loop) from = plan[0]!.a;
  seg = Math.max(
    0,
    plan.findIndex((s) => from >= s.a - EPS && from < s.b - EPS),
  );
  T = Math.max(from, plan[seg]!.a);
  next = audioNow() + 0.08;
  queue = [];
  current = null;
  endAt = null;
  countBar = 0;
  // on the stage: count in (bars of the main beat) before the piece starts
  const ui = useUiStore.getState();
  const bars = ui.stage ? ui.stagePrefs.countIn : 0;
  if (bars) {
    countBar = activeDoc().meter.beatsPerCycle;
    countBeat = 60 / ui.tempo;
    countFrom = next;
    countClicks = Array.from({ length: bars * countBar }, (_, i) => ({
      t: countFrom + i * countBeat,
      kind: i % countBar ? 'beat' : 'downbeat',
    }));
    next += bars * countBar * countBeat;
    startAt = next;
  }
  timer = setInterval(schedule, INTERVAL_MS);
  schedule();
  useUiStore.getState().set({ playing: true });
  raf = requestAnimationFrame(frame);
}

export function stopPlayback(): void {
  if (timer) clearInterval(timer);
  timer = null;
  cancelAnimationFrame(raf);
  endAt = null;
  countBar = 0;
  countClicks = [];
  useUiStore.getState().set({ playing: false, playhead: null, countdown: null, loop: null });
}

// A hidden page's timers are throttled, so the scheduler would fall behind and then play
// everything it missed at once when the app comes back: stop instead (as a music app would
// when it loses the screen), and wake the audio again on return.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // (the audio context itself is replaced on the next gesture: audio/context.ts)
    if (document.visibilityState === 'hidden' && timer) stopPlayback();
  });
}

export function togglePlayback(): void {
  if (timer) stopPlayback();
  else startPlayback(0);
}
