import { countWays, sampleTiling } from './count';

/**
 * Shapes: fills with an aesthetic logic (repeats, growing patterns, pyramids, refrains, even
 * spreads, mirrors). `shapeOf` names the shape of a fill; `shapeFills` builds shaped fills of R
 * pulses directly, since random sampling almost never finds them.
 */
export type ShapeFamily = 'repeat' | 'grow' | 'pyramid' | 'refrain' | 'even' | 'cadence' | 'mirror';

export interface Shape {
  family: ShapeFamily;
  label: string;
}

/** In order of priority: a fill is named by the first family that fits. */
export const SHAPE_FAMILIES: { id: ShapeFamily; label: string; hint: string }[] = [
  { id: 'repeat', label: 'Repeat', hint: 'A cell repeated: 3 3 2 · 3 3 2' },
  { id: 'grow', label: 'Growing', hint: 'Adds one each time: 3 2 · 3 3 2 · 3 3 3 2' },
  { id: 'pyramid', label: 'Pyramid', hint: 'Rising, falling, arch, valley: 2 3 4 3 2' },
  { id: 'refrain', label: 'Refrain', hint: 'A fixed size between steps: 2 3 2 4 2 5' },
  { id: 'even', label: 'Even spread', hint: 'Two sizes spread as evenly as possible' },
  { id: 'cadence', label: 'Cadence', hint: 'A repeat that turns at the end: 3 3 3 2' },
  { id: 'mirror', label: 'Mirror', hint: 'Reads the same backwards: 2 3 4 4 3 2' },
];

const RANK = new Map(SHAPE_FAMILIES.map((f, i) => [f.id, i]));
export const shapeRank = (f: ShapeFamily) => RANK.get(f) ?? 99;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Smallest period p (p < length, dividing it) of t, or 0. */
function period(t: number[]): number {
  const n = t.length;
  for (let p = 1; p <= n / 2; p++) {
    if (n % p) continue;
    if (t.every((x, i) => x === t[i % p])) return p;
  }
  return 0;
}

const cell = (t: number[]) => (t.length === 1 ? `${t[0]}` : `(${t.join(' ')})`);

function repeatLabel(t: number[]): string | null {
  const p = period(t);
  return p ? `${cell(t.slice(0, p))} ×${t.length / p}` : null;
}

/** Blocks x…x y with the count of x going up (or down) by one: 3 2 3 3 2 3 3 3 2. */
function growLabel(t: number[]): string | null {
  const y = t[t.length - 1]!;
  const x = t[0]!;
  if (x === y) return null;
  const counts: number[] = [];
  let c = 0;
  for (const v of t) {
    if (v === x) c++;
    else if (v === y) {
      if (!c) return null;
      counts.push(c);
      c = 0;
    } else return null;
  }
  if (c || counts.length < 2) return null;
  const d = counts[1]! - counts[0]!;
  if (Math.abs(d) !== 1 || !counts.every((k, i) => !i || k - counts[i - 1]! === d)) return null;
  return `${d > 0 ? 'Growing' : 'Shrinking'} ${x}s, ${y} between`;
}

/** Runs of equal length c whose values rise, fall, rise-then-fall or fall-then-rise by steps. */
function pyramidLabel(t: number[]): string | null {
  const runs: number[] = [];
  const lens: number[] = [];
  for (const v of t) {
    if (runs[runs.length - 1] === v) lens[lens.length - 1]!++;
    else {
      runs.push(v);
      lens.push(1);
    }
  }
  if (runs.length < 3 || !lens.every((l) => l === lens[0])) return null;
  const c = lens[0]!;
  const steps = runs.slice(1).map((v, i) => v - runs[i]!);
  const mag = Math.abs(steps[0]!);
  if (!steps.every((s) => Math.abs(s) === mag) || mag > 2) return null;
  const turns = steps.filter((s, i) => i && Math.sign(s) !== Math.sign(steps[i - 1]!)).length;
  const first = runs[0]!;
  const last = runs[runs.length - 1]!;
  const twice = c > 1 ? `, each ×${c}` : '';
  if (!turns) return `${steps[0]! > 0 ? 'Rising' : 'Falling'} ${first}→${last}${twice}`;
  if (turns !== 1) return null;
  const peak = steps[0]! > 0 ? Math.max(...runs) : Math.min(...runs);
  return `${steps[0]! > 0 ? 'Arch' : 'Valley'} ${first}→${peak}→${last}${twice}`;
}

/** Every other tile is the same size r; the others step steadily up or down. */
function refrainLabel(t: number[]): string | null {
  if (t.length < 4) return null;
  for (const off of [0, 1]) {
    const r = t[off]!;
    const fixed = t.filter((_, i) => i % 2 === off);
    const moving = t.filter((_, i) => i % 2 !== off);
    if (moving.length < 3 || !fixed.every((v) => v === r)) continue;
    const d = moving[1]! - moving[0]!;
    if (!d || Math.abs(d) > 2 || !moving.every((v, i) => !i || v - moving[i - 1]! === d)) continue;
    const a = moving[0]!;
    const b = moving[moving.length - 1]!;
    return `${r} between, ${d > 0 ? 'rising' : 'falling'} ${a}→${b}`;
  }
  return null;
}

/** Two neighbouring sizes spread as evenly as possible (every window's sum within 1, cyclically). */
function evenLabel(t: number[]): string | null {
  const lo = Math.min(...t);
  const hi = Math.max(...t);
  if (hi - lo !== 1 || t.length < 3) return null;
  const n = t.length;
  for (let L = 1; L < n; L++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < L; j++) s += t[(i + j) % n]!;
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    if (max - min > 1) return null;
  }
  const nh = t.filter((v) => v === hi).length;
  if (nh < 2 || n - nh < 2) return null;
  return `${nh} × ${hi} among ${n - nh} × ${lo}`;
}

/** A repeat (at least twice) with one different tile at the end, or before it as a pickup. */
function cadenceLabel(t: number[]): string | null {
  if (t.length < 3) return null;
  const body = t.slice(0, -1);
  const end = t[t.length - 1]!;
  const p = period(body);
  if (p && end !== body[p - 1]) return `${cell(body.slice(0, p))} ×${body.length / p} → ${end}`;
  const tail = t.slice(1);
  const q = period(tail);
  if (q && t[0] !== tail[0]) return `${t[0]} → ${cell(tail.slice(0, q))} ×${tail.length / q}`;
  return null;
}

function mirrorLabel(t: number[]): string | null {
  if (t.length < 3 || new Set(t).size < 2) return null;
  return same(t, [...t].reverse())
    ? `Mirror around ${t.length % 2 ? t[(t.length - 1) / 2] : 'the middle'}`
    : null;
}

const LABELS: [ShapeFamily, (t: number[]) => string | null][] = [
  ['repeat', repeatLabel],
  ['grow', growLabel],
  ['pyramid', pyramidLabel],
  ['refrain', refrainLabel],
  ['even', evenLabel],
  ['cadence', cadenceLabel],
  ['mirror', mirrorLabel],
];

/** The shape of a fill, if it has one. */
export function shapeOf(t: number[]): Shape | null {
  if (t.length < 2) return null;
  for (const [family, f] of LABELS) {
    const label = f(t);
    if (label) return { family, label };
  }
  return null;
}

const sum = (t: number[]) => t.reduce((a, b) => a + b, 0);
const times = <T>(t: T[], k: number): T[] => Array.from({ length: k }, () => t).flat();
const range = (a: number, b: number, d: number): number[] => {
  const out: number[] = [];
  for (let v = a; d > 0 ? v <= b : v >= b; v += d) out.push(v);
  return out;
};

/**
 * Shaped fills of exactly R pulses using only `sizes`, deduplicated, in family order (then fewer
 * tiles first), at most `perFamily` of each family.
 */
export function shapeFills(
  R: number,
  sizes: number[],
  perFamily = 40,
  rng: () => number = Math.random,
): { sizes: number[]; shape: Shape }[] {
  const S = [...new Set(sizes)].filter((n) => n >= 1).sort((a, b) => a - b);
  const ok = new Set(S);
  const cands: number[][] = [];
  const put = (t: number[]) => {
    if (t.length >= 2 && t.length <= 64 && sum(t) === R && t.every((v) => ok.has(v))) cands.push(t);
  };
  if (R <= 1 || !S.length) return [];

  // repeats and cadences of cells of 1–4 tiles
  const cells: number[][] = [[]];
  for (let len = 1; len <= 4; len++) {
    for (const c of cells.filter((x) => x.length === len - 1))
      for (const v of S) cells.push([...c, v]);
  }
  for (const c of cells) {
    if (!c.length || (c.length > 1 && period(c))) continue;
    const s = sum(c);
    if (R % s === 0) put(times(c, R / s));
    for (const e of S) {
      if ((R - e) % s || R - e < 2 * s) continue;
      const body = times(c, (R - e) / s);
      put([...body, e]);
      put([e, ...body]);
    }
  }
  // growing / shrinking
  for (const x of S)
    for (const y of S) {
      if (x === y) continue;
      for (const start of [1, 2]) {
        const t: number[] = [];
        for (let c = start; sum(t) < R; c++) {
          t.push(...times([x], c), y);
          if (c > start) {
            put(t.slice());
            const blocks: number[][] = [];
            for (let k = c; k >= start; k--) blocks.push([...times([x], k), y]);
            put(blocks.flat());
          }
        }
      }
    }
  // pyramids
  for (const a of S)
    for (const b of S)
      for (const d of [1, 2])
        for (const c of [1, 2, 3]) {
          if (a === b) continue;
          const up = a < b;
          const line = range(a, b, up ? d : -d);
          if (line[line.length - 1] !== b) continue;
          const rep = (v: number[]) => v.flatMap((x) => times([x], c));
          put(rep(line));
          put(rep([...line, ...line.slice(0, -1).reverse()]));
        }
  // refrains
  for (const r of S)
    for (const a of S)
      for (const b of S)
        for (const d of [1, 2]) {
          if (a === b) continue;
          const line = range(a, b, a < b ? d : -d);
          if (line[line.length - 1] !== b) continue;
          const mid = line.flatMap((v, i) => (i ? [r, v] : [v]));
          put(mid);
          put([...mid, r]);
          put([r, ...mid]);
        }
  // even spreads: n tiles of ⌊R/n⌋ and ⌈R/n⌉, every rotation
  for (let n = 3; n <= Math.min(R, 64); n++) {
    const base = Array.from(
      { length: n },
      (_, i) => Math.floor(((i + 1) * R) / n) - Math.floor((i * R) / n),
    );
    if (!base.every((v) => ok.has(v)) || new Set(base).size < 2) continue;
    for (let k = 0; k < n; k++) put([...base.slice(k), ...base.slice(0, k)]);
  }
  // mirrors: a random half, reflected around an optional middle tile
  for (const m of [0, ...S]) {
    const h = (R - m) / 2;
    if (!Number.isInteger(h) || h < 1 || countWays(h, S) === 0n) continue;
    for (let i = 0; i < 8; i++) {
      const half = sampleTiling(h, S, rng);
      if (half) put([...half, ...(m ? [m] : []), ...[...half].reverse()]);
    }
  }

  const seen = new Set<string>();
  const out: { sizes: number[]; shape: Shape }[] = [];
  for (const t of cands) {
    const k = t.join(' ');
    if (seen.has(k)) continue;
    seen.add(k);
    const shape = shapeOf(t);
    if (shape) out.push({ sizes: t, shape });
  }
  out.sort(
    (a, b) =>
      shapeRank(a.shape.family) - shapeRank(b.shape.family) || a.sizes.length - b.sizes.length,
  );
  const per = new Map<ShapeFamily, number>();
  return out.filter((o) => {
    const k = per.get(o.shape.family) ?? 0;
    per.set(o.shape.family, k + 1);
    return k < perFamily;
  });
}
