import {
  barMap,
  buildGrid,
  clickHeard,
  EPS,
  nextPulse,
  playOrder,
  spanOf,
  toMain,
} from '../engine';
import type { Meter, Span } from '../engine';
import { useDocStore, useUiStore } from '../state/store';
import { audioNow, ensureAudio } from './context';
import { playClick, playGroup, playPicked } from './voices';

/**
 * Lookahead scheduler. It walks beat-time T (not pulse indices), asking the engine for the next
 * pulse at or after T against the *current* document each time, so edits, drags and subdivision
 * changes are heard at once and never make the playhead jump. Repeats and endings: it follows the
 * piece's play order (stretches of written time), recomputed from the current document too.
 */
const LOOKAHEAD_S = 0.12;
const INTERVAL_MS = 25;

interface Slot {
  /** The bar of the click pattern's cycle this pulse is in (−1: no pattern). */
  bar: number;
  /** The tiles are silent this time round (practice). */
  hush: boolean;
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
/** Times the music has come round since Play (practice: tiles heard and silent in turn). */
let round = 0;
/** Practice (editor only): are the tiles silent this time round? The click always stays. */
const hushedNow = (): boolean => {
  const ui = useUiStore.getState();
  if (ui.stage || ui.tiles === 'on') return false;
  if (ui.tiles === 'off') return true;
  const { on, off } = ui.turns;
  return round % (on + off) >= on;
};
/**
 * Bars heard since Play (the click pattern's cycle of bars): the bar playing began in is 0, and
 * every bar line passed after that counts one, round after round.
 */
let barsHeard = 0;
let barsBegun = false;
let countBar = 0;
let countBars = 1;
let countBeat = 1;
/** Count-in clicks still to schedule (lazily, so a stop silences the rest). */
let countClicks: { t: number; kind: 'beat' | 'downbeat' | 'tick' }[] = [];
/** The count-in's ticks are a part of the count, so a little above the soft playing ticks. */
const COUNT_TICK = 2.5;
/** Playing once (stage): the time it lands on 1, after which nothing more is scheduled. */
let endAt: number | null = null;
let endT = 0;
/** How long the landing stays on the screen before the player stops. */
const HOLD_S = 1.6;
/** Playing the selection: it plays once and stops at its end (after a short hold). */
let regionOnce = false;
const REGION_HOLD_S = 0.25;

/** Where Play starts (beats): the start the user set, or the top. Not on the stage. */
const startFrom = () => {
  const ui = useUiStore.getState();
  return ui.stage ? 0 : (ui.playStart ?? 0);
};

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

/**
 * The bar that holds time t: how many beats it has (main beats only matter for the count's
 * pace) and the beat where it starts.
 */
function barAt(meter: Meter, t: number): { beats: number; start: number } {
  const map = barMap(meter);
  const bar = map.barOf[Math.min(Math.floor(t + EPS), map.barOf.length - 1)] ?? 0;
  const a = map.barStarts[bar] ?? 0;
  const b = map.barStarts[bar + 1] ?? map.NB;
  return { beats: Math.max(1, Math.round(b - a)) || meter.beatsPerCycle, start: Math.round(a) };
}

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
  const once = (ui.stage && !ui.stagePrefs.loop) || regionOnce;
  while (countClicks.length && countClicks[0]!.t < now + LOOKAHEAD_S) {
    const c = countClicks.shift()!;
    if (sound !== 'off') playClick(c.t, c.kind, true, true, c.kind === 'tick' ? COUNT_TICK : 1);
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
        // the last stretch is over: land on 1 and stop there (a selection that ends before the
        // end of the piece just stops)
        if (sound !== 'off' && s.b >= doc.meter.subdivision.length - EPS)
          playClick(next, 'landing', false);
        endAt = next;
        endT = s.b;
        return;
      }
      if (seg + 1 >= plan.length && !ui.loop) {
        // round again: from where Play starts (the top, unless a start was set)
        const from = Math.min(startFrom(), doc.meter.subdivision.length - EPS);
        seg = Math.max(
          0,
          plan.findIndex((p) => from >= p.a - EPS && from < p.b - EPS),
        );
        T = Math.max(from, plan[seg]!.a);
        round++;
        continue;
      }
      if (seg + 1 >= plan.length) round++;
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
    // practice: with the tiles silent the click is what is left, so it sounds whatever the option
    const hush = hushedNow();
    // the click pattern (editor): which beats, pulses and bars have the click
    const grid = buildGrid(doc.meter);
    const j = ev.k - grid.pre[ev.beat]!;
    const beatInBar = barMap(doc.meter).beatInBar[ev.beat] ?? 0;
    if (j === 0 && beatInBar === 0 && barsBegun) barsHeard++;
    barsBegun = true;
    const heard = ui.stage
      ? 'usual'
      : clickHeard(ui.clickPat, {
          beatInBar,
          j,
          d: doc.meter.subdivision[ev.beat] ?? 1,
          bar: barsHeard,
        });
    if (sound !== 'off' && heard === 'picked') {
      if (ui.ticks) playPicked(next);
    } else if (sound !== 'off' && heard)
      playClick(next, click, ui.ticks, ui.click || ui.stage || hush);
    const dur = span(ev.t0, ev.t1);
    if (ev.onset && sound === 'all' && !hush) playGroup(next, ev.onset.n, dur * ev.onset.n);
    const cyc = !ui.stage && ui.clickPat.on ? barsHeard % ui.clickPat.bars.length : -1;
    queue.push({ t: next, T0: ev.t0, T1: ev.t1, dur, hush, bar: cyc });
    next += dur;
    T = ev.t1;
  }
}

function frame(): void {
  const now = audioNow();
  const ui = useUiStore.getState();
  if (countBar) {
    const i = now < startAt ? Math.max(0, Math.floor((now - countFrom) / countBeat)) : -1;
    const cd =
      i >= 0
        ? {
            beat: (i % countBar) + 1,
            of: countBar,
            bar: Math.floor(i / countBar) + 1,
            bars: countBars,
          }
        : null;
    if (cd?.beat !== ui.countdown?.beat) ui.set({ countdown: cd });
    if (!cd) countBar = 0;
  }
  if (endAt !== null && now >= endAt) {
    // landed: hold the end on the screen for a moment, then stop
    if (ui.playhead !== endT) ui.set({ playhead: endT });
    if (now >= endAt + (regionOnce ? REGION_HOLD_S : HOLD_S)) return stopPlayback();
    raf = requestAnimationFrame(frame);
    return;
  }
  while (queue.length && queue[0]!.t <= now) current = queue.shift()!;
  if (current) {
    if (current.hush !== ui.hushed) ui.set({ hushed: current.hush });
    const bar = current.bar < 0 ? null : current.bar;
    if (bar !== ui.clickBarNow) ui.set({ clickBarNow: bar });
    const p = Math.min(1, Math.max(0, (now - current.t) / current.dur));
    useUiStore.getState().set({ playhead: current.T0 + (current.T1 - current.T0) * p });
  }
  raf = requestAnimationFrame(frame);
}

/**
 * Start playing from beat-time `from` (default: the top). With `loop`, only that stretch of
 * written time plays, again and again (for practising a passage).
 */
export function startPlayback(
  from = 0,
  loop: { a: number; b: number } | null = null,
  opts: { once?: boolean; noCount?: boolean } = {},
): void {
  if (timer) return;
  if (!ensureAudio()) return;
  regionOnce = !!loop && !!opts.once;
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
  round = 0;
  barsHeard = 0;
  barsBegun = false;
  // count in (bars of the main beat) before the music starts: the stage's own setting, or the
  // editor's (the bar it counts is the bar where playing begins)
  const ui = useUiStore.getState();
  const bars = ui.stage ? ui.stagePrefs.countIn : opts.noCount ? 0 : ui.countIn;
  if (bars) {
    const bar = barAt(meter, T);
    countBar = bar.beats;
    countBars = bars;
    countBeat = 60 / ui.tempo;
    countFrom = next;
    countClicks = [];
    for (let i = 0; i < bars * countBar; i++) {
      const t = countFrom + i * countBeat;
      countClicks.push({ t, kind: i % countBar ? 'beat' : 'downbeat' });
      // subdivided (editor): the ticks of that beat of the bar being counted
      const d = !ui.stage && ui.countSub ? (meter.subdivision[bar.start + (i % countBar)] ?? 1) : 1;
      for (let j = 1; j < d; j++) countClicks.push({ t: t + (j / d) * countBeat, kind: 'tick' });
    }
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
  useUiStore.getState().set({
    playing: false,
    playhead: null,
    countdown: null,
    loop: null,
    hushed: false,
    clickBarNow: null,
  });
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

/**
 * Play / stop. With tiles or a pulse range selected (in the editor), only that stretch plays,
 * once; otherwise the piece from where Play starts (the top, or the start that was set). (⇧Space loops the selection.)
 */
export function togglePlayback(): void {
  if (timer) return stopPlayback();
  const ui = useUiStore.getState();
  const doc = useDocStore.getState().doc;
  const region = ui.stage ? null : (ui.range ?? spanOf(doc, ui.selection));
  if (region && region.b > region.a) {
    const grid = buildGrid(doc.meter);
    const a = grid.times[region.a]!;
    const b = grid.times[Math.min(region.b, grid.TS)]!;
    // a selected stretch loops (user request): heard over and over until Stop
    return startPlayback(a, { a, b });
  }
  const NB = doc.meter.subdivision.length;
  // like the insert marker of a DAW: with a caret in the piece, Play starts at the caret
  // (coming round, it goes on from where Play starts otherwise: the start that was set, or the top)
  let from = startFrom();
  if (!ui.stage && ui.caret !== null) {
    const grid = buildGrid(doc.meter);
    if (ui.caret > 0 && ui.caret < grid.TS) from = grid.times[ui.caret]!;
  }
  startPlayback(from < NB - EPS ? from : 0);
}
