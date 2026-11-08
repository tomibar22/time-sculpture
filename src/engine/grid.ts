import type { Meter } from './types';

export const MIN_BEATS = 3;
export const MAX_BEATS = 13;
export const MIN_CYCLES = 1;
export const MAX_CYCLES = 32;
export const MIN_SUBDIVISION = 1;
export const MAX_SUBDIVISION = 8;

export const EPS = 1e-9;

/**
 * The pulse grid derived from a meter. Times are in beats.
 * Pulse j of beat b (which has d pulses) starts at time b + j/d.
 */
export interface Grid {
  /** Total beats in the piece. */
  readonly NB: number;
  /** Total pulses in the piece. */
  readonly TS: number;
  /** pre[b] = index of the first pulse of beat b; pre[NB] = TS. */
  readonly pre: readonly number[];
  /** times[k] = start time (beats) of pulse k; times[TS] = NB. */
  readonly times: readonly number[];
}

const cache = new WeakMap<Meter, Grid>();

export function buildGrid(meter: Meter): Grid {
  const hit = cache.get(meter);
  if (hit) return hit;
  const NB = meter.subdivision.length;
  const pre = [0];
  const times: number[] = [];
  for (let b = 0; b < NB; b++) {
    const d = meter.subdivision[b] ?? 1;
    pre.push(pre[b]! + d);
    for (let j = 0; j < d; j++) times.push(b + j / d);
  }
  times.push(NB);
  const grid: Grid = { NB, TS: pre[NB]!, pre, times };
  cache.set(meter, grid);
  return grid;
}

export function totalPulses(meter: Meter): number {
  return buildGrid(meter).TS;
}

/** Beat that contains pulse k (k in 0..TS-1; TS maps to the last beat). */
export function beatOfPulse(grid: Grid, k: number): number {
  let lo = 0;
  let hi = grid.NB - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (grid.pre[m]! <= k) lo = m;
    else hi = m - 1;
  }
  return lo;
}

/** Pulse boundary (0..TS) nearest to time t. Ties go to the earlier boundary. */
export function nearestPulse(grid: Grid, t: number): number {
  const T = grid.times;
  if (t <= 0) return 0;
  if (t >= grid.NB) return grid.TS;
  let lo = 0;
  let hi = T.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (T[m]! <= t) lo = m;
    else hi = m;
  }
  return t - T[lo]! <= T[hi]! - t + EPS ? lo : hi;
}

/** Last pulse boundary at or before time t. */
export function floorPulse(grid: Grid, t: number): number {
  const T = grid.times;
  if (t <= 0) return 0;
  if (t >= grid.NB) return grid.TS;
  let lo = 0;
  let hi = T.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (T[m]! <= t + EPS) lo = m;
    else hi = m;
  }
  return lo;
}

/** First pulse boundary at or after time t. */
export function ceilPulse(grid: Grid, t: number): number {
  const f = floorPulse(grid, t);
  return grid.times[f]! >= t - EPS ? f : f + 1;
}

export function isOnBeat(grid: Grid, k: number): boolean {
  const t = grid.times[k]!;
  return Math.abs(t - Math.round(t)) < EPS;
}

/** The most common subdivision (ties: the smaller one). */
export function commonSubdivision(meter: Meter): number {
  const counts = new Map<number, number>();
  for (const d of meter.subdivision) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best = meter.subdivision[0] ?? 1;
  let bestCount = -1;
  for (const [d, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}
