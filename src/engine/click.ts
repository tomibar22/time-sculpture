/**
 * The click as a rhythm of its own (practice): a small sequencer. A cycle of 1–8 bars, and for
 * each bar which beats click and which pulses inside each beat. It is written against the
 * *shape* of the music, not against pulse numbers, so it holds through every change of
 * subdivision, metre and tempo:
 * - a beat is named by its place in its bar (a beat the bar does not have is just not there);
 * - the pulses inside a beat are chosen for that beat *at a ratio* ("beat 2, as 4: the second"),
 *   so a beat that is 4 in one bar and 3 in another has an answer for each, and a ratio nobody
 *   set follows the bar's `base`;
 * - bars are counted as they are heard since Play, so a cycle of 4 works on a 2-bar loop.
 */
export interface ClickBar {
  /** What sounds where nothing was set: everything (the plain click), or nothing. */
  base: boolean;
  /** Beats (0 = the 1) that are the other way round from `base`. */
  beats: number[];
  /**
   * The pulses inside a beat that were set by hand, by `subKey(beat, d)`: 1 … d−1. They sound as
   * clear clicks (none = silence). Absent = as `base` says: the usual soft ticks, or nothing.
   */
  sub: Record<string, number[]>;
}

export interface ClickPattern {
  /** Off: the click is the plain one (every beat, every tick). The pattern is kept. */
  on: boolean;
  /** The cycle of bars (1–8). */
  bars: ClickBar[];
}

export const MAX_CLICK_BARS = 8;
export const clickBar = (base: boolean): ClickBar => ({ base, beats: [], sub: {} });
export const CLICK_PATTERN: ClickPattern = { on: false, bars: [clickBar(true)] };
export const subKey = (beat: number, d: number) => `${beat}:${d}`;

/** What a pulse gets: nothing, the usual click or tick, or a picked pulse's clear click. */
export type ClickVerdict = 'usual' | 'picked' | null;

/** Does the beat itself click in this bar? */
export const beatOn = (bar: ClickBar, beat: number): boolean =>
  bar.base !== bar.beats.includes(beat);

/** The pulses inside beat `beat` (of ratio d) that sound in this bar. */
export function innerOn(bar: ClickBar, beat: number, d: number): number[] {
  const s = bar.sub[subKey(beat, d)];
  if (s) return s;
  return bar.base ? Array.from({ length: d - 1 }, (_, i) => i + 1) : [];
}

/**
 * Does pulse j (0 = the beat itself) of a beat of ratio d click? `beatInBar` is the beat's place
 * in its bar, `bar` the number of bars heard so far (0 for the bar playing began in).
 */
export function clickHeard(
  p: ClickPattern,
  at: { beatInBar: number; j: number; d: number; bar: number },
): ClickVerdict {
  if (!p.on) return 'usual';
  const n = p.bars.length;
  const bar = p.bars[((at.bar % n) + n) % n];
  if (!bar) return 'usual';
  if (at.j === 0) return beatOn(bar, at.beatInBar) ? 'usual' : null;
  // what was set by hand is a clear click; an untouched beat ticks softly, or not at all
  const set = bar.sub[subKey(at.beatInBar, at.d)];
  if (!set) return bar.base ? 'usual' : null;
  return set.includes(at.j) ? 'picked' : null;
}

/** Were the pulses inside this beat (at ratio d) set by hand? Then they are clear clicks. */
export const innerPicked = (bar: ClickBar, beat: number, d: number): boolean =>
  !!bar.sub[subKey(beat, d)];

const toggled = (a: number[], x: number) =>
  a.includes(x) ? a.filter((y) => y !== x) : [...a, x].sort((p, q) => p - q);

/** A beat of a bar turned on or off. */
export const toggleClickBeat = (bar: ClickBar, beat: number): ClickBar => ({
  ...bar,
  beats: toggled(bar.beats, beat),
});

/**
 * A pulse inside a beat turned on or off: in that beat alone, or (with `beats`, the beats of
 * the bar that have the same ratio) in all of them, which all get what the tapped one gets.
 */
export function toggleClickPulse(
  bar: ClickBar,
  beat: number,
  d: number,
  j: number,
  beats: number[] = [beat],
): ClickBar {
  const want = !innerOn(bar, beat, d).includes(j);
  const sub = { ...bar.sub };
  for (const b of beats.includes(beat) ? beats : [beat]) {
    const now = innerOn(bar, b, d);
    const next = now.includes(j) === want ? now : toggled(now, j);
    // every pulse of a beat on again, in a bar that ticks: it is the plain soft ticking again
    if (bar.base && next.length === d - 1) delete sub[subKey(b, d)];
    else sub[subKey(b, d)] = next;
  }
  return { ...bar, sub };
}

/** A stored pattern, made safe (prefs from another version, or by hand). */
export function cleanClickPattern(raw: unknown): ClickPattern {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ints = (v: unknown, lo: number, hi: number): number[] =>
    Array.isArray(v)
      ? [...new Set(v.filter((n) => Number.isInteger(n) && n >= lo && n <= hi) as number[])].sort(
          (a, b) => a - b,
        )
      : [];
  const on = r.on === true;
  // the first shape (one bar's beats and ratios, and which bars of a cycle have the click)
  if (typeof r.every === 'number') {
    const every =
      Number.isInteger(r.every) && r.every >= 1 && r.every <= MAX_CLICK_BARS ? r.every : 1;
    const sub: Record<string, number[]> = {};
    if (r.sub && typeof r.sub === 'object')
      for (const [k, v] of Object.entries(r.sub as object)) {
        const d = +k;
        if (Number.isInteger(d) && d >= 2 && d <= 8)
          // (all of a ratio's pulses meant the plain ticking: nothing to carry over)
          if (ints(v, 1, d - 1).length < d - 1)
            for (let b = 0; b < 13; b++) sub[subKey(b, d)] = ints(v, 1, d - 1);
      }
    const sounding = ints(r.bars, 0, every - 1);
    return {
      on,
      bars: Array.from({ length: every }, (_, i) =>
        (sounding.length ? sounding : [0]).includes(i)
          ? { base: true, beats: ints(r.off, 0, 63), sub: { ...sub } }
          : clickBar(false),
      ),
    };
  }
  const bars = (Array.isArray(r.bars) ? r.bars : []).slice(0, MAX_CLICK_BARS).map((x): ClickBar => {
    const b = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const sub: Record<string, number[]> = {};
    if (b.sub && typeof b.sub === 'object')
      for (const [k, v] of Object.entries(b.sub as object)) {
        const m = /^(\d+):(\d)$/.exec(k);
        const d = m ? +m[2]! : 0;
        if (m && +m[1]! < 64 && d >= 2 && d <= 8) sub[k] = ints(v, 1, d - 1);
      }
    return { base: b.base !== false, beats: ints(b.beats, 0, 63), sub };
  });
  return { on, bars: bars.length ? bars : [clickBar(true)] };
}

/** The cycle made longer (the new bars are silent) or shorter. */
export function withClickBars(p: ClickPattern, n: number): ClickPattern {
  const len = Math.max(1, Math.min(MAX_CLICK_BARS, n));
  const bars = p.bars.slice(0, len);
  while (bars.length < len) bars.push(clickBar(false));
  return { ...p, bars };
}

/** A pattern to start from. `shape` = for every beat of the bar, the ratios the piece has there. */
export interface ClickPreset {
  id: string;
  name: (shape: number[][]) => string;
  bars: (shape: number[][]) => ClickBar[];
}

/** A bar where only these beats click, and inside every beat only what `inner` gives. */
function barOf(
  shape: number[][],
  beat: (b: number) => boolean,
  inner: (d: number) => number[] = () => [],
): ClickBar {
  const bar = clickBar(false);
  shape.forEach((ds, b) => {
    if (beat(b)) bar.beats.push(b);
    for (const d of ds) {
      const on = inner(d).filter((j) => j >= 1 && j < d);
      if (on.length) bar.sub[subKey(b, d)] = on;
    }
  });
  return bar;
}

/**
 * Ways of practising against a click that says less: the backbeat, the 1 alone (in every bar or
 * once in four), the off-beats, the last pulse of every beat, and the click that goes away for
 * two bars in four.
 */
export const CLICK_PRESETS: ClickPreset[] = [
  {
    id: 'backbeat',
    name: (shape) => (shape.length === 4 ? '2 and 4' : 'Every other beat'),
    bars: (shape) => [barOf(shape, (b) => b % 2 === 1)],
  },
  { id: 'one', name: () => 'Only the 1', bars: (shape) => [barOf(shape, (b) => b === 0)] },
  {
    id: 'one4',
    name: () => 'The 1, once in 4 bars',
    bars: (shape) => [
      barOf(shape, (b) => b === 0),
      clickBar(false),
      clickBar(false),
      clickBar(false),
    ],
  },
  {
    id: 'off',
    name: () => 'Off-beats',
    // the middle of a beat; in a beat of three, its last pulse (the swung "and")
    bars: (shape) => [
      barOf(
        shape,
        () => false,
        (d) => (d % 2 === 0 ? [d / 2] : d === 3 ? [2] : []),
      ),
    ],
  },
  {
    id: 'last',
    name: () => 'Last pulse of the beat',
    bars: (shape) => [
      barOf(
        shape,
        () => false,
        (d) => [d - 1],
      ),
    ],
  },
  {
    id: 'gap',
    name: () => '2 bars on, 2 off',
    bars: () => [clickBar(true), clickBar(true), clickBar(false), clickBar(false)],
  },
];
