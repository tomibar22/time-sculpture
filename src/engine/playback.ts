import { beatOfPulse, buildGrid, ceilPulse, EPS, isOnBeat } from './grid';
import { isSpace } from './doc';
import type { Doc, Group } from './types';
import { barMap } from './sections';

/** Pentatonic scale degrees (major pentatonic) used to pitch groups by size. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;
export const BASE_FREQ = 196; // G3

/** Frequency for a sounding group of n pulses: 1 → G3, then up the major pentatonic. */
export function pitchForSize(n: number): number {
  const i = Math.max(0, n - 1);
  const semis = PENTATONIC[i % 5]! + 12 * Math.floor(i / 5);
  return BASE_FREQ * Math.pow(2, semis / 12);
}

export type ClickKind = 'landing' | 'downbeat' | 'beat' | 'tick';

/** One pulse the player is about to sound. */
export interface PulseEvent {
  /** Pulse index. */
  readonly k: number;
  /** Start and end time in beats. */
  readonly t0: number;
  readonly t1: number;
  readonly beat: number;
  readonly click: ClickKind;
  /** The sounding group that starts here, if any. */
  readonly onset: Group | null;
}

/**
 * The pulse that starts at or after beat-time T (wrapping to 0 at the end of the piece).
 * The player walks beat-time, so edits and subdivision changes take effect immediately
 * without the playhead jumping.
 */
export function nextPulse(doc: Doc, T: number): PulseEvent {
  const grid = buildGrid(doc.meter);
  let k = ceilPulse(grid, T < 0 ? 0 : T);
  if (k >= grid.TS || T >= grid.NB - EPS) k = 0;
  const beat = beatOfPulse(grid, k);
  const click: ClickKind =
    k === 0
      ? 'landing'
      : isOnBeat(grid, k)
        ? barMap(doc.meter).beatInBar[beat] === 0
          ? 'downbeat'
          : 'beat'
        : 'tick';
  let onset: Group | null = null;
  let a = 0;
  for (const x of doc.items) {
    if (a === k && x.n > 0) {
      if (!isSpace(x) && x.kind === 'sound') onset = x;
      break;
    }
    a += x.n;
    if (a > k) break;
  }
  return { k, t0: grid.times[k]!, t1: grid.times[k + 1]!, beat, click, onset };
}
