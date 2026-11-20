import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { patternLandings } from '../land';
import { realize, templateOf, templateText, yatiSizes } from '../yati';
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
    expect(found.note).toBe('X 3 X X 3 X X X 6 · 6 6 before each');
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
