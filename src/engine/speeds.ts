/**
 * Speeds (laykari): one phrase of n strokes said again at other speeds, the strokes getting
 * shorter (or longer) while their number stays: 3 3 3 3 3 · 2 2 2 2 2 · 1 1 1 1 1 (study 2,
 * docs/studies/speeds-3-2-1.md). It is the other side of a yati's inside: there the size stays
 * and the count grows (X · X X · X X X); here the count stays and the size shrinks. Both keep a
 * sum, so both can be shared out again without moving the landing.
 */
import { balanceName, rebalances, statementsOf } from './yati';

export interface Run {
  n: number;
  size: number;
}

/** A passage as runs of equal tiles: 3 3 3 2 2 1 → 3×3 2×2 1×1. */
export function runsAll(t: readonly number[]): Run[] {
  const out: Run[] = [];
  for (const size of t) {
    const last = out[out.length - 1];
    if (last && last.size === size) last.n++;
    else out.push({ n: 1, size });
  }
  return out;
}

/** A ladder: neighbouring runs with the same number of strokes (n ≥ 2), each a new size. */
export interface Ladder {
  /** Index of its first tile. */
  at: number;
  n: number;
  sizes: number[];
}

/** The longest ladder in a cell (most runs, then most strokes), or null. */
export function ladderOf(cell: readonly number[]): Ladder | null {
  const runs = runsAll(cell);
  let best: Ladder | null = null;
  let at = 0;
  for (let i = 0; i < runs.length; i++) {
    const n = runs[i]!.n;
    let j = i;
    const sizes: number[] = [];
    while (j < runs.length && runs[j]!.n === n && !sizes.includes(runs[j]!.size))
      sizes.push(runs[j++]!.size);
    if (
      n >= 2 &&
      sizes.length >= 2 &&
      (!best ||
        sizes.length > best.sizes.length ||
        (sizes.length === best.sizes.length && n > best.n))
    )
      best = { at, n, sizes };
    at += runs[i]!.n;
  }
  return best;
}

/** The cell with its ladder said at `sizes` instead (same strokes, other speeds). */
export function withLadder(cell: readonly number[], l: Ladder, sizes: readonly number[]): number[] {
  const out = [...cell];
  sizes.forEach((s, r) => {
    for (let i = 0; i < l.n; i++) out[l.at + r * l.n + i] = s;
  });
  return out;
}

const SAY: Record<string, string> = {
  Even: 'one speed',
  Widening: 'slower and slower',
  Narrowing: 'faster and faster',
  Swelling: 'slow, fast, slow',
  Pinched: 'fast, slow, fast',
};

/**
 * "Speeds 3 → 2 → 1 (faster and faster)": by direction (shorter and shorter strokes = faster),
 * whatever the step (4 → 2 → 1 too); else by the way the sizes share out (slow, fast, slow).
 */
export function speedsName(sizes: readonly number[]): string {
  const down = sizes.every((s, i) => !i || s < sizes[i - 1]!);
  const up = sizes.every((s, i) => !i || s > sizes[i - 1]!);
  const name = balanceName(sizes);
  const say = down
    ? 'faster and faster'
    : up
      ? 'slower and slower'
      : name
        ? (SAY[name] ?? name.toLowerCase())
        : '';
  return `Speeds ${sizes.join(' → ')}${say ? ` (${say})` : ''}`;
}

/** A passage read as statements of a cell that holds a ladder (or as one such cell). */
function readLadder(t: readonly number[]) {
  const st = statementsOf(t);
  if (st && st.xs.every((x) => x === st.xs[0])) {
    const l = ladderOf(st.cell);
    if (l) return { st, cell: st.cell, l };
  }
  const l = ladderOf(t);
  return l ? { st: null, cell: [...t], l } : null;
}

/** A passage again with every statement's cell replaced. */
function sayAll(
  st: NonNullable<ReturnType<typeof statementsOf>>,
  cell: readonly number[],
): number[] {
  const out: number[] = st.before ? [...st.gap] : [];
  for (let i = 0; i < st.k; i++) {
    const c = [...cell];
    if (st.cut && i === st.k - 1) c.pop();
    out.push(...c);
    if (i < st.k - 1) out.push(...st.gap);
  }
  return out;
}

/**
 * The phrase's speeds shared out again with the same sum (3 2 1 → 1 2 3 slower and slower,
 * 2 2 2 one speed, 1 4 1 …): the same number of strokes, every statement the same length, so the
 * landing stays.
 */
export function speedBalances(t: readonly number[]): { sizes: number[]; label: string }[] {
  const r = readLadder(t);
  if (!r) return [];
  const out: { sizes: number[]; label: string }[] = [];
  for (const b of rebalances(r.l.sizes)) {
    const cell = withLadder(r.cell, r.l, b.xs);
    out.push({
      sizes: r.st ? sayAll(r.st, cell) : cell,
      label: `${speedsName(b.xs)}, ${r.l.n} strokes each`,
    });
  }
  return out;
}

/**
 * The name of a fill that is a phrase at several speeds: "Speeds 3 → 2 → 1 (faster and faster),
 * 5 each, 3 closing · ×3", or null. The ladder has ≥ 3 strokes a speed; it covers its cell but
 * for one closing stroke; it needs three speeds at least.
 */
export function speedsLabel(t: readonly number[]): string | null {
  if (t.length < 9) return null;
  // cheap first: three runs of three strokes at least
  if (runsAll(t).filter((r) => r.n >= 3).length < 3) return null;
  const r = readLadder(t);
  if (!r || r.l.n < 3) return null;
  const rest = r.cell.length - r.l.n * r.l.sizes.length;
  if (r.l.at !== 0 || rest > 1) return null;
  // two speeds read better as a repeat (3 3 3 2 2 2 twice); three make a ladder, in simple
  // ratios (16 15 14 is no change of speed)
  if (r.l.sizes.length < 3 || !simpleRatios(r.l.sizes)) return null;
  const closing = rest === 1 ? r.cell[r.cell.length - 1]! : 0;
  const gap = r.st?.gap.length
    ? `, ${r.st.gap.join(' ')} ${r.st.before ? 'before each' : 'between'}`
    : '';
  const times = r.st ? ` · ×${r.st.k}${gap}${r.st.cut ? ', last on the 1' : ''}` : '';
  return `${speedsName(r.l.sizes)}, ${r.l.n} each${closing ? `, ${closing} closing` : ''}${times}`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Speeds in simple ratios: a unit times small multiples (at most 6 units: 3 2 1, 4 2 1, 6 4 3,
 * 6 3 2), not merely different sizes (16 15 14 is no change of speed).
 */
export function simpleRatios(sizes: readonly number[]): boolean {
  const g = sizes.reduce(gcd, 0);
  return g > 0 && Math.max(...sizes) / g <= 6;
}

/** Ladders of 3–`most` speeds from `S` in simple ratios, faster and faster, and turned round. */
function ladders(S: readonly number[], most: number): number[][] {
  const ok = new Set(S);
  const mults: number[][] = [];
  const go = (cur: number[]) => {
    if (cur.length >= 3 && cur.reduce(gcd, 0) === 1) mults.push([...cur]);
    if (cur.length === most) return;
    for (let m = (cur[cur.length - 1] ?? 7) - 1; m >= 1; m--) go([...cur, m]);
  };
  go([]);
  const out: number[][] = [];
  for (const m of mults)
    for (let u = 1; u * m[0]! <= 16; u++) {
      const l = m.map((x) => x * u);
      if (l.every((x) => ok.has(x))) out.push(l, [...l].reverse());
    }
  return out;
}

/**
 * Phrases at several speeds of exactly R pulses from `sizes`: n strokes (3–8) at each size of a
 * ladder, with or without a closing stroke, once or three times (the last closing stroke cut,
 * falling on the 1, or not). Only fills `speedsLabel` names are kept.
 */
export function speedFills(R: number, sizes: readonly number[], limit = 60): number[][] {
  const S = [...new Set(sizes)].filter((n) => n >= 1);
  const out: number[][] = [];
  const seen = new Set<string>();
  if (S.length < 3 || R < 6) return out;
  for (const l of ladders(S, S.length > 9 ? 3 : 4)) {
    if (out.length >= 3 * limit) break;
    const sum = l.reduce((a, b) => a + b, 0);
    for (const c of [0, ...S])
      for (const [k, cut] of [
        [1, false],
        [3, false],
        [3, true],
      ] as const) {
        if (cut && !c) continue;
        const room = R + (cut ? c : 0);
        if (room % k) continue;
        const n = (room / k - c) / sum;
        if (!Number.isInteger(n) || n < 3 || n > 8) continue;
        const cell = [...l.flatMap((s) => Array<number>(n).fill(s)), ...(c ? [c] : [])];
        const t = Array.from({ length: k }, () => cell).flat();
        if (cut) t.pop();
        const key = t.join(' ');
        if (seen.has(key) || !speedsLabel(t)) continue;
        seen.add(key);
        out.push(t);
      }
  }
  return out.sort((a, b) => a.length - b.length).slice(0, limit);
}
