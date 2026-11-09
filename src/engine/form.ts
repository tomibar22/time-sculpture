/**
 * Form: repeat signs and endings ("voltas"), as in Western notation.
 *
 *   |: A [1. B :| [2. C ] D        is heard as   A B A C D
 *
 * - A start sign `|:` and an end sign `:|` (with how many times, default 2) are times in beats on
 *   pulses. An end without a start before it repeats from the previous end sign, or from the top.
 *   If several starts lie between two ends, the last one counts.
 * - An ending covers [a, b) and lists the passes it is played on. Inside a repeat, it is skipped
 *   on the other passes; after an end sign (a second ending) it is reached on the last pass only,
 *   so it is simply played.
 *
 * Everything here is pure; `playOrder` is what the player follows.
 */
import { buildGrid, EPS, nearestPulse } from './grid';
import { fail, report } from './report';
import type { Doc, Meter, OpResult, RepeatEnd, Volta } from './types';

export const MIN_REPEAT = 2;
export const MAX_REPEAT = 12;
/** Highest pass number an ending may name. */
export const MAX_PASS = MAX_REPEAT;

export interface Form {
  repeatStarts: readonly number[];
  repeatEnds: readonly RepeatEnd[];
  voltas: readonly Volta[];
}

export const formOf = (m: Meter): Form => ({
  repeatStarts: m.repeatStarts ?? [],
  repeatEnds: m.repeatEnds ?? [],
  voltas: m.voltas ?? [],
});

export const hasForm = (m: Meter) =>
  !!(m.repeatStarts?.length || m.repeatEnds?.length || m.voltas?.length);

const clampTimes = (n: number) =>
  Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Number.isFinite(n) ? Math.round(n) : MIN_REPEAT));

const cleanPasses = (ps: readonly number[]) =>
  [...new Set(ps.map(Math.round))]
    .filter((p) => Number.isFinite(p) && p >= 1 && p <= MAX_PASS)
    .sort((x, y) => x - y);

/**
 * A meter with this form, fitted to its grid: every time snapped to the nearest pulse (after
 * `map`, which returns NaN for a time that no longer exists), out-of-range and duplicate signs
 * dropped, endings that became empty or overlap an earlier one dropped. No fields when empty.
 */
export function withForm(
  meter: Meter,
  form: Form,
  map: (t: number) => number = (t) => t,
  mapSpan: (t: number) => number = map,
): Meter {
  const { repeatStarts: _s, repeatEnds: _e, voltas: _v, ...rest } = meter;
  void _s;
  void _e;
  void _v;
  const base: Meter = rest;
  const grid = buildGrid(base);
  // a time outside the piece (it got shorter) is gone, not moved to its end
  const snap = (t: number) =>
    Number.isFinite(t) && t > -EPS && t < grid.NB + EPS ? nearestPulse(grid, t) : -1;

  const starts: number[] = [];
  for (const k of form.repeatStarts.map((t) => snap(map(t))).sort((x, y) => x - y)) {
    if (k < 0 || k >= grid.TS) continue;
    const t = grid.times[k]!;
    if (!starts.length || t - starts[starts.length - 1]! > EPS) starts.push(t);
  }

  const ends: RepeatEnd[] = [];
  const mappedEnds = form.repeatEnds
    .map((e) => ({ k: snap(map(e.at)), times: clampTimes(e.times) }))
    .sort((x, y) => x.k - y.k);
  for (const e of mappedEnds) {
    if (e.k <= 0 || e.k > grid.TS) continue;
    const at = grid.times[e.k]!;
    if (!ends.length || at - ends[ends.length - 1]!.at > EPS) ends.push({ at, times: e.times });
  }

  const voltas: Volta[] = [];
  const mappedVoltas = form.voltas
    .map((v) => ({
      ka: snap(mapSpan(v.a)),
      kb: snap(Math.min(mapSpan(v.b), grid.NB)),
      passes: cleanPasses(v.passes),
    }))
    .sort((x, y) => x.ka - y.ka);
  let lastB = -1;
  for (const v of mappedVoltas) {
    if (v.ka < 0 || v.kb > grid.TS || v.kb <= v.ka || !v.passes.length || v.ka < lastB) continue;
    voltas.push({ a: grid.times[v.ka]!, b: grid.times[v.kb]!, passes: v.passes });
    lastB = v.kb;
  }

  return {
    ...base,
    ...(starts.length ? { repeatStarts: starts } : {}),
    ...(ends.length ? { repeatEnds: ends } : {}),
    ...(voltas.length ? { voltas } : {}),
  };
}

/** Re-fit the meter's own form to its (new) grid. */
export const refitForm = (m: Meter, map?: (t: number) => number, mapSpan?: (t: number) => number) =>
  withForm(m, formOf(m), map, mapSpan);

export interface Repeat {
  /** Where the repeated passage starts and ends (beats). */
  s: number;
  e: number;
  times: number;
}

/** The repeats of the piece, in order: each end sign paired with its start. */
export function repeatsOf(meter: Meter): Repeat[] {
  const starts = meter.repeatStarts ?? [];
  const out: Repeat[] = [];
  let prevEnd = 0;
  for (const end of meter.repeatEnds ?? []) {
    let s = prevEnd;
    for (const t of starts) if (t >= prevEnd - EPS && t < end.at - EPS) s = t;
    out.push({ s, e: end.at, times: end.times });
    prevEnd = end.at;
  }
  return out;
}

/** The repeat an ending belongs to (inside it, or right after its end sign), or -1. */
export function voltaRepeat(meter: Meter, v: Volta): { index: number; inside: boolean } {
  const reps = repeatsOf(meter);
  for (let i = 0; i < reps.length; i++)
    if (v.a >= reps[i]!.s - EPS && v.a < reps[i]!.e - EPS) return { index: i, inside: true };
  for (let i = reps.length - 1; i >= 0; i--)
    if (v.a >= reps[i]!.e - EPS) return { index: i, inside: false };
  return { index: -1, inside: false };
}

export interface Span {
  a: number;
  b: number;
  /** The pass of its repeat this stretch belongs to (1 outside repeats). */
  pass: number;
}

/**
 * The order the piece is heard in: stretches of written time, front to back. Without repeats it
 * is the whole piece once.
 */
export function playOrder(meter: Meter): Span[] {
  const NB = meter.subdivision.length;
  const voltas = meter.voltas ?? [];
  const out: Span[] = [];
  const push = (a: number, b: number, pass: number, skip: (v: Volta) => boolean) => {
    // cut out the endings that are not played on this pass
    let t = a;
    for (const v of voltas) {
      if (v.b <= t + EPS || v.a >= b - EPS || !skip(v)) continue;
      if (v.a > t + EPS) out.push({ a: t, b: v.a, pass });
      t = Math.max(t, v.b);
    }
    if (b > t + EPS) out.push({ a: t, b, pass });
  };
  let pos = 0;
  for (const r of repeatsOf(meter)) {
    push(pos, r.s, 1, () => false);
    for (let pass = 1; pass <= r.times; pass++)
      push(r.s, r.e, pass, (v) => !v.passes.includes(pass));
    pos = r.e;
  }
  push(pos, NB, 1, () => false);
  return out.length ? out : [{ a: 0, b: NB, pass: 1 }];
}

/** Length of the performance in written beats (with every repeat played out). */
export const playedBeats = (meter: Meter) =>
  playOrder(meter).reduce((sum, s) => sum + (s.b - s.a), 0);

/* ------------------------------------------------------------------ operations */

const at = (doc: Doc, k: number) => buildGrid(doc.meter).times[k];
const same = (x: number, y: number) => Math.abs(x - y) < EPS;
const withMeterForm = (doc: Doc, form: Partial<Form>): Doc => ({
  ...doc,
  meter: withForm(doc.meter, { ...formOf(doc.meter), ...form }),
});

/** Put a start-repeat sign `|:` at pulse k, or remove the one there. */
export function toggleRepeatStart(doc: Doc, k: number): OpResult {
  const t = at(doc, k);
  if (t === undefined || !Number.isInteger(k) || k >= buildGrid(doc.meter).TS)
    return { doc, report: fail('out-of-range') };
  const cur = doc.meter.repeatStarts ?? [];
  const next = cur.some((x) => same(x, t)) ? cur.filter((x) => !same(x, t)) : [...cur, t];
  return { doc: withMeterForm(doc, { repeatStarts: next }), report: report() };
}

/** Put an end-repeat sign `:|` at pulse k (played twice), or remove the one there. */
export function toggleRepeatEnd(doc: Doc, k: number, times = 2): OpResult {
  const t = at(doc, k);
  if (t === undefined || !Number.isInteger(k) || k <= 0)
    return { doc, report: fail('out-of-range') };
  const cur = doc.meter.repeatEnds ?? [];
  const next = cur.some((e) => same(e.at, t))
    ? cur.filter((e) => !same(e.at, t))
    : [...cur, { at: t, times: clampTimes(times) }];
  return { doc: withMeterForm(doc, { repeatEnds: next }), report: report() };
}

/** How many times the passage that ends at pulse k is played (2…12). */
export function setRepeatTimes(doc: Doc, k: number, times: number): OpResult {
  const t = at(doc, k);
  const cur = doc.meter.repeatEnds ?? [];
  const i = t === undefined ? -1 : cur.findIndex((e) => same(e.at, t));
  if (i < 0) return { doc, report: fail('nothing-selected') };
  const n = clampTimes(times);
  if (!Number.isInteger(times) || n !== times) return { doc, report: fail('out-of-range') };
  if (cur[i]!.times === n) return { doc, report: fail('no-change') };
  const next = cur.map((e, j) => (j === i ? { ...e, times: n } : e));
  return { doc: withMeterForm(doc, { repeatEnds: next }), report: report() };
}

export const repeatStartAt = (doc: Doc, k: number) => {
  const t = at(doc, k);
  return t !== undefined && (doc.meter.repeatStarts ?? []).some((x) => same(x, t));
};

export const repeatEndAt = (doc: Doc, k: number): RepeatEnd | null => {
  const t = at(doc, k);
  return t === undefined ? null : ((doc.meter.repeatEnds ?? []).find((e) => same(e.at, t)) ?? null);
};

/** The passes a new ending over [a, b) most likely means: 1st ending, or the last pass after. */
export function defaultPasses(meter: Meter, a: number, b: number): number[] {
  const reps = repeatsOf(meter);
  const inside = reps.find((r) => a >= r.s - EPS && a < r.e - EPS);
  if (inside) {
    // the ending that closes the repeat is the 1st (… n−1th); one earlier in it, the 1st
    const all = Array.from({ length: inside.times - 1 }, (_, i) => i + 1);
    return same(b, inside.e) ? all : [1];
  }
  const before = [...reps].reverse().find((r) => a >= r.e - EPS);
  return before ? [before.times] : [1];
}

/**
 * Put an ending over pulses [ka, kb) played on `passes`, replacing any ending it overlaps; with
 * no passes, remove the endings it overlaps.
 */
export function setVolta(doc: Doc, ka: number, kb: number, passes: readonly number[]): OpResult {
  const grid = buildGrid(doc.meter);
  if (!Number.isInteger(ka) || !Number.isInteger(kb) || ka < 0 || kb > grid.TS || kb <= ka)
    return { doc, report: fail('out-of-range') };
  const a = grid.times[ka]!;
  const b = grid.times[kb]!;
  const cur = doc.meter.voltas ?? [];
  const keep = cur.filter((v) => v.b <= a + EPS || v.a >= b - EPS);
  const ps = cleanPasses(passes);
  if (!ps.length && keep.length === cur.length) return { doc, report: fail('no-change') };
  const next = ps.length ? [...keep, { a, b, passes: ps }] : keep;
  return { doc: withMeterForm(doc, { voltas: next }), report: report() };
}

/** Remove the ending at this index. */
export function removeVolta(doc: Doc, index: number): OpResult {
  const cur = doc.meter.voltas ?? [];
  if (!cur[index]) return { doc, report: fail('nothing-selected') };
  return {
    doc: withMeterForm(doc, { voltas: cur.filter((_, i) => i !== index) }),
    report: report(),
  };
}

/** "1.", "1.2.", "3." */
export const passesLabel = (passes: readonly number[]) => passes.map((p) => `${p}.`).join(' ');

/** Problems with a meter's form (for checkInvariants). */
export function formErrors(meter: Meter): string[] {
  const errs: string[] = [];
  const g = buildGrid(meter);
  const onPulse = (t: number) => Math.abs(g.times[nearestPulse(g, t)]! - t) < EPS;
  let prev = -1;
  for (const t of meter.repeatStarts ?? []) {
    if (!(t > prev + EPS) || t < -EPS || t >= g.NB - EPS || !onPulse(t))
      errs.push(`bad repeat start ${t}`);
    prev = t;
  }
  prev = 0;
  for (const e of meter.repeatEnds ?? []) {
    if (!(e.at > prev + EPS) || e.at > g.NB + EPS || !onPulse(e.at))
      errs.push(`bad repeat end ${e.at}`);
    if (!Number.isInteger(e.times) || e.times < MIN_REPEAT || e.times > MAX_REPEAT)
      errs.push(`bad repeat count ${e.times}`);
    prev = e.at;
  }
  prev = -1;
  for (const v of meter.voltas ?? []) {
    if (v.a < prev - EPS || !(v.b > v.a + EPS) || v.a < -EPS || v.b > g.NB + EPS)
      errs.push(`bad ending ${v.a}–${v.b}`);
    if (!onPulse(v.a) || !onPulse(v.b)) errs.push(`ending off the pulses ${v.a}–${v.b}`);
    if (!v.passes.length || v.passes.some((p) => !Number.isInteger(p) || p < 1 || p > MAX_PASS))
      errs.push(`bad ending passes ${v.passes.join(',')}`);
    prev = v.b;
  }
  return errs;
}
