import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { patternLandings } from '../land';
import {
  gapTrades,
  headAsGap,
  innerBalances,
  oneStatement,
  runsOf,
  withRuns,
  balanceName,
  ramps,
  realize,
  rebalances,
  sayStatements,
  statementsOf,
  templateOf,
  templateText,
  yatiFills,
  yatiLabel,
  yatiSizes,
} from '../yati';
import { shapeOf, shapeFills } from '../shapes';
import { variations } from '../vary';
import { makeMeter } from '../doc';
import { measureFill, sortFills, fillOptions } from '../fills';
import study from '../../../docs/studies/yati-5-7-9.timesculpture.json';

/** The recorded composition (docs/studies/yati-5-7-9.md): 8 bars of 4, 6 pulses a beat. */
const PIECE = study.start.map((g) => g.pulses);
const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);

describe('yati: a cell three times, its main size changing', () => {
  it('reads the cell: X 3 X X 3 X X X 6', () => {
    const cell = [7, 3, 7, 7, 3, 7, 7, 7, 6];
    expect(templateOf(cell)).toEqual({ x: 7, slots: [0, 2, 3, 5, 6, 7], fixed: 12 });
    expect(templateText(cell)).toBe('X 3 X X 3 X X X 6');
    expect(realize(cell, 5)).toEqual([5, 3, 5, 5, 3, 5, 5, 5, 6]);
  });

  it('the shapes keep the mean', () => {
    for (const s of ['even', 'widening', 'narrowing', 'swelling', 'pinched'] as const)
      expect(sum(yatiSizes(s, 7, s === 'even' ? 0 : 2)!)).toBe(21);
    expect(yatiSizes('widening', 7, 2)).toEqual([5, 7, 9]);
    expect(yatiSizes('pinched', 3, 2)).toBeNull();
  });

  it('gives back the recorded composition from its middle cell, as the first widening', () => {
    expect(sum(PIECE)).toBe(192);
    const ls = patternLandings(192, [7, 3, 7, 7, 3, 7, 7, 7, 6], { on1: true, beat: 6 });
    const yati = ls.filter((l) => l.kind === 'yati');
    const found = yati.find((l) => l.sizes.join(' ') === PIECE.join(' '))!;
    expect(found).toMatchObject({ lead: 0, on1: 6, name: 'Widening 5 → 7 → 9' });
    expect(found.note).toBe('X 3 X X 3 X X X 6 · 6 6 before each · 5+7+9 = 3×7');
    expect(found.gaps).toEqual([0, 1, 11, 12, 22, 23]);
    // first the plain tihai of the 7s (the same landing), then widening by 1, by 2
    expect(yati.slice(0, 3).map((l) => l.name)).toEqual([
      'Even 7 → 7 → 7',
      'Widening 6 → 7 → 8',
      'Widening 5 → 7 → 9',
    ]);
  });

  it('also from the first cell (the fives)', () => {
    const ls = patternLandings(192, [5, 3, 5, 5, 3, 5, 5, 5, 6], { on1: true, beat: 6 });
    expect(ls.some((l) => l.kind === 'yati' && l.sizes.join(' ') === PIECE.join(' '))).toBe(true);
  });

  it('every yati way lands', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 200 }),
        fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 6 }),
        fc.boolean(),
        fc.constantFrom(0, 2, 3, 4, 6),
        (R, cell, on1, beat) => {
          for (const l of patternLandings(R, cell, { on1, beat }).filter(
            (l) => l.kind === 'yati',
          )) {
            expect(l.lead).toBeGreaterThanOrEqual(0);
            expect(l.lead + sum(l.sizes)).toBe(R);
            expect(l.sizes.every((n) => Number.isInteger(n) && n >= 1)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('statements: reading a passage as a cell said again, its main size changing', () => {
  it('reads the studied piece: three statements, the last tile on the 1', () => {
    const st = statementsOf(PIECE)!;
    expect(st).toMatchObject({ k: 3, xs: [5, 7, 9], cut: true });
    expect(sayStatements(st, st.xs)).toEqual(PIECE);
    // three 7s: the plain tihai, the same length
    expect(sum(sayStatements(st, [7, 7, 7]))).toBe(192);
    expect(balanceName(st.xs)).toBe('Widening');
  });
  it('reads a plain tihai with a gap and a repeat', () => {
    // "3 2 | 1 | 3 2 | 1 | 3 2", or "3 2 1" three times with the last 1 on the 1: both say it
    const t = statementsOf([3, 2, 1, 3, 2, 1, 3, 2])!;
    expect(t).toMatchObject({ k: 3, xs: [3, 3, 3] });
    expect(sayStatements(t, t.xs)).toEqual([3, 2, 1, 3, 2, 1, 3, 2]);
    expect(statementsOf([3, 3, 2, 3, 3, 2])).toMatchObject({ k: 2, xs: [3, 3] });
    expect(statementsOf([3, 4, 2, 5, 1])).toBeNull();
  });
  it('rebalances keep the sum: even, widening, narrowing, swelling, pinched', () => {
    const r = rebalances([5, 7, 9]);
    expect(r[0]).toMatchObject({ xs: [7, 7, 7], name: 'Even', sum: '7+7+7 = 3×7' });
    expect(r.map((x) => x.xs.join(' '))).toContain('9 7 5');
    expect(r.map((x) => x.xs.join(' '))).toContain('6 9 6');
    for (const x of r) expect(sum(x.xs)).toBe(21);
    expect(rebalances([3, 4])).toEqual([]); // no whole mean
  });
  it('a written-out slowing down keeps the length', () => {
    expect(ramps([3, 3, 2])).toEqual([]);
    const r = ramps([4, 4, 4, 4, 4]);
    expect(r[0]).toEqual({ sizes: [2, 3, 4, 5, 6], label: 'Slowing down, 1 a tile' });
    for (const x of r) expect(sum(x.sizes)).toBe(20);
  });
  it('Vary: a plain tihai of the 7-cell becomes the studied piece, in the Balanced group', () => {
    const st = statementsOf(PIECE)!;
    const plain = sayStatements(st, [7, 7, 7]);
    const vs = variations(plain.map((n) => ({ n, kind: 'sound' as const })));
    const v = vs.find((x) => x.groups.map((g) => g.n).join(' ') === PIECE.join(' '))!;
    expect(v).toMatchObject({ kind: 'balance', label: 'Widening 5 → 7 → 9 · 5+7+9 = 3×7' });
    expect(vs[0]!.kind).toBe('balance');
  });
  it('Browse: yatis are built from the allowed sizes, named, and land exactly', () => {
    const fills = yatiFills(48, [2, 3, 4, 5, 6]);
    expect(fills.length).toBeGreaterThan(5);
    for (const t of fills) {
      expect(t.every((n) => [2, 3, 4, 5, 6].includes(n))).toBe(true);
      expect(sum(t)).toBe(48);
    }
    const named = shapeFills(48, [2, 3, 4, 5, 6]).filter((f) => f.shape.family === 'yati');
    expect(named.length).toBeGreaterThan(3);
    // the studied piece is a yati by name (6 6 before each, and the cut last tile)
    expect(yatiLabel(PIECE)).toBe('Widening 5 → 7 → 9 · 6 6 X 3 X X 3 X X X 6, last on the 1');
    // an accidental reading of a random fill is no yati
    expect(yatiLabel([2, 2, 5, 7, 2, 5, 7, 2])).toBeNull();
    expect(shapeOf(PIECE)?.family).toBe('yati');
    // a refrain stays a refrain
    expect(shapeOf([2, 3, 2, 4, 2, 5])?.family).toBe('refrain');
  });
  it('every built yati is read back as a yati, and Vary keeps the length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 12, max: 96 }), (R) => {
        for (const t of yatiFills(R, [2, 3, 4, 5, 6, 7], 12)) {
          expect(sum(t)).toBe(R);
          expect(statementsOf(t)).not.toBeNull();
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe('seams: across the beat inside, on the beat at the seams', () => {
  it('the studied piece: every seam on a beat, most strokes across one', () => {
    const m = measureFill(makeMeter(4, 8, 6), 0, PIECE);
    expect(m.seams).toBe(1);
    expect(m.crossing).toBeGreaterThan(0.4);
  });
  it('a fill with no statements has none; the sort puts seams first', () => {
    const meter = makeMeter(4, 2, 4);
    expect(measureFill(meter, 0, [3, 4, 2, 5, 1, 6, 3, 8]).seams).toBe(0);
    const { options } = fillOptions(meter, 0, 32, [2, 3, 4, 5, 6]);
    const best = sortFills(options, 'seams')[0]!;
    expect(best.seams).toBe(1);
  });
});

describe('one level down, and between the gaps and the cells', () => {
  it('reads the runs inside the cell: X | 3 | X X | 3 | X X X | 6 = 1 2 3', () => {
    const cell = [7, 3, 7, 7, 3, 7, 7, 7, 6];
    const slots = templateOf(cell)!.slots;
    expect(runsOf(cell, slots)!.runs).toEqual([1, 2, 3]);
    expect(withRuns(cell, slots, [3, 2, 1])!.cell).toEqual([7, 7, 7, 3, 7, 7, 3, 7, 6]);
    expect(runsOf([3, 3, 2], [0, 1])).toBeNull();
  });
  it('the studied piece turned round inside: X X X 3 X X 3 X, the landing kept', () => {
    const st = statementsOf(PIECE)!;
    const r = innerBalances(st);
    const turned = r.find((x) => x.label.startsWith('Inside: narrowing 3 → 2 → 1'))!;
    expect(sum(turned.sizes)).toBe(192);
    expect(turned.sizes.slice(0, 10)).toEqual([6, 6, 5, 5, 5, 3, 5, 5, 3, 5]);
    for (const x of r) expect(sum(x.sizes)).toBe(192);
    // a passage that is no statements: one cell of its own
    expect(
      innerBalances(oneStatement([5, 3, 5, 5, 3, 5, 5, 5])!).map((x) => x.sizes),
    ).toContainEqual([5, 5, 5, 3, 5, 5, 3, 5]);
  });
  it('the 6 6 at the head of each cell is the gap before each', () => {
    const st = headAsGap(statementsOf(PIECE)!);
    expect(st).toMatchObject({ gap: [6, 6], before: true, xs: [5, 7, 9] });
    expect(sayStatements(st, st.xs)).toEqual(PIECE);
  });
  it('the gaps give to the cells or take from them; the total stays', () => {
    const t = gapTrades(statementsOf(PIECE)!);
    const give = t.find((x) => x.label === 'Gaps give 18: 6 6 → 6, cells 6 → 8 → 10')!;
    expect(give.sizes.slice(0, 2)).toEqual([6, 6]);
    expect(give.sizes[1]).toBe(6);
    expect(give.sizes[2]).toBe(3);
    expect(t.map((x) => x.label)).toContain('Gaps take 18: 6 6 → 6 6 6, cells 4 → 6 → 8');
    expect(t.map((x) => x.label)).toContain('Gaps give 36: 6 6 → none, cells 7 → 9 → 11');
    for (const x of t) expect(sum(x.sizes)).toBe(192);
  });
  it('every trade and every inner balance keeps the length (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 0, maxLength: 2 }),
        fc.integer({ min: 2, max: 9 }),
        (cell, gap, x) => {
          const c = [x, ...cell, x, x];
          const passage = [...c, ...gap, ...c, ...gap, ...c];
          const st = statementsOf(passage);
          if (!st) return;
          const T = sum(passage);
          for (const r of [...gapTrades(st), ...innerBalances(st)]) {
            expect(sum(r.sizes)).toBe(T);
            expect(r.sizes.every((n) => n >= 1)).toBe(true);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
