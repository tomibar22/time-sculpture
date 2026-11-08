import { barMap, buildGrid, EPS, nearestPulse, sectionAt } from '../engine';
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
  const per = Math.max(1, Math.min(MAX_PER_ROW, Math.round(perRow)));
  const map = barMap(meter);
  const breaks = meter.breaks ?? [];
  // a modulation always starts a new row
  const sectionStarts = map.sections.slice(1).map((s) => s.at);
  const rows: RowSpan[] = [];
  let t0 = 0;
  let manual = false;
  let bi = 0;
  while (t0 < grid.NB - EPS) {
    while (bi < breaks.length && breaks[bi]! <= t0 + EPS) bi++;
    const nextBreak = breaks[bi] ?? Infinity;
    const nextSection = sectionStarts.find((a) => a > t0 + EPS) ?? Infinity;
    // wrap after `per` bars of the section we are in; from a mid-bar break, after the same span
    const sec = map.sections[sectionAt(meter, t0)]!;
    const barIdx = map.barStarts.indexOf(Math.round(t0));
    const onBarLine = Math.abs(t0 - Math.round(t0)) < EPS && barIdx >= 0;
    const auto = onBarLine ? (map.barStarts[barIdx + per] ?? grid.NB) : t0 + per * sec.beatsPerBar;
    const t1 = Math.min(nextBreak, nextSection, auto, grid.NB);
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
