/**
 * Yati: a cell said three times, its main size changing from one time to the next while
 * everything else in it stays (learnt from a recorded Indian composition, docs/studies/):
 *
 *   6 6 | 5 3 5 5 3 5 5 5 6 | 6 6 | 7 3 7 7 3 7 7 7 6 | 6 6 | 9 3 9 9 3 9 9 9 [6 on the 1]
 *
 * The cell `X 3 X X 3 X X X 6` keeps its 3s and its closing 6; only X grows, 5 → 7 → 9. Since
 * 5 + 7 + 9 = 3 × 7, it lands exactly where the plain tihai of the 7s would: any three sizes with
 * the same mean do. The four classic shapes all keep the mean:
 * widening (srotovaha) m−d m m+d, narrowing (gopuccha) m+d m m−d,
 * swelling (mridanga) m−d m+2d m−d, pinched (damaru) m+d m−2d m+d.
 */

export interface Template {
  /** The size that changes (the most frequent one; the larger on a tie). */
  x: number;
  /** Where it stands in the cell. */
  slots: number[];
  /** The cell's other tiles, which stay. */
  fixed: number;
}

/** The cell's changing size and where it stands. */
export function templateOf(cell: readonly number[]): Template | null {
  if (!cell.length) return null;
  const count = new Map<number, number>();
  for (const n of cell) count.set(n, (count.get(n) ?? 0) + 1);
  let x = cell[0]!;
  for (const [n, c] of count) {
    const best = count.get(x)!;
    if (c > best || (c === best && n > x)) x = n;
  }
  const slots = cell.flatMap((n, i) => (n === x ? [i] : []));
  const fixed = cell.reduce((a, n) => a + (n === x ? 0 : n), 0);
  return { x, slots, fixed };
}

/** "X 3 X X 3 X X X 6". */
export function templateText(cell: readonly number[]): string {
  const t = templateOf(cell);
  return t ? cell.map((n) => (n === t.x ? 'X' : String(n))).join(' ') : '';
}

/** The cell with its changing size set to x. */
export function realize(cell: readonly number[], x: number): number[] {
  const t = templateOf(cell);
  return t ? cell.map((n) => (n === t.x ? x : n)) : [];
}

export type YatiShape = 'even' | 'widening' | 'narrowing' | 'swelling' | 'pinched';

export const YATI_SHAPES: { id: YatiShape; name: string; steps: [number, number, number] }[] = [
  { id: 'even', name: 'Even', steps: [0, 0, 0] },
  { id: 'widening', name: 'Widening', steps: [-1, 0, 1] },
  { id: 'narrowing', name: 'Narrowing', steps: [1, 0, -1] },
  { id: 'swelling', name: 'Swelling', steps: [-1, 2, -1] },
  { id: 'pinched', name: 'Pinched', steps: [1, -2, 1] },
];

/** The three sizes of a shape around the mean m, d apart (null when one is out of 1–max). */
export function yatiSizes(
  shape: YatiShape,
  m: number,
  d: number,
  max = 16,
): [number, number, number] | null {
  const s = YATI_SHAPES.find((y) => y.id === shape)!.steps;
  const xs = s.map((k) => m + k * d) as [number, number, number];
  return xs.every((x) => x >= 1 && x <= max) ? xs : null;
}
