/**
 * The outline of a passage: the statements it is made of (a tihai's three, a yati's, a korvai's
 * yati and mora), and inside each statement its own statements when it is a small tihai itself
 * (a tihai of tihais). Shown under the score as brackets, each top statement marked with where it
 * lands (Nelson: a statement lands where the stroke after it begins), so the hidden arithmetic of
 * a long phrase can be seen: inner tihais landing 2 before the 1, then 1 before, then on it.
 */
import { buildGrid, beatOfPulse } from './grid';
import { barBeat } from './sections';
import type { Grid } from './grid';
import type { Meter } from './types';
import { statementsOf } from './yati';

export interface OutlineSpan {
  /** Pulses from the passage's start. */
  a: number;
  b: number;
  /** 0 = a statement of the passage; 1 = a statement inside one. */
  depth: number;
  /** A statement, or the yati that leads into a korvai's mora. */
  kind: 'statement' | 'yati';
}

const eq = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Tiles [from, to) of each statement, as read; null when it is not statements. */
type Reading = [number, number][];

/**
 * Three equal statements with equal gaps (0–3 tiles) between them, the last possibly cut (its last
 * tile is the 1 after the passage). One tile alone with no gap is not a statement.
 */
function tihaiRead(t: readonly number[]): Reading | null {
  const N = t.length;
  // a gap is not longer than a statement (3 2 (1) 3 2 (1) 3 [2] is cut, not "3" with "2 1"
  // between); whole statements are read first
  for (const cut of [false, true])
    for (let gl = 0; gl <= 3; gl++) {
      const rest = N - 2 * gl + (cut ? 1 : 0);
      if (rest % 3) continue;
      const L = rest / 3;
      if (L < 1 || (L === 1 && !gl) || (cut && L < 2) || gl > L) continue;
      const cell = t.slice(0, L);
      const gap = t.slice(L, L + gl);
      const out: Reading = [];
      let at = 0;
      let ok = true;
      for (let i = 0; i < 3 && ok; i++) {
        const len = cut && i === 2 ? L - 1 : L;
        if (!eq(t.slice(at, at + len), cell.slice(0, len))) ok = false;
        out.push([at, at + len]);
        at += len;
        if (i < 2) {
          if (!eq(t.slice(at, at + gl), gap)) ok = false;
          at += gl;
        }
      }
      if (ok && at === N) return out;
    }
  return null;
}

/** Statements read by engine/yati.ts (a yati: the main size changing; also 2, 4, 5 of them). */
function yatiRead(t: readonly number[], ks?: number[]): Reading | null {
  const st = statementsOf(t, ks);
  if (!st) return null;
  const L = st.cell.length;
  const gl = st.gap.length;
  const out: Reading = [];
  let at = st.before ? gl : 0;
  for (let i = 0; i < st.k; i++) {
    const len = st.cut && i === st.k - 1 ? L - 1 : L;
    out.push([at, at + len]);
    at += len + gl;
  }
  return out;
}

/** Three statements or more (two read anything as statements). */
function read(t: readonly number[], ks: number[] = [3, 4, 5]): Reading | null {
  return tihaiRead(t) ?? yatiRead(t, ks);
}

const gapped = (r: Reading) => r.length > 1 && r[1]![0] > r[0]![1];

/** The outline of a passage (tile sizes, silences included), in pulses from its start. */
export function outlineOf(sizes: readonly number[]): OutlineSpan[] {
  const N = sizes.length;
  if (N < 3) return [];
  const pos = [0];
  for (const n of sizes) pos.push(pos[pos.length - 1]! + n);
  const out: OutlineSpan[] = [];
  /** Spans of the statements of tiles [from, from + reading), and their own inner statements. */
  const put = (r: Reading, from: number, cut: boolean) => {
    r.forEach(([i, j], s) => {
      const last = s === r.length - 1;
      // a cut statement lands where its missing last tile would begin: the passage's end
      const b = last && cut ? pos[N]! : pos[from + j]!;
      out.push({ a: pos[from + i]!, b, depth: 0, kind: 'statement' });
      const inner = tihaiRead(sizes.slice(from + i, from + j));
      if (inner)
        for (const [p, q] of inner)
          out.push({ a: pos[from + i + p]!, b: pos[from + i + q]!, depth: 1, kind: 'statement' });
    });
  };
  const isCut = (r: Reading, from: number) =>
    r.length > 1 &&
    r[r.length - 1]![1] - r[r.length - 1]![0] < r[0]![1] - r[0]![0] &&
    from + r[r.length - 1]![1] === N;
  const whole = read(sizes);
  if (whole) {
    put(whole, 0, isCut(whole, 0));
    return out;
  }
  // a korvai: a yati of at least two tiles, then a mora (three statements) to the end; a mora
  // with gaps is the likelier reading (6 5 4 3 2 1 | 3 (1) 3 (1) 3, not … 2 | 1 3 · 1 3 · 1 3)
  for (const needGap of [true, false])
    for (let i = 2; i <= N - 3; i++) {
      const r = read(sizes.slice(i), [3]);
      if (!r || r.length !== 3 || (needGap && !gapped(r))) continue;
      out.push({ a: 0, b: pos[i]!, depth: 0, kind: 'yati' });
      put(r, i, isCut(r, i));
      return out;
    }
  return [];
}

/** Is pulse k a 1: the first pulse of a bar, or the end of the piece? */
export function isOnOne(meter: Meter, grid: Grid, k: number): boolean {
  if (k >= grid.TS) return true;
  const b = beatOfPulse(grid, k);
  return grid.pre[b] === k && barBeat(meter, b).beat === 1;
}

/**
 * Where pulse k stands against the nearest beat line, in a few words: "on 1", "on beat 3",
 * "2 before 1", "1 after beat 2" (a tie goes to the line after it).
 */
export function whereWords(meter: Meter, k: number, grid: Grid = buildGrid(meter)): string {
  if (k >= grid.TS) return 'on 1';
  const name = (b: number) => {
    if (b >= grid.NB) return '1';
    const n = barBeat(meter, b).beat;
    return n === 1 ? '1' : `beat ${n}`;
  };
  const b = beatOfPulse(grid, Math.max(0, k));
  if (grid.pre[b] === k) return `on ${name(b)}`;
  const back = k - grid.pre[b]!;
  const on = grid.pre[b + 1]! - k;
  return on <= back ? `${on} before ${name(b + 1)}` : `${back} after ${name(b)}`;
}
