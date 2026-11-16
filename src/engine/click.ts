/**
 * The click as a rhythm of its own (practice): which beats of a bar click, which pulses inside a
 * beat, and in which bars of a cycle of bars. It is written against the *shape* of the music,
 * not against pulse numbers, so it holds through every change of subdivision, metre and tempo:
 * - beats are named by their place in their bar (a beat the bar does not have is just not there);
 * - pulses inside a beat are chosen per ratio ("in a beat of 3: the second"), so a piece with
 *   several ratios has an answer for each, and a ratio never chosen sounds as it always did;
 * - bars are counted as they are heard since Play, so a cycle of 4 works on a 2-bar loop.
 */
export interface ClickPattern {
  /** Off: the click is the plain one (every beat, every tick). The pattern is kept. */
  on: boolean;
  /** Beats of the bar that do not click (0 = the 1). */
  off: number[];
  /** Per ratio d (2–8): the pulses inside a beat (1 … d−1) that sound. Absent = all, softly. */
  sub: Record<number, number[]>;
  /** A cycle of this many bars (1–8)… */
  every: number;
  /** …of which these (0-based) have the click. */
  bars: number[];
}

export const CLICK_PATTERN: ClickPattern = { on: false, off: [], sub: {}, every: 1, bars: [0] };
export const MAX_CLICK_BARS = 8;

/** What a pulse gets: nothing, the usual click or tick, or a picked pulse's clear click. */
export type ClickVerdict = 'usual' | 'picked' | null;

/** Are the pulses inside beats of ratio d chosen by hand (not simply all of them)? */
export const pickedIn = (p: ClickPattern, d: number): boolean => {
  const s = p.sub[d];
  return !!s && s.length < d - 1;
};

/**
 * Does pulse j (0 = the beat itself) of a beat of ratio d click? `beatInBar` is the beat's place
 * in its bar, `bar` the number of bars heard so far (0 for the bar playing began in).
 */
export function clickHeard(
  p: ClickPattern,
  at: { beatInBar: number; j: number; d: number; bar: number },
): ClickVerdict {
  if (!p.on) return 'usual';
  if (!p.bars.includes(((at.bar % p.every) + p.every) % p.every)) return null;
  if (at.j === 0) return p.off.includes(at.beatInBar) ? null : 'usual';
  if (!pickedIn(p, at.d)) return 'usual';
  return p.sub[at.d]!.includes(at.j) ? 'picked' : null;
}

/** A stored pattern, made safe (prefs from another version, or by hand). */
export function cleanClickPattern(raw: unknown): ClickPattern {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ClickPattern>;
  const ints = (v: unknown, lo: number, hi: number): number[] =>
    Array.isArray(v)
      ? [...new Set(v.filter((n) => Number.isInteger(n) && n >= lo && n <= hi) as number[])].sort(
          (a, b) => a - b,
        )
      : [];
  const every =
    Number.isInteger(r.every) && r.every! >= 1 && r.every! <= MAX_CLICK_BARS ? r.every! : 1;
  const sub: Record<number, number[]> = {};
  if (r.sub && typeof r.sub === 'object')
    for (const [k, v] of Object.entries(r.sub)) {
      const d = +k;
      if (Number.isInteger(d) && d >= 2 && d <= 8 && Array.isArray(v)) sub[d] = ints(v, 1, d - 1);
    }
  const bars = ints(r.bars, 0, every - 1);
  return {
    on: r.on === true,
    off: ints(r.off, 0, 63),
    sub,
    every,
    bars: bars.length ? bars : [0],
  };
}

/** The cycle made longer or shorter; bars that fall off go, and one bar always clicks. */
export function withClickBars(p: ClickPattern, every: number): ClickPattern {
  const n = Math.max(1, Math.min(MAX_CLICK_BARS, every));
  const bars = p.bars.filter((b) => b < n);
  return { ...p, every: n, bars: bars.length ? bars : [0] };
}
