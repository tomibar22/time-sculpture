import { buildGrid, clamp, EPS, floorPulse, isSpace, nearestPulse } from '../engine';
import type { Doc, Grid, Item } from '../engine';

/** Layout constants (CSS pixels). */
export const L = {
  margin: 4,
  numH: 20,
  laneH: 24,
  gap1: 8,
  tileH: 52,
  ruler: 14,
  gapR: 26,
  top: 4,
} as const;

/** One row of the score: a run of whole cycles. */
export interface Row {
  /** First beat and number of beats. */
  b0: number;
  nb: number;
  /** First cycle and number of cycles. */
  c0: number;
  nc: number;
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
  grid: Grid;
}

/** `cyclesPerRow` must be normalised (sum = cycles); defaults to one cycle per row. */
export function geometry(width: number, doc: Doc, cyclesPerRow?: readonly number[]): Geo {
  const B = doc.meter.beatsPerCycle;
  const counts = cyclesPerRow?.length ? cyclesPerRow : Array<number>(doc.meter.cycles).fill(1);
  const rows: Row[] = [];
  let c = 0;
  for (const nc of counts) {
    rows.push({ b0: c * B, nb: nc * B, c0: c, nc });
    c += nc;
  }
  const widest = Math.max(...rows.map((r) => r.nb));
  const bw = (width - 2 * L.margin) / widest;
  const stride = L.numH + L.laneH + L.gap1 + L.tileH + L.ruler + L.gapR;
  return {
    w: width,
    h: L.top + rows.length * stride - L.gapR + 8,
    B,
    R: rows.length,
    rows,
    bw,
    stride,
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
export const rowEndX = (g: Geo, r: number) => L.margin + g.rows[r]!.nb * g.bw;

export const rowTop = (g: Geo, r: number) => L.top + r * g.stride;
export const laneY = (g: Geo, r: number) => rowTop(g, r) + L.numH;
export const tileY = (g: Geo, r: number) => laneY(g, r) + L.laneH + L.gap1;

/** x position and row of a time in beats. A time on a row boundary belongs to the next row. */
export function xOf(g: Geo, t: number): { x: number; r: number } {
  const r = rowOf(g, t);
  return { x: L.margin + (t - g.rows[r]!.b0) * g.bw, r };
}

export type Zone = 'lane' | 'tiles';

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
  const raw = (x - L.margin) / g.bw;
  const local = clamp(raw, 0, row.nb);
  const t = row.b0 + local;
  const beat = row.b0 + Math.min(row.nb - 1, Math.floor(local));
  return {
    r,
    t,
    zone: ry < L.numH + L.laneH + 3 ? 'lane' : 'tiles',
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
  const { times, pre, NB } = g.grid;
  let a = s;
  while (a < s + n) {
    const t0 = times[a]!;
    const r = rowOf(g, t0);
    const row = g.rows[r]!;
    const rowEnd = pre[Math.min(row.b0 + row.nb, NB)]!;
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
export function hitBoundary(g: Geo, items: readonly Item[], x: number, y: number): Boundary | null {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles') return null;
  const d = g.grid.pre[h.beat + 1]! - g.grid.pre[h.beat]!;
  const pw = g.bw / d;
  let best: Boundary | null = null;
  let bd = Math.max(6, Math.min(11, pw * 0.32));
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
