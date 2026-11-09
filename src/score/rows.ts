import { barMap, buildGrid, EPS, nearestPulse, sectionAt } from '../engine';
import type { Meter } from '../engine';

/**
 * Score rows, like lines of text. Automatic wrapping fills each row with `perRow` bars; a manual
 * line break (meter.breaks, any pulse) starts a new row, and wrapping restarts from there, so a
 * break in the middle of a bar shifts the following rows by the same amount: rhythmic structures
 * that do not start on beat 1 line up vertically. Another break on a bar line realigns them.
 */
export const MAX_PER_ROW = 8;
/** Widest row the overview may use (bars). */
export const MAX_OVERVIEW = 64;

/**
 * Zoom levels: bars per row, from a quarter bar (zoomed in) to 8 bars (zoomed out). Below one
 * bar a row holds a share of the bar's beats (rounded up) and rows still restart at bar lines.
 */
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 3, 4, 6, 8] as const;
/** More levels for the overview, which fits the whole piece on the screen. */
export const OVERVIEW_LEVELS = [...ZOOM_LEVELS, 12, 16, 24, 32, 48, 64] as const;

/** Beats in a row at a zoom below one bar, for a bar of `barLen` beats. */
export const subBarBeats = (barLen: number, per: number) =>
  Math.max(1, Math.min(barLen, Math.ceil(barLen * per - 1e-9)));

/** The zoom levels that differ for this bar size (e.g. a 3-beat bar: ¼ = ½ of it are 1 and 2). */
export function zoomLevels(
  barLen: number,
  cycles: number,
  levels: readonly number[] = ZOOM_LEVELS,
) {
  const out: number[] = [];
  const seen = new Set<string>();
  for (const z of levels) {
    if (z > 1 && z > cycles) break;
    const key = z < 1 ? `b${subBarBeats(barLen, z)}` : `B${z}`;
    if (z < 1 && subBarBeats(barLen, z) >= barLen) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(z);
  }
  return out;
}

/** "2 beats", "1 bar", "4 bars": what a row holds at this zoom. */
export function zoomLabel(barLen: number, per: number): string {
  if (per < 1) {
    const n = subBarBeats(barLen, per);
    return `${n} beat${n === 1 ? '' : 's'}`;
  }
  return `${per} bar${per === 1 ? '' : 's'}`;
}

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
  // whole bars per row, or (zoomed in) a share of each bar
  const per =
    perRow < 1 ? Math.max(0.25, perRow) : Math.max(1, Math.min(MAX_OVERVIEW, Math.round(perRow)));
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
    let auto: number;
    if (per < 1) {
      // a share of the bar, restarting at every bar line
      const nextBar = map.barStarts.find((b) => b > t0 + EPS) ?? grid.NB;
      auto = Math.min(t0 + subBarBeats(sec.beatsPerBar, per), nextBar);
    } else auto = onBarLine ? (map.barStarts[barIdx + per] ?? grid.NB) : t0 + per * sec.beatsPerBar;
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
