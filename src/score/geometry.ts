import { buildGrid, clamp, EPS, floorPulse, isSpace, nearestPulse, totalLevels } from '../engine';
import type { Doc, Grid, Item } from '../engine';
import { rowLayout } from './rows';

/** Layout constants (CSS pixels). */
/**
 * Each row, top to bottom: beat numbers, the tiles, then the subdivision band (one pill per
 * beat with a dot per pulse). The band both shows the subdivision and is where it is painted.
 */
export const L = {
  /** Each row's left and right gutter: a tap there puts the caret at the row's start / end. */
  margin: 18,
  numH: 20,
  gap1: 4,
  tileH: 52,
  bandGap: 5,
  bandH: 22,
  gapR: 24,
  top: 4,
} as const;

/** One row of the score: a span of time (it may start or end inside a bar or a beat). */
export interface Row {
  /** Start time and length in beats. */
  b0: number;
  nb: number;
  /** First pulse and the pulse after the last. */
  k0: number;
  k1: number;
  /** It starts at a manual line break. */
  manual: boolean;
  /** Beat width in this row (wider than `Geo.bw` when short rows are fitted to the width). */
  bw: number;
}

export interface Geo {
  w: number;
  h: number;
  /** Beats per cycle. */
  B: number;
  /** Number of rows. */
  R: number;
  rows: Row[];
  /** Beat width: the same in every row, so beats line up vertically like a score. */
  bw: number;
  stride: number;
  /** Extra space above every row for endings and repeat counts (0 when the piece has none). */
  lane: number;
  /** Space under every row's band for totals (0 when the piece has none). */
  under: number;
  /** Each total's stacking level (0 = right under the band), index by index. */
  totalLevels: number[];
  grid: Grid;
}

/** Bottom of the band, from the top of a row's number line. */
const BAND_END = L.numH + L.gap1 + L.tileH + L.bandGap + L.bandH;

/** Height of one level of totals under the band. */
export const TOTAL_H = 18;

/** Height of the lane above the rows that holds ending brackets and "×3" repeat counts. */
export const LANE_H = 18;

/** Does the piece need the lane above its rows? */
export const needsLane = (doc: Doc) =>
  !!doc.meter.voltas?.length || (doc.meter.repeatEnds ?? []).some((e) => e.times > 2);

/** Rows wrap every `perRow` bars and at the document's manual line breaks (see rows.ts). */
export function geometry(width: number, doc: Doc, perRow = 1, fit = false): Geo {
  const B = doc.meter.beatsPerCycle;
  const rows: Row[] = rowLayout(doc.meter, perRow).map((r) => ({
    b0: r.t0,
    nb: r.t1 - r.t0,
    k0: r.k0,
    k1: r.k1,
    manual: r.manual,
    bw: 0,
  }));
  const widest = Math.max(...rows.map((r) => r.nb));
  const bw = (width - 2 * L.margin) / widest;
  // fitted rows stretch to the full width; otherwise every row shares one beat width
  for (const row of rows) row.bw = fit ? (width - 2 * L.margin) / row.nb : bw;
  const lane = needsLane(doc) ? LANE_H : 0;
  const totalLv = totalLevels(doc.meter.totals ?? []);
  const under = totalLv.length ? (Math.max(...totalLv) + 1) * TOTAL_H + 2 : 0;
  const stride = lane + L.numH + L.gap1 + L.tileH + L.bandGap + L.bandH + under + L.gapR;
  return {
    w: width,
    h: L.top + rows.length * stride - L.gapR + 8,
    B,
    R: rows.length,
    rows,
    bw,
    stride,
    lane,
    under,
    totalLevels: totalLv,
    grid: buildGrid(doc.meter),
  };
}

/** Row containing time t (a time on a row boundary belongs to the next row). */
export function rowOf(g: Geo, t: number): number {
  let r = 0;
  while (r + 1 < g.R && g.rows[r + 1]!.b0 <= t + EPS) r++;
  return r;
}

/** Is time t exactly where a row (other than the first) begins? Returns that row, or -1. */
export function rowStartingAt(g: Geo, t: number): number {
  for (let r = 1; r < g.R; r++) if (Math.abs(g.rows[r]!.b0 - t) < EPS) return r;
  return -1;
}

/** Right edge x of a row. */
export const rowEndX = (g: Geo, r: number) => L.margin + g.rows[r]!.nb * g.rows[r]!.bw;

/** Top of a row's number line (below the lane, when there is one). */
export const rowTop = (g: Geo, r: number) => L.top + r * g.stride + g.lane;
export const tileY = (g: Geo, r: number) => rowTop(g, r) + L.numH + L.gap1;
/** Top of the subdivision band under the tiles. */
export const bandY = (g: Geo, r: number) => tileY(g, r) + L.tileH + L.bandGap;

/** x position and row of a time in beats. A time on a row boundary belongs to the next row. */
export function xOf(g: Geo, t: number): { x: number; r: number } {
  const r = rowOf(g, t);
  return { x: L.margin + (t - g.rows[r]!.b0) * g.rows[r]!.bw, r };
}

export type Zone = 'lane' | 'tiles' | 'totals';

export interface Hit {
  r: number;
  /** Time in beats under the pointer (clamped to the row). */
  t: number;
  zone: Zone;
  /** Beat index under the pointer. */
  beat: number;
  /** The pointer is right of a row that is shorter than the widest one. */
  outside: boolean;
}

export function hit(g: Geo, x: number, y: number): Hit {
  const r = clamp(Math.floor((y - L.top + L.gapR / 2) / g.stride), 0, g.R - 1);
  const row = g.rows[r]!;
  const ry = y - rowTop(g, r);
  const raw = (x - L.margin) / row.bw;
  const local = clamp(raw, 0, row.nb);
  const t = row.b0 + local;
  // the beat under the pointer, kept inside the row (rows may start or end mid-beat)
  const beat = clamp(
    Math.floor(t + EPS),
    Math.floor(row.b0 + EPS),
    Math.ceil(row.b0 + row.nb - EPS) - 1,
  );
  return {
    r,
    t,
    // below the tiles: the band (and half the gap to the next row) paints subdivision, except
    // where totals hang under the band
    zone:
      ry < L.numH + L.gap1 + L.tileH + 2
        ? 'tiles'
        : g.under && ry >= BAND_END && ry < BAND_END + g.under
          ? 'totals'
          : 'lane',
    beat,
    outside: raw > row.nb + 0.15,
  };
}

/** Pulse boundary nearest to the pointer. */
export const slotAt = (g: Geo, x: number, y: number) => nearestPulse(g.grid, hit(g, x, y).t);

/** Item index under the pointer (tile zone), or -1. */
export function itemAt(g: Geo, items: readonly Item[], x: number, y: number): number {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles' || h.outside) return -1;
  const k = floorPulse(g.grid, h.t);
  let a = 0;
  for (let i = 0; i < items.length; i++) {
    if (k >= a && k < a + items[i]!.n) return i;
    a += items[i]!.n;
  }
  return -1;
}

/** Split an item [s, s+n) into per-row segments. */
export interface Segment {
  r: number;
  t0: number;
  t1: number;
  first: boolean;
  last: boolean;
}

export function segments(g: Geo, s: number, n: number): Segment[] {
  const out: Segment[] = [];
  const { times } = g.grid;
  let a = s;
  while (a < s + n) {
    const t0 = times[a]!;
    const r = rowOf(g, t0);
    const row = g.rows[r]!;
    const rowEnd = row.k1;
    const e = Math.min(s + n, rowEnd);
    if (e <= a) break;
    out.push({ r, t0, t1: times[e]!, first: a === s, last: e === s + n });
    a = e;
  }
  return out;
}

export type BoundaryKind = 'line' | 'edgeR' | 'edgeL';

export interface Boundary {
  /** Pulse index of the boundary. */
  slot: number;
  kind: BoundaryKind;
  /** line: left item index; edgeR: item left of the space; edgeL: item right of the space. */
  i: number;
  key: string;
}

/** Draggable boundaries: lines between groups, and edges facing the open space. */
export function boundaries(items: readonly Item[]): Boundary[] {
  const out: Boundary[] = [];
  const vis = items.map((x, i) => ({ x, i })).filter((o) => !(isSpace(o.x) && o.x.n === 0));
  let a = 0;
  const starts: number[] = [];
  for (const x of items) {
    starts.push(a);
    a += x.n;
  }
  for (let k = 0; k < vis.length - 1; k++) {
    const A = vis[k]!;
    const B = vis[k + 1]!;
    const slot = starts[B.i]!;
    if (!isSpace(A.x) && !isSpace(B.x)) out.push({ slot, kind: 'line', i: A.i, key: `l${A.x.id}` });
    else if (isSpace(B.x)) out.push({ slot, kind: 'edgeR', i: A.i, key: `r${A.x.id}` });
    else out.push({ slot, kind: 'edgeL', i: B.i, key: `L${B.x.id}` });
  }
  return out;
}

/** Boundary under the pointer. The grab radius scales with the pulse width there. */
export function hitBoundary(
  g: Geo,
  items: readonly Item[],
  x: number,
  y: number,
  touch = false,
): Boundary | null {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles') return null;
  const d = g.grid.pre[h.beat + 1]! - g.grid.pre[h.beat]!;
  const pw = g.rows[h.r]!.bw / d;
  let best: Boundary | null = null;
  // fingers get a wider grab, but never more than ~half a pulse so narrow tiles stay tappable
  let bd = touch ? Math.max(7, Math.min(15, pw * 0.42)) : Math.max(6, Math.min(11, pw * 0.32));
  for (const b of boundaries(items)) {
    if (b.slot <= 0 || b.slot >= g.grid.TS) continue;
    const t = g.grid.times[b.slot]!;
    let p = xOf(g, t);
    // a boundary exactly at a row end also shows at the right edge of the row above
    if (rowStartingAt(g, t) === h.r + 1) p = { x: rowEndX(g, h.r), r: h.r };
    if (p.r !== h.r) continue;
    const dist = Math.abs(x - p.x);
    if (dist < bd) {
      bd = dist;
      best = b;
    }
  }
  return best;
}

/**
 * A tap that should put the caret at an edge: in a row's left gutter (its start) or right of its
 * end (the gutter, or the empty part of a row that ends early), and at the very start / end of
 * the piece also a little into the first / last tile (at most half a pulse, so narrow tiles stay
 * tappable). Returns the pulse, or null.
 */
export function edgeSlot(g: Geo, x: number, y: number, touch = false): number | null {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles') return null;
  const row = g.rows[h.r]!;
  const reach = touch ? 14 : 8;
  const pulseW = (beat: number) => row.bw / (g.grid.pre[beat + 1]! - g.grid.pre[beat]!);
  // the gutters left and right of every row belong to the caret: the row's start and end
  if (x < L.margin) return row.k0;
  const endX = rowEndX(g, h.r);
  if (x > endX) return row.k1;
  // at the very start and end of the piece the zone also reaches a little into the tile
  if (h.r === 0 && x <= L.margin + Math.min(reach, pulseW(0) * 0.5)) return 0;
  const lastBeat = Math.ceil(row.b0 + row.nb - EPS) - 1;
  if (h.r === g.R - 1 && x >= endX - Math.min(reach, pulseW(lastBeat) * 0.5)) return row.k1;
  return null;
}

/** Screen edges of item i: where its start sits and where its end sits (end of a row if it ends there). */
export function itemEdges(
  g: Geo,
  items: readonly Item[],
  i: number,
): { start: { x: number; r: number }; end: { x: number; r: number }; s: number; e: number } {
  let s0 = 0;
  for (let j = 0; j < i; j++) s0 += items[j]!.n;
  const e0 = s0 + items[i]!.n;
  const t0 = g.grid.times[s0]!;
  const t1 = g.grid.times[e0]!;
  const startsRow = rowStartingAt(g, t1);
  const end =
    startsRow > 0
      ? { x: rowEndX(g, startsRow - 1), r: startsRow - 1 }
      : xOf(g, Math.min(t1, g.grid.NB - 1e-6));
  if (t1 >= g.grid.NB) end.x = rowEndX(g, g.R - 1);
  return { start: xOf(g, t0), end, s: s0, e: e0 };
}

/**
 * Trim grip of a selected item under the pointer: its start or end edge. The grip reaches a bit
 * inside the tile and a bit outside it.
 */
export function hitTrimGrip(
  g: Geo,
  items: readonly Item[],
  i: number,
  x: number,
  y: number,
  touch = false,
): 'start' | 'end' | null {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles') return null;
  const ed = itemEdges(g, items, i);
  const width = ed.start.r === ed.end.r ? ed.end.x - ed.start.x : Infinity;
  const inside = Math.min(touch ? 16 : 12, width * 0.3);
  const outside = touch ? 12 : 8;
  if (ed.end.r === h.r && x >= ed.end.x - inside && x <= ed.end.x + outside) return 'end';
  if (ed.start.r === h.r && x >= ed.start.x - outside && x <= ed.start.x + inside) return 'start';
  return null;
}

/** Top of the totals under a row's band (level 0); level n is TOTAL_H × n lower. */
export const totalsY = (g: Geo, r: number) => rowTop(g, r) + BAND_END + 2;

/** The total whose bracket is under the pointer (index into meter.totals), or -1. */
export function totalAt(g: Geo, doc: Doc, x: number, y: number): number {
  const h = hit(g, x, y);
  if (h.zone !== 'totals') return -1;
  const lv = Math.floor((y - totalsY(g, h.r)) / TOTAL_H);
  const totals = doc.meter.totals ?? [];
  return totals.findIndex(
    (v, i) => g.totalLevels[i] === lv && h.t >= v.a - 0.05 && h.t <= v.b + 0.05,
  );
}
