import { countWays, sampleTiling } from './count';

/**
 * Shapes: fills with an aesthetic logic (repeats, growing patterns, pyramids, refrains, even
 * spreads, mirrors). `shapeOf` names the shape of a fill; `shapeFills` builds shaped fills of R
 * pulses directly, since random sampling almost never finds them.
 */
export type ShapeFamily =
  | 'tihai'
  | 'chakradhar'
  | 'repeat'
  | 'additive'
  | 'grow'
  | 'pyramid'
  | 'golden'
  | 'refrain'
  | 'even'
  | 'cadence'
  | 'mirror';

export interface Shape {
  family: ShapeFamily;
  label: string;
}

/** In order of priority: a fill is named by the first family that fits. */
export const SHAPE_FAMILIES: { id: ShapeFamily; label: string; hint: string }[] = [
  {
    id: 'tihai',
    label: 'Tihai',
    hint: 'A phrase three times, with the same breath between: 3 2 (1) 3 2 (1) 3 2',
  },
  {
    id: 'chakradhar',
    label: 'Chakradhar',
    hint: 'A tihai of tihais: each of its three phrases is a small tihai',
  },
  { id: 'repeat', label: 'Repeat', hint: 'A cell repeated: 3 3 2 · 3 3 2' },
  {
    id: 'additive',
    label: 'Additive',
    hint: 'A motif built up one group at a time (or worn away): 3 · 3 2 · 3 2 4',
  },
  { id: 'grow', label: 'Growing', hint: 'Adds one each time: 3 2 · 3 3 2 · 3 3 3 2' },
  { id: 'pyramid', label: 'Pyramid', hint: 'Rising, falling, arch, valley: 2 3 4 3 2' },
  {
    id: 'golden',
    label: 'Golden',
    hint: 'Fibonacci sizes (2 3 5 8), or the longest stroke at the golden section',
  },
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

/**
 * Blocks whose lengths step by one, each a prefix of the longest: 3 · 3 2 · 3 2 4 (additive) or
 * 3 2 4 · 3 2 · 3 (subtractive). At least three blocks, the first of one or two groups.
 */
function additiveLabel(t: number[]): string | null {
  for (const down of [false, true])
    for (const first of [1, 2]) {
      const up: number[] = [];
      let total = 0;
      for (let l = first; total < t.length; l++) {
        up.push(l);
        total += l;
      }
      if (total !== t.length || up.length < 3) continue;
      const lens = down ? [...up].reverse() : up;
      const longest = Math.max(...lens);
      const motifAt = down ? 0 : t.length - longest;
      const motif = t.slice(motifAt, motifAt + longest);
      if (new Set(motif).size < 2) continue;
      let i = 0;
      const okay = lens.every((l) => {
        const ok = t.slice(i, i + l).every((v, j) => v === motif[j]);
        i += l;
        return ok;
      });
      if (okay) return `${down ? 'Wearing away' : 'Building up'} ${motif.join(' ')}`;
    }
  return null;
}

const FIB = [1, 2, 3, 5, 8, 13, 21];

/** Consecutive Fibonacci sizes rising, falling or both (each run once): 2 3 5 8, 3 5 8 5 3. */
function fibLabel(t: number[]): string | null {
  if (t.length < 3) return null;
  const idx = t.map((v) => FIB.indexOf(v));
  if (idx.some((i) => i < 0) || t.includes(1)) return null;
  const steps = idx.slice(1).map((v, i) => v - idx[i]!);
  if (!steps.every((s) => Math.abs(s) === 1)) return null;
  const turns = steps.filter((s, i) => i && s !== steps[i - 1]).length;
  if (turns > 1) return null;
  return `Fibonacci ${t.join(' ')}`;
}

/** The single longest stroke starts at the golden section (≈ 0.618 of the way, or 0.382). */
function goldenLabel(t: number[]): string | null {
  if (t.length < 4) return null;
  const max = Math.max(...t);
  if (t.filter((v) => v === max).length !== 1 || max < 2 * Math.min(...t)) return null;
  const R = sum(t);
  const at = sum(t.slice(0, t.indexOf(max)));
  for (const g of [0.618, 0.382])
    if (Math.abs(at - g * R) <= Math.max(0.5, R * 0.02))
      return `${max} at the golden section${g < 0.5 ? ' (early)' : ''}`;
  return null;
}

const LABELS: [ShapeFamily, (t: number[]) => string | null][] = [
  ['repeat', repeatLabel],
  ['additive', additiveLabel],
  ['grow', growLabel],
  ['pyramid', pyramidLabel],
  ['golden', fibLabel],
  ['refrain', refrainLabel],
  ['even', evenLabel],
  ['cadence', cadenceLabel],
  ['mirror', mirrorLabel],
  ['golden', goldenLabel],
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

/** A tihai: its sizes and its name. */
export interface TihaiFill {
  sizes: number[];
  shape: Shape;
}

/**
 * Tihais of exactly R pulses: a phrase (1–4 tiles of `sizes`) played three times with the same
 * tile between, so the third time ends exactly where the region ends (on 1, when the region
 * runs to the end). 3 × phrase + 2 × gap = R, the gap one of `sizes`. Shorter phrases first.
 */
export function tihaiFills(R: number, sizes: number[], limit = 40): TihaiFill[] {
  const S = [...new Set(sizes)].filter((n) => n >= 1).sort((a, b) => a - b);
  const out: TihaiFill[] = [];
  const gaps: TihaiFill[] = [];
  if (R < 5 || !S.length) return out;
  let cells: number[][] = [[]];
  for (let len = 1; len <= 4; len++) {
    cells = cells.flatMap((c) => S.map((v) => [...c, v]));
    for (const c of cells) {
      // a phrase that is itself a repeat reads as a plain repeat, not as a phrase
      if (c.length > 1 && period(c)) continue;
      const p = sum(c);
      const g = (R - 3 * p) / 2;
      if (S.includes(g))
        out.push({
          sizes: [...c, g, ...c, g, ...c],
          shape: { family: 'tihai', label: `${cell(c)} ×3, ${g} between` },
        });
      // gap tihai: the breath between grows (or shrinks) by one or two
      for (const g1 of S)
        for (const d of [-2, -1, 1, 2]) {
          const g2 = g1 + d;
          if (!S.includes(g2) || 3 * p + g1 + g2 !== R) continue;
          gaps.push({
            sizes: [...c, g1, ...c, g2, ...c],
            shape: {
              family: 'tihai',
              label: `${cell(c)} ×3, ${d > 0 ? 'widening' : 'narrowing'} ${g1}→${g2}`,
            },
          });
        }
    }
  }
  // the closest to "phrase and gap in proportion" first: short gaps, then shorter phrases
  out.sort(
    (a, b) =>
      a.sizes.length - b.sizes.length ||
      a.sizes[(a.sizes.length - 2) / 3]! - b.sizes[(b.sizes.length - 2) / 3]!,
  );
  gaps.sort((a, b) => a.sizes.length - b.sizes.length);
  return [...out, ...gaps, ...chakradhars(R, S)].slice(0, limit * 2);
}

/** Tihais whose phrase is itself a small tihai: P G P G P with P = c g c g c. */
function chakradhars(R: number, S: number[]): TihaiFill[] {
  const out: TihaiFill[] = [];
  for (const G of S) {
    const p = (R - 2 * G) / 3;
    if (!Number.isInteger(p) || p < 5) continue;
    for (const inner of tihaiFills(p, S, 6)) {
      if (inner.shape.family !== 'tihai' || inner.shape.label.includes('→')) continue;
      const P = inner.sizes;
      out.push({
        sizes: [...P, G, ...P, G, ...P],
        shape: { family: 'chakradhar', label: `(${inner.shape.label}) ×3, ${G} between` },
      });
    }
  }
  return out.sort((a, b) => a.sizes.length - b.sizes.length).slice(0, 20);
}

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
  // additive / subtractive: a motif of 2–5 groups built up or worn away
  for (const m of cells.filter((c) => c.length >= 2 && new Set(c).size > 1)) {
    for (const first of [1, 2]) {
      const blocks = range(first, m.length, 1).map((l) => m.slice(0, l));
      put(blocks.flat());
      put([...blocks].reverse().flat());
    }
  }
  for (let a = 1; a < FIB.length; a++)
    for (let b = a + 2; b < FIB.length; b++) {
      const up = FIB.slice(a, b + 1);
      put(up);
      put([...up].reverse());
      put([...up, ...up.slice(0, -1).reverse()]);
      put([...[...up].reverse(), ...up.slice(1)]);
    }
  // golden section: one longest stroke M starting near 0.618 (or 0.382) of R, the rest smaller.
  // Built directly with a fixed generator so the list is the same every time.
  {
    let seed = 12345;
    const fixed = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const tol = Math.max(0.5, R * 0.02);
    for (const M of S) {
      const small = S.filter((v) => v < M);
      if (!small.length || M < 2 * small[0]!) continue;
      for (const g of [0.618, 0.382])
        for (let at = Math.ceil(g * R - tol); at <= Math.floor(g * R + tol); at++) {
          const tail = R - M - at;
          if (at < 1 || tail < 1) continue;
          if (countWays(at, small) === 0n || countWays(tail, small) === 0n) continue;
          for (let i = 0; i < 6; i++) {
            const h = sampleTiling(at, small, fixed);
            const e = sampleTiling(tail, small, fixed);
            if (h && e) put([...h, M, ...e]);
          }
        }
    }
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
