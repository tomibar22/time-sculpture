import type { TrayState } from './types';

const tableCache = new Map<string, bigint[]>();

/** ways[t] = number of ordered ways to tile t pulses with the given sizes (compositions). */
export function waysTable(T: number, sizes: readonly number[]): bigint[] {
  const S = [...new Set(sizes)].filter((s) => s >= 1).sort((a, b) => a - b);
  const key = S.join(',');
  let c = tableCache.get(key);
  if (!c) {
    c = [1n];
    tableCache.set(key, c);
  }
  for (let t = c.length; t <= Math.max(0, T); t++) {
    let v = 0n;
    for (const s of S) if (t - s >= 0) v += c[t - s]!;
    c.push(v);
  }
  return c;
}

/** Number of ways to fill R pulses with tray sizes (order matters). countWays(0) = 1. */
export function countWays(R: number, sizes: readonly number[]): bigint {
  if (R < 0) return 0n;
  return waysTable(R, sizes)[R]!;
}

/** Per tray piece: does it fit, would it leave an unfillable remainder (dead end), or is it too big? */
export function trayStates(R: number, sizes: readonly number[]): Map<number, TrayState> {
  const c = waysTable(R, sizes);
  const out = new Map<number, TrayState>();
  for (const s of sizes) out.set(s, s > R ? 'big' : c[R - s]! > 0n ? 'fits' : 'dead');
  return out;
}

function pickBig(total: bigint, rng: () => number): bigint {
  const SCALE = 2n ** 53n;
  const r = BigInt(Math.floor(rng() * Number(SCALE)));
  return (r * total) / SCALE;
}

/** A uniformly random tiling of R with tray sizes, or null if none exists. */
export function sampleTiling(
  R: number,
  sizes: readonly number[],
  rng: () => number = Math.random,
): number[] | null {
  if (R <= 0) return null;
  const c = waysTable(R, sizes);
  if (c[R] === 0n) return null;
  const S = [...new Set(sizes)].filter((s) => s >= 1).sort((a, b) => a - b);
  const out: number[] = [];
  let r = R;
  while (r > 0) {
    const options = S.filter((s) => s <= r && c[r - s]! > 0n);
    const total = options.reduce((a, s) => a + c[r - s]!, 0n);
    let pick = pickBig(total, rng);
    let chosen = options[options.length - 1]!;
    for (const s of options) {
      const w = c[r - s]!;
      if (pick < w) {
        chosen = s;
        break;
      }
      pick -= w;
    }
    out.push(chosen);
    r -= chosen;
  }
  return out;
}

/**
 * ways[j][t] = number of ordered ways to tile t pulses with exactly j tiles of the given sizes,
 * for j = 0..K (K = the most tiles that can fit: T over the smallest size).
 */
export function waysByTiles(T: number, sizes: readonly number[]): bigint[][] {
  const S = [...new Set(sizes)].filter((s) => s >= 1).sort((a, b) => a - b);
  const R = Math.max(0, T);
  const K = S.length ? Math.floor(R / S[0]!) : 0;
  const w: bigint[][] = [Array.from({ length: R + 1 }, (_, t) => (t === 0 ? 1n : 0n))];
  for (let j = 1; j <= K; j++) {
    const row = new Array<bigint>(R + 1).fill(0n);
    for (let t = 1; t <= R; t++) for (const s of S) if (t - s >= 0) row[t]! += w[j - 1]![t - s]!;
    w.push(row);
  }
  return w;
}

/** How many tiles a tiling of R with these sizes can have: every possible number, ascending. */
export function tileCounts(R: number, sizes: readonly number[]): number[] {
  if (R <= 0) return [];
  const w = waysByTiles(R, sizes);
  const out: number[] = [];
  for (let j = 1; j < w.length; j++) if (w[j]![R]! > 0n) out.push(j);
  return out;
}

/** Number of tilings of R with exactly `tiles` tiles. */
export function countWaysOf(R: number, sizes: readonly number[], tiles: number): bigint {
  if (R <= 0 || tiles < 1) return 0n;
  return waysByTiles(R, sizes)[tiles]?.[R] ?? 0n;
}

/** A uniformly random tiling of R with exactly `tiles` tiles, or null if there is none. */
export function sampleTilingOf(
  R: number,
  sizes: readonly number[],
  tiles: number,
  rng: () => number = Math.random,
): number[] | null {
  if (countWaysOf(R, sizes, tiles) === 0n) return null;
  const w = waysByTiles(R, sizes);
  const S = [...new Set(sizes)].filter((s) => s >= 1).sort((a, b) => a - b);
  const out: number[] = [];
  let r = R;
  for (let j = tiles; j > 0; j--) {
    const options = S.filter((s) => s <= r && w[j - 1]![r - s]! > 0n);
    const total = options.reduce((a, s) => a + w[j - 1]![r - s]!, 0n);
    let pick = pickBig(total, rng);
    let chosen = options[options.length - 1]!;
    for (const s of options) {
      const v = w[j - 1]![r - s]!;
      if (pick < v) {
        chosen = s;
        break;
      }
      pick -= v;
    }
    out.push(chosen);
    r -= chosen;
  }
  return out;
}
