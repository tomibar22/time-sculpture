import { buildGrid, EPS, nearestPulse } from '../engine';
import type { Meter } from '../engine';

/**
 * Score rows, like lines of text. Automatic wrapping fills each row with `perRow` bars; a manual
 * line break (meter.breaks, any pulse) starts a new row, and wrapping restarts from there, so a
 * break in the middle of a bar shifts the following rows by the same amount: rhythmic structures
 * that do not start on beat 1 line up vertically. Another break on a bar line realigns them.
 */
export const MAX_PER_ROW = 8;

export interface RowSpan {
  /** Start and end in beats, and in pulses. */
  t0: number;
  t1: number;
  k0: number;
  k1: number;
  /** The row starts at a manual line break. */
  manual: boolean;
}

export function rowLayout(meter: Meter, perRow: number): RowSpan[] {
  const grid = buildGrid(meter);
  const width = Math.max(1, Math.min(MAX_PER_ROW, Math.round(perRow))) * meter.beatsPerCycle;
  const breaks = meter.breaks ?? [];
  const rows: RowSpan[] = [];
  let t0 = 0;
  let manual = false;
  let bi = 0;
  while (t0 < grid.NB - EPS) {
    while (bi < breaks.length && breaks[bi]! <= t0 + EPS) bi++;
    const nextBreak = breaks[bi] ?? Infinity;
    const auto = t0 + width;
    const t1 = Math.min(nextBreak, auto, grid.NB);
    // rows end on a pulse (a wrap inside a beat of another ratio snaps to its nearest pulse)
    let k1 = t1 >= grid.NB - EPS ? grid.TS : nearestPulse(grid, t1);
    const k0 = nearestPulse(grid, t0);
    if (k1 <= k0) k1 = k0 + 1;
    const end = grid.times[k1]!;
    rows.push({ t0: grid.times[k0]!, t1: end, k0, k1, manual });
    manual = Math.abs(end - nextBreak) < EPS;
    t0 = end;
  }
  return rows;
}

/** Old layouts saved as bars per row become line breaks at those bar lines. */
export function rowsToBreaks(
  rows: readonly number[],
  beatsPerCycle: number,
  cycles: number,
): number[] {
  const out: number[] = [];
  let c = 0;
  for (const n of rows) {
    c += n;
    if (c >= cycles) break;
    out.push(c * beatsPerCycle);
  }
  return out;
}
