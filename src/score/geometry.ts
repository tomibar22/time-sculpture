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

export interface Geo {
  w: number;
  h: number;
  B: number;
  C: number;
  bw: number;
  stride: number;
  grid: Grid;
}

export function geometry(width: number, doc: Doc): Geo {
  const B = doc.meter.beatsPerCycle;
  const C = doc.meter.cycles;
  const bw = (width - 2 * L.margin) / B;
  const stride = L.numH + L.laneH + L.gap1 + L.tileH + L.ruler + L.gapR;
  return {
    w: width,
    h: L.top + C * stride - L.gapR + 8,
    B,
    C,
    bw,
    stride,
    grid: buildGrid(doc.meter),
  };
}

export const rowTop = (g: Geo, r: number) => L.top + r * g.stride;
export const laneY = (g: Geo, r: number) => rowTop(g, r) + L.numH;
export const tileY = (g: Geo, r: number) => laneY(g, r) + L.laneH + L.gap1;

/** x position and row of a time in beats. A time on a row boundary belongs to the next row. */
export function xOf(g: Geo, t: number): { x: number; r: number } {
  const r = Math.min(Math.floor(t / g.B + EPS), g.C - 1);
  return { x: L.margin + (t - r * g.B) * g.bw, r };
}

export type Zone = 'lane' | 'tiles';

export interface Hit {
  r: number;
  /** Time in beats under the pointer (clamped to the row). */
  t: number;
  zone: Zone;
  /** Beat index under the pointer. */
  beat: number;
}

export function hit(g: Geo, x: number, y: number): Hit {
  const r = clamp(Math.floor((y - L.top + L.gapR / 2) / g.stride), 0, g.C - 1);
  const ry = y - rowTop(g, r);
  const local = clamp((x - L.margin) / g.bw, 0, g.B);
  const t = r * g.B + local;
  const beat = r * g.B + Math.min(g.B - 1, Math.floor(local));
  return { r, t, zone: ry < L.numH + L.laneH + 3 ? 'lane' : 'tiles', beat };
}

/** Pulse boundary nearest to the pointer. */
export const slotAt = (g: Geo, x: number, y: number) => nearestPulse(g.grid, hit(g, x, y).t);

/** Item index under the pointer (tile zone), or -1. */
export function itemAt(g: Geo, items: readonly Item[], x: number, y: number): number {
  const h = hit(g, x, y);
  if (h.zone !== 'tiles') return -1;
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
    const r = Math.min(Math.floor(t0 / g.B + EPS), g.C - 1);
    const rowEnd = pre[Math.min((r + 1) * g.B, NB)]!;
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
    if (Math.abs(t / g.B - Math.round(t / g.B)) < EPS && Math.round(t / g.B) === h.r + 1)
      p = { x: L.margin + g.B * g.bw, r: h.r };
    if (p.r !== h.r) continue;
    const dist = Math.abs(x - p.x);
    if (dist < bd) {
      bd = dist;
      best = b;
    }
  }
  return best;
}
