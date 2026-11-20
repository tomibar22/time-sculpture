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

/* ---------------------------------------------- statements: reading a passage */

/**
 * A passage read as k statements of one cell, the cell's main size x changing from one to the
 * next while everything else stays; the same gap tiles between them (and, when `before`, also
 * before the first); with `cut` the last statement's last tile is not written (it falls on the
 * 1). This is the long-range arithmetic of a yati: only the sum of the xs decides where it
 * lands, so the xs can be traded (taken from one statement, given to another) freely.
 */
export interface Statements {
  k: number;
  /** The first statement in full (with x = xs[0]). */
  cell: number[];
  /** Where x stands in the cell (empty when nothing in it changes and it has no main size). */
  slots: number[];
  xs: number[];
  gap: number[];
  before: boolean;
  cut: boolean;
}

const eq = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The statements a passage is made of, if it is made of them: tried with 3 statements first,
 * then 4, 2, 5; straight on before with a gap of 1–3 tiles; a cut last tile last. A gap that is
 * the same as the cell's own fixed edge is not a gap (6 6 X…X 6 | 6 6 X…X 6 reads as the cell
 * "6 6 X…X 6" said again, not as "6 X…X 6 6" with a 6 between).
 */
export function statementsOf(
  sizes: readonly number[],
  ks: readonly number[] = [3, 4, 2, 5],
): Statements | null {
  const N = sizes.length;
  if (N < 3) return null;
  // what is written first: a reading with a last tile "on the 1" only when no other fits
  for (const k of ks)
    for (const cut of [false, true])
      for (let gl = 0; gl <= 3; gl++)
        for (const before of gl ? [false, true] : [false]) {
          const rest = N - (before ? gl : 0) - (k - 1) * gl + (cut ? 1 : 0);
          if (rest % k) continue;
          const L = rest / k;
          // a statement longer than the gap between, and more than a single tile alone
          if (L <= gl || (L < 2 && !gl) || (cut && L < 2)) continue;
          const st = read(sizes, k, L, gl, before, cut);
          if (st) return st;
        }
  return null;
}

function read(
  sizes: readonly number[],
  k: number,
  L: number,
  gl: number,
  before: boolean,
  cut: boolean,
): Statements | null {
  let at = 0;
  const gap = before ? sizes.slice(0, gl) : sizes.slice(L, L + gl);
  if (before) at = gl;
  const cells: number[][] = [];
  for (let i = 0; i < k; i++) {
    const len = cut && i === k - 1 ? L - 1 : L;
    cells.push(sizes.slice(at, at + len));
    at += len;
    if (i < k - 1) {
      if (!eq(sizes.slice(at, at + gl), gap)) return null;
      at += gl;
    }
  }
  // positions where the statements differ: there, each statement has one size (its x)
  const slots: number[] = [];
  for (let p = 0; p < L; p++) {
    const vs = cells.map((c) => c[p]).filter((v): v is number => v !== undefined);
    if (vs.some((v) => v !== vs[0])) slots.push(p);
  }
  let xs: number[];
  if (!slots.length) {
    const t = templateOf(cells[0]!)!;
    slots.push(...t.slots);
    xs = cells.map(() => t.x);
  } else {
    xs = [];
    for (const c of cells) {
      const vs = slots.map((p) => c[p]).filter((v): v is number => v !== undefined);
      if (!vs.length || vs.some((v) => v !== vs[0])) return null;
      xs.push(vs[0]!);
    }
  }
  const cell = [...cells[0]!];
  if (cell.length < L) return null;
  if (gl) {
    const slot = new Set(slots);
    const fixedEdge = (from: number) =>
      gap.every((n, i) => !slot.has(from + i) && cell[from + i] === n);
    if (fixedEdge(0) || fixedEdge(L - gl)) return null;
  }
  return { k, cell, slots, xs, gap, before, cut };
}

/** The passage again with the statements' main sizes set to `xs`. */
export function sayStatements(st: Statements, xs: readonly number[]): number[] {
  const slot = new Set(st.slots);
  const out: number[] = st.before ? [...st.gap] : [];
  xs.forEach((x, i) => {
    const c = st.cell.map((n, p) => (slot.has(p) ? x : n));
    if (st.cut && i === xs.length - 1) c.pop();
    out.push(...c);
    if (i < xs.length - 1) out.push(...st.gap);
  });
  return out;
}

/** "X 3 X X 3 X X X 6": the cell with its main size as X. */
export function statementsText(st: Statements): string {
  const slot = new Set(st.slots);
  return st.cell.map((n, p) => (slot.has(p) ? 'X' : String(n))).join(' ');
}

/** "X X 4, 2 between, last on the 1": the cell, the gap and the cut, in words. */
export function statementsWords(st: Statements): string {
  const gap = st.gap.length ? `, ${st.gap.join(' ')} ${st.before ? 'before each' : 'between'}` : '';
  return `${statementsText(st)}${gap}${st.cut ? ', last on the 1' : ''}`;
}

/**
 * Ways to share out a sum among k statements, keeping it: offsets that add up to 0 (× d).
 * Widening / narrowing are even steps; swelling is big in the middle, pinched small.
 */
export const BALANCES: Record<number, { id: YatiShape; name: string; steps: number[] }[]> = {
  2: [
    { id: 'widening', name: 'Widening', steps: [-1, 1] },
    { id: 'narrowing', name: 'Narrowing', steps: [1, -1] },
  ],
  3: YATI_SHAPES.filter((s) => s.id !== 'even').map((s) => ({ ...s, steps: [...s.steps] })),
  4: [
    { id: 'widening', name: 'Widening', steps: [-3, -1, 1, 3] },
    { id: 'narrowing', name: 'Narrowing', steps: [3, 1, -1, -3] },
    { id: 'swelling', name: 'Swelling', steps: [-1, 1, 1, -1] },
    { id: 'pinched', name: 'Pinched', steps: [1, -1, -1, 1] },
  ],
  5: [
    { id: 'widening', name: 'Widening', steps: [-2, -1, 0, 1, 2] },
    { id: 'narrowing', name: 'Narrowing', steps: [2, 1, 0, -1, -2] },
    { id: 'swelling', name: 'Swelling', steps: [-2, 1, 2, 1, -2] },
    { id: 'pinched', name: 'Pinched', steps: [2, -1, -2, -1, 2] },
  ],
};

export interface Rebalance {
  xs: number[];
  name: string;
  /** "5+7+9 = 3×7". */
  sum: string;
}

/**
 * The statements' main sizes shared out again with the same sum (so the passage keeps its
 * length and its landing): even (all the mean), and every balance shape, d = 1–3, sizes 1–max.
 * The xs as they are are left out.
 */
export function rebalances(xs: readonly number[], max = 16): Rebalance[] {
  const k = xs.length;
  const S = xs.reduce((a, b) => a + b, 0);
  if (S % k) return [];
  const m = S / k;
  const out: Rebalance[] = [];
  const seen = new Set([xs.join(' ')]);
  const put = (v: number[], name: string) => {
    const key = v.join(' ');
    if (seen.has(key) || v.some((x) => x < 1 || x > max)) return;
    seen.add(key);
    out.push({ xs: v, name, sum: `${v.join('+')} = ${k}×${m}` });
  };
  put(
    xs.map(() => m),
    'Even',
  );
  for (const b of BALANCES[k] ?? [])
    for (let d = 1; d <= 3; d++)
      put(
        b.steps.map((s) => m + s * d),
        b.name,
      );
  return out;
}

/** The name of the way xs share out their mean ("Widening"), or null when it has none. */
export function balanceName(xs: readonly number[]): string | null {
  const k = xs.length;
  const S = xs.reduce((a, b) => a + b, 0);
  if (S % k) return null;
  const m = S / k;
  const off = xs.map((x) => x - m);
  if (off.every((o) => o === 0)) return 'Even';
  for (const b of BALANCES[k] ?? []) {
    const i = b.steps.findIndex((s) => s !== 0);
    const d = off[i]! / b.steps[i]!;
    if (Number.isInteger(d) && d > 0 && b.steps.every((s, j) => s * d === off[j])) return b.name;
  }
  return null;
}

/**
 * A written-out slowing down or speeding up: every tile grows (or shrinks) by the same step
 * from one to the next, the steps adding up to nothing, so the passage keeps its length.
 */
export function ramps(sizes: readonly number[]): { sizes: number[]; label: string }[] {
  const n = sizes.length;
  if (n < 4) return [];
  const out: { sizes: number[]; label: string }[] = [];
  // offsets i − (n−1)/2, doubled when n is even so they stay whole
  const unit = n % 2 ? 1 : 2;
  for (const d of [1, 2])
    for (const dir of [1, -1]) {
      const v = sizes.map((s, i) => s + (dir * d * unit * (2 * i - (n - 1))) / 2);
      if (v.some((x) => x < 1 || x > 16)) continue;
      out.push({
        sizes: v,
        label: `${dir > 0 ? 'Slowing down' : 'Speeding up'}, ${d * unit} a tile`,
      });
    }
  return out;
}

/* --------------------------------------------- built yatis (Browse) */

/** Cells to build yatis from: X is the main size, f and g fixed tiles. */
const CELLS: { text: string; build: (x: number, f: number, g: number) => number[]; g?: true }[] = [
  { text: 'X X f', build: (x, f) => [x, x, f] },
  { text: 'X f X', build: (x, f) => [x, f, x] },
  { text: 'X X X f', build: (x, f) => [x, x, x, f] },
  { text: 'X f X X f X X X', build: (x, f) => [x, f, x, x, f, x, x, x] },
  { text: 'X f X X f X X X g', build: (x, f, g) => [x, f, x, x, f, x, x, x, g], g: true },
  // the same growth turned round, and evened out (the inner shapes of the studied cell)
  { text: 'X X X f X X f X', build: (x, f) => [x, x, x, f, x, x, f, x] },
  { text: 'X X f X X f X X', build: (x, f) => [x, x, f, x, x, f, x, x] },
];

/**
 * Yatis of exactly R pulses from `sizes`: a cell (CELLS) said three times, its main size
 * widening, narrowing, swelling or pinched around a mean, straight on, with a gap of 1–3 equal
 * strokes between, or with the gap before each; also cut, the last tile falling on the 1 after the stretch.
 * Every size (the three xs, the fixed tiles, the gap) is one of `sizes`.
 */
export function yatiFills(R: number, sizes: readonly number[], limit = 60): number[][] {
  const S = [...new Set(sizes)].filter((n) => n >= 1).sort((a, b) => a - b);
  const ok = new Set(S);
  const out: number[][] = [];
  const seen = new Set<string>();
  if (S.length < 2 || R < 6) return out;
  // gaps: none, or 1–3 strokes of one size (the study's 6 6)
  const gaps: number[][] = [
    [],
    ...S.flatMap((G) => [1, 2, 3].map((n) => Array<number>(n).fill(G))),
  ];
  // with many sizes the closing tile g would multiply the search by |S|: only then is it left out
  const cells = S.length > 9 ? CELLS.filter((c) => !c.g) : CELLS;
  for (const c of cells)
    for (const f of S)
      for (const g of c.g ? S : [0]) {
        if (out.length >= 3 * limit) break;
        const one = c.build(1, f, g);
        const two = c.build(2, f, g);
        const slots = one.flatMap((n, i) => (two[i] !== n ? [i] : []));
        const F = one.reduce((a, n) => a + n, 0) - slots.length;
        const lastFixed = one.at(-1) === two.at(-1);
        const last = one.at(-1)!;
        for (const gap of gaps) {
          const G = gap.reduce((a, n) => a + n, 0);
          for (const before of G ? [false, true] : [false])
            for (const cut of lastFixed ? [false, true] : [false]) {
              const room = R - (before ? 3 : 2) * G + (cut ? last : 0);
              if (room % 3) continue;
              const m = (room / 3 - F) / slots.length;
              if (!Number.isInteger(m) || m < 1) continue;
              for (const b of BALANCES[3]!)
                for (let d = 1; d <= 3; d++) {
                  const xs = b.steps.map((s) => m + s * d);
                  // every size allowed, and the main size never one of the fixed ones (or it
                  // would not read back as the main size)
                  if (!xs.every((x) => ok.has(x) && x !== f && x !== g && x !== gap[0])) continue;
                  const st: Statements = {
                    k: 3,
                    cell: c.build(xs[0]!, f, g),
                    slots,
                    xs,
                    gap,
                    before,
                    cut,
                  };
                  const t = sayStatements(st, xs);
                  const key = t.join(' ');
                  if (seen.has(key) || !yatiLabel(t)) continue;
                  seen.add(key);
                  out.push(t);
                  // the growth inside changing from one statement to the next (1 2 3 | 2 2 2 | 3 2 1)
                  for (const r of innerAcross(st)) {
                    const key2 = r.sizes.join(' ');
                    if (seen.has(key2) || !innerAcrossLabel(r.sizes)) continue;
                    seen.add(key2);
                    out.push(r.sizes);
                  }
                }
            }
        }
      }
  // the fewest tiles first, then the studied cell's growth (longer cells) last
  return out.sort((a, b) => a.length - b.length).slice(0, limit);
}

/** The name of a yati fill: "Widening 5 → 7 → 9 · X 3 X X 3 X X X 6", or null. */
export function yatiLabel(t: readonly number[]): string | null {
  // three cells of three tiles at least (the last may lose its tile to the 1)
  if (t.length < 8) return null;
  const st = statementsOf(t, [3]);
  if (!st || st.xs.every((x) => x === st.xs[0])) return null;
  // a cell of three tiles at least, one of them fixed (2 3 2 4 2 5 reads better as a refrain)
  if (st.cell.length < 3 || st.slots.length >= st.cell.length) return null;
  // only a named way of sharing out (an accidental reading of a random fill is no yati)
  const name = balanceName(st.xs);
  if (!name) return null;
  return `${name} ${st.xs.join(' → ')} · ${statementsWords(st)}`;
}

/* ------------------------------------- inside the cell, and between gaps and cells */

/**
 * The cell read one level down: runs of its main size between fixed tiles, "X | 3 | X X | 3 |
 * X X X | 6" = runs 1 2 3. Null with fewer than two runs.
 */
export function runsOf(
  cell: readonly number[],
  slots: readonly number[],
): { runs: number[]; parts: (number[] | null)[] } | null {
  const slot = new Set(slots);
  // parts: fixed stretches as arrays, each run as null (its length in `runs`)
  const parts: (number[] | null)[] = [];
  const runs: number[] = [];
  let i = 0;
  while (i < cell.length) {
    if (slot.has(i)) {
      let n = 0;
      while (i < cell.length && slot.has(i)) {
        n++;
        i++;
      }
      runs.push(n);
      parts.push(null);
    } else {
      const f: number[] = [];
      while (i < cell.length && !slot.has(i)) f.push(cell[i++]!);
      parts.push(f);
    }
  }
  return runs.length >= 2 ? { runs, parts } : null;
}

/** The cell with its runs of the main size set to `runs` (the fixed tiles kept). */
export function withRuns(
  cell: readonly number[],
  slots: readonly number[],
  runs: readonly number[],
): { cell: number[]; slots: number[] } | null {
  const r = runsOf(cell, slots);
  if (!r || r.runs.length !== runs.length) return null;
  const x = cell[slots[0]!]!;
  const out: number[] = [];
  const at: number[] = [];
  let j = 0;
  for (const p of r.parts) {
    if (p) {
      out.push(...p);
      continue;
    }
    for (let n = 0; n < runs[j]!; n++) {
      at.push(out.length);
      out.push(x);
    }
    j++;
  }
  return { cell: out, slots: at };
}

/** A passage that is no statements read as one statement of itself (its main size as X). */
export function oneStatement(sizes: readonly number[]): Statements | null {
  const t = templateOf(sizes);
  if (!t || t.slots.length === sizes.length) return null;
  return { k: 1, cell: [...sizes], slots: t.slots, xs: [t.x], gap: [], before: false, cut: false };
}

export interface Reshaped {
  sizes: number[];
  label: string;
}

/**
 * One level down, the same arithmetic: the runs of the main size inside the cell shared out
 * again with the same count (1 2 3 → 3 2 1, 2 2 2, 1 4 1 …), so every statement keeps its length
 * and the passage its landing. Every statement gets the same inner shape.
 */
export function innerBalances(st: Statements): Reshaped[] {
  const r = runsOf(st.cell, st.slots);
  if (!r) return [];
  const out: Reshaped[] = [];
  for (const b of rebalances(r.runs)) {
    const w = withRuns(st.cell, st.slots, b.xs);
    if (!w) continue;
    const next: Statements = { ...st, cell: w.cell, slots: w.slots };
    out.push({
      sizes: sayStatements(next, st.xs),
      label: `Inside: ${b.name.toLowerCase()} ${b.xs.join(' → ')} · ${statementsText(next)}`,
    });
  }
  return out;
}

/**
 * A cell that begins with fixed tiles and has no gap read with those tiles as the gap before each
 * statement: "6 6 X 3 X X 3 X X X 6" three times is "6 6" before each of "X 3 X X 3 X X X 6".
 * The same passage; only the breath is named as such.
 */
export function headAsGap(st: Statements): Statements {
  if (st.gap.length || !st.slots.length || st.slots[0] === 0) return st;
  const h = st.slots[0]!;
  return {
    ...st,
    gap: st.cell.slice(0, h),
    before: true,
    cell: st.cell.slice(h),
    slots: st.slots.map((p) => p - h),
  };
}

/**
 * Between the gaps and the cells: every statement's main size grows by Δ (the shape of the xs
 * kept) and the gaps give back what the cells take, or the other way round, so the total stays.
 * Each gap changes by −(X's per cell × statements × Δ) ÷ gaps, and must stay ≥ 0 and whole; a gap
 * is written in strokes of its own size (6 6 → 6, 6 6 6), else as one stroke (≤ 16), else in its
 * strokes and what is left.
 */
export function gapTrades(given: Statements): Reshaped[] {
  if (given.k < 2) return [];
  const st = headAsGap(given);
  const c = st.slots.length;
  const gaps = st.k - 1 + (st.before ? 1 : 0);
  const g = st.gap.reduce((a, n) => a + n, 0);
  const unit = st.gap.length && st.gap.every((n) => n === st.gap[0]) ? st.gap[0]! : 0;
  const total = sayStatements(st, st.xs).reduce((a, n) => a + n, 0);
  const out: Reshaped[] = [];
  for (const dm of [1, 2, 3, -1, -2, -3]) {
    const dg = (-c * st.k * dm) / gaps;
    const ng = g + dg;
    if (!Number.isInteger(ng) || ng < 0) continue;
    const xs = st.xs.map((x) => x + dm);
    if (xs.some((x) => x < 1 || x > 16)) continue;
    // a gap that appears where there was none goes between (not before the first)
    if (!g && st.before) continue;
    let gap: number[] = [];
    if (ng && unit && ng % unit === 0) gap = Array<number>(ng / unit).fill(unit);
    else if (ng && ng <= 16) gap = [ng];
    else if (ng && unit) gap = [...Array<number>(Math.floor(ng / unit)).fill(unit), ng % unit];
    else if (ng) continue;
    // a new gap between statements only (none before): the count of gaps is k − 1 then
    const next: Statements = { ...st, gap, before: st.before && gap.length > 0 };
    const sizes = sayStatements(next, xs);
    if (sizes.reduce((a, n) => a + n, 0) !== total) continue;
    const from = st.gap.length ? st.gap.join(' ') : 'none';
    const to = gap.length ? gap.join(' ') : 'none';
    out.push({
      sizes,
      label: `${dm > 0 ? `Gaps give ${c * st.k * dm}` : `Gaps take ${-c * st.k * dm}`}: ${from} → ${to}, cells ${xs.join(' → ')}`,
    });
  }
  return out;
}

/* -------------------------------------------- across the statements (a third level) */

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Ways for an inner shape v (the runs inside a cell, or a phrase's speeds) to change from one
 * statement to the next while every statement keeps its length (v's sum is kept): turning round
 * (v, then even, then v backwards: 3 2 1 | 2 2 2 | 1 2 3), there and back (v, backwards, v) when
 * there is no whole even, arriving at it (even … then v: it appears only at the end), leaving it
 * (v, then even …).
 */
export function acrossPaths(v: readonly number[], k: number): { name: string; vs: number[][] }[] {
  if (k < 2 || v.length < 2) return [];
  const rev = [...v].reverse();
  const S = v.reduce((a, b) => a + b, 0);
  const even = S % v.length ? null : Array<number>(v.length).fill(S / v.length);
  const out: { name: string; vs: number[][] }[] = [];
  if (!same(v, rev)) {
    if (k === 2) out.push({ name: 'turning round', vs: [[...v], rev] });
    else if (even && !same(v, even))
      out.push({
        name: 'turning round',
        vs: [[...v], ...Array.from({ length: k - 2 }, () => even), rev],
      });
    else
      out.push({
        name: 'there and back',
        vs: Array.from({ length: k }, (_, i) => (i % 2 ? rev : [...v])),
      });
  }
  if (even && !same(v, even)) {
    out.push({
      name: 'arriving at it',
      vs: [...Array.from({ length: k - 1 }, () => even), [...v]],
    });
    out.push({ name: 'leaving it', vs: [[...v], ...Array.from({ length: k - 1 }, () => even)] });
  }
  return out;
}

/** The statements written with a cell of their own each (the gap, before and cut kept). */
export function sayCells(st: Statements, cells: readonly (readonly number[])[]): number[] {
  const out: number[] = st.before ? [...st.gap] : [];
  cells.forEach((cell, i) => {
    const c = [...cell];
    if (st.cut && i === cells.length - 1) c.pop();
    out.push(...c);
    if (i < cells.length - 1) out.push(...st.gap);
  });
  return out;
}

/** Statement i's cell as written (its main size set). */
export function cellOf(st: Statements, i: number): number[] {
  const slot = new Set(st.slots);
  return st.cell.map((n, p) => (slot.has(p) ? st.xs[i]! : n));
}

/**
 * The runs inside the cell changing from statement to statement (acrossPaths): "Inside 1 2 3 |
 * 2 2 2 | 3 2 1 (turning round)". Every statement keeps its length.
 */
export function innerAcross(st: Statements): Reshaped[] {
  if (st.k < 2) return [];
  const r = runsOf(st.cell, st.slots);
  if (!r) return [];
  const out: Reshaped[] = [];
  for (const p of acrossPaths(r.runs, st.k)) {
    const cells = p.vs.map((v, i) => withRuns(cellOf(st, i), st.slots, v)?.cell);
    if (cells.some((c) => !c)) continue;
    out.push({
      sizes: sayCells(st, cells as number[][]),
      label: `Inside ${p.vs.map((v) => v.join(' ')).join(' | ')} (${p.name})`,
    });
  }
  return out;
}

/* ------------------------------------- reading statements whose inside differs */

/** A passage read as statements whose runs inside change from one to the next. */
export interface InsideAcross {
  st: Statements;
  /** Each statement's runs of its main size (1 2 3 | 2 2 2 | 3 2 1). */
  vs: number[][];
  path: string;
}

/** A cell as runs of its main size x between fixed stretches. */
function partsOf(cell: readonly number[], x: number): { fixed: number[][]; runs: number[] } {
  const fixed: number[][] = [[]];
  const runs: number[] = [];
  let i = 0;
  while (i < cell.length) {
    if (cell[i] === x) {
      let n = 0;
      while (i < cell.length && cell[i] === x) {
        n++;
        i++;
      }
      runs.push(n);
      fixed.push([]);
    } else fixed[fixed.length - 1]!.push(cell[i++]!);
  }
  return { fixed, runs };
}

/**
 * Three statements (with a gap, before each, or the last tile cut, as statementsOf) whose cells
 * are the same fixed tiles with runs of a main size between them, the runs following an
 * `acrossPaths` path (and the main sizes, if they change, a named sharing-out: 5 → 7 → 9).
 */
export function innerAcrossOf(t: readonly number[]): InsideAcross | null {
  const N = t.length;
  if (N < 9) return null;
  const k = 3;
  for (const cut of [false, true])
    for (let gl = 0; gl <= 3; gl++)
      for (const before of gl ? [false, true] : [false]) {
        const rest = N - (before ? gl : 0) - (k - 1) * gl + (cut ? 1 : 0);
        if (rest % k) continue;
        const L = rest / k;
        if (L < 4 || L <= gl) continue;
        let at = before ? gl : 0;
        const gap = before ? t.slice(0, gl) : t.slice(L, L + gl);
        const cells: number[][] = [];
        let ok = true;
        for (let i = 0; i < k && ok; i++) {
          const len = cut && i === k - 1 ? L - 1 : L;
          cells.push(t.slice(at, at + len));
          at += len;
          if (i < k - 1) {
            if (!eq(t.slice(at, at + gl), gap)) ok = false;
            at += gl;
          }
        }
        if (!ok) continue;
        // the last statement's cut tile is the first one's last (a fixed tile)
        if (cut) cells[k - 1]!.push(cells[0]![L - 1]!);
        const xs = cells.map((c) => templateOf(c)!.x);
        const parts = cells.map((c, i) => partsOf(c, xs[i]!));
        const p0 = parts[0]!;
        if (p0.runs.length < 2) continue;
        if (
          parts.some(
            (p) => p.runs.length !== p0.runs.length || p.fixed.some((f, j) => !eq(f, p0.fixed[j]!)),
          )
        )
          continue;
        if (!p0.fixed.some((f) => f.length)) continue;
        const vs = parts.map((p) => p.runs);
        if (vs.every((v) => eq(v, vs[0]!))) continue;
        if (!xs.every((x) => x === xs[0]) && !balanceName(xs)) continue;
        for (const base of [vs[0]!, vs[k - 1]!]) {
          const p = acrossPaths(base, k).find((x) => x.vs.every((v, i) => eq(v, vs[i]!)));
          if (!p) continue;
          const c0 = cells[0]!;
          const slots = c0.flatMap((n, i) => (n === xs[0] ? [i] : []));
          return { st: { k, cell: c0, slots, xs, gap, before, cut }, vs, path: p.name };
        }
      }
  return null;
}

/** "Inside 1 2 3 | 2 2 2 | 3 2 1 (turning round) · 5 → 7 → 9", or null. */
export function innerAcrossLabel(t: readonly number[]): string | null {
  const r = innerAcrossOf(t);
  if (!r) return null;
  const xs = r.st.xs.every((x) => x === r.st.xs[0]) ? '' : ` · ${r.st.xs.join(' → ')}`;
  return `Inside ${r.vs.map((v) => v.join(' ')).join(' | ')} (${r.path})${xs}`;
}

/** For a passage whose inside already changes across: the plain forms and the other paths. */
export function otherInsideAcross(t: readonly number[]): Reshaped[] {
  const r = innerAcrossOf(t);
  if (!r) return [];
  const { st } = r;
  const out: Reshaped[] = [];
  const say = (vs: readonly (readonly number[])[]) => {
    const cells = vs.map((v, i) => withRuns(cellOf(st, i), st.slots, v)?.cell);
    return cells.some((c) => !c) ? null : sayCells(st, cells as number[][]);
  };
  for (const base of [r.vs[0]!, r.vs[st.k - 1]!]) {
    const plain = say(Array.from({ length: st.k }, () => base));
    if (plain) out.push({ sizes: plain, label: `Inside ${base.join(' ')}, every time` });
    for (const p of acrossPaths(base, st.k)) {
      if (p.vs.every((v, i) => eq(v, r.vs[i]!))) continue;
      const sizes = say(p.vs);
      if (sizes)
        out.push({
          sizes,
          label: `Inside ${p.vs.map((v) => v.join(' ')).join(' | ')} (${p.name})`,
        });
    }
  }
  const seen = new Set<string>();
  return out.filter((o) => {
    const key = o.sizes.join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
