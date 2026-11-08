import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../grid';
import { checkInvariants, docFrom, isSpace, makeMeter } from '../doc';
import { clearRange, fillRange, insertAtPulse, sliceRange, spanOf, spaceRange } from '../ops/range';
import type { Doc } from '../types';
import { sample, show, valid } from './helpers';

// sample: (2) 3 3 2 | 3 (1) 3 2 4 — pulses: (2)0-2 3:2-5 3:5-8 2:8-10 open:10-13 3:13-16 (1)16-17 3:17-20 2:20-22 4:22-26
const S = (n: number) => ({ n, kind: 'sound' as const });

describe('fillRange', () => {
  it('replaces whole groups', () => {
    const r = fillRange(sample(), 2, 8, [S(2), S(2), S(2)]);
    expect(show(r.doc)).toBe('(2) 2 2 2 2 open 3 3 (1) 3 2 4');
    valid(r.doc);
  });
  it('cuts groups: the head stays, the tail becomes silence', () => {
    const r = fillRange(sample(), 3, 6, [S(3)]);
    expect(show(r.doc)).toBe('(2) 1 3 (2) 2 open 3 3 (1) 3 2 4');
    expect(r.report.shortened).toEqual(['g2']);
    valid(r.doc);
  });
  it('inside the open space: silence before, the space continues after', () => {
    const r = fillRange(sample(), 11, 12, [S(1)]);
    expect(show(r.doc)).toBe('(2) 3 3 2 (1) 1 open 1 3 (1) 3 2 4');
    valid(r.doc);
  });
  it('covering the whole open space closes it', () => {
    const r = fillRange(sample(), 9, 14, [S(5)]);
    expect(show(r.doc)).toBe('(2) 3 3 1 5 open 0 (2) (1) 3 2 4');
    valid(r.doc);
  });
  it('the end of the open space stays open when the range ends inside it', () => {
    expect(show(fillRange(sample(), 8, 11, [S(3)]).doc)).toBe('(2) 3 3 3 open 2 3 (1) 3 2 4');
    expect(show(fillRange(sample(), 12, 15, [S(3)]).doc)).toBe('(2) 3 3 2 open 2 3 (1) (1) 3 2 4');
  });
  it('checks the sizes add up', () => {
    expect(fillRange(sample(), 2, 8, [S(5)]).report.reason).toBe('out-of-range');
    expect(fillRange(sample(), 5, 5, [S(1)]).report.ok).toBe(false);
  });
  it('clears to silence and slices for copying', () => {
    expect(show(clearRange(sample(), 2, 8).doc)).toBe('(2) (6) 2 open 3 3 (1) 3 2 4');
    expect(sliceRange(sample(), 3, 12)).toEqual([
      { n: 2, kind: 'rest' },
      { n: 3, kind: 'sound' },
      { n: 2, kind: 'sound' },
      { n: 2, kind: 'rest' },
    ]);
  });
  it('knows spans', () => {
    expect(spanOf(sample(), ['g2', 'g3'])).toEqual({ a: 2, b: 8 });
    expect(spaceRange(sample())).toEqual({ a: 10, b: 13 });
  });
});

describe('insertAtPulse', () => {
  it('at a boundary in the start: a normal insert, caret after it', () => {
    const r = insertAtPulse(sample(), 5, [S(1)]);
    expect(show(r.doc)).toBe('(2) 3 1 3 2 open 2 3 (1) 3 2 4');
    expect(r.caret).toBe(6);
  });
  it('in the ending the group lands before the caret, and the caret stays', () => {
    const r = insertAtPulse(sample(), 16, [S(1)]);
    expect(show(r.doc)).toBe('(2) 3 3 2 open 2 3 1 (1) 3 2 4');
    expect(r.caret).toBe(16);
  });
  it('inside the open space: silence up to the caret', () => {
    const r = insertAtPulse(sample(), 11, [S(1)]);
    expect(show(r.doc)).toBe('(2) 3 3 2 (1) 1 open 1 3 (1) 3 2 4');
    expect(r.caret).toBe(12);
  });
  it('inside a group: splits it, the tail becomes silence', () => {
    const r = insertAtPulse(sample(), 3, [S(1)]);
    expect(show(r.doc)).toBe('(2) 1 1 (2) 3 2 open 2 3 (1) 3 2 4');
    expect(r.caret).toBe(4);
    valid(r.doc);
  });
  it('needs room', () => {
    expect(insertAtPulse(sample(), 3, [S(4)]).report.reason).toBe('no-room');
    expect(insertAtPulse(sample(), 12, [S(2)]).report.reason).toBe('no-room');
  });
});

const docArb: fc.Arbitrary<Doc> = fc
  .record({
    sizes: fc.array(fc.record({ n: fc.integer({ min: 1, max: 5 }), rest: fc.boolean() }), {
      maxLength: 10,
    }),
    at: fc.nat(),
  })
  .map(({ sizes, at }) => {
    const meter = makeMeter(4, 3, 3); // 36 pulses
    const spec: (number | [number] | '|')[] = [];
    let sum = 0;
    for (const s of sizes) {
      if (sum + s.n > 36) break;
      sum += s.n;
      spec.push(s.rest ? [s.n] : s.n);
    }
    spec.splice(at % (spec.length + 1), 0, '|');
    return docFrom(meter, spec);
  });

/** Onset pulses of sounding groups. */
const onsets = (d: Doc) => {
  const out: number[] = [];
  let k = 0;
  for (const x of d.items) {
    if (!isSpace(x) && x.kind === 'sound') out.push(k);
    k += x.n;
  }
  return out;
};

describe('range properties', () => {
  it('fillRange keeps the invariants and every onset outside the range', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.nat(36),
        fc.nat(36),
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 6 }),
        (d, x, y, parts) => {
          const a = Math.min(x, y);
          const b = Math.max(x, y);
          if (b === a) return;
          // build groups that add up to b - a
          const groups: { n: number; kind: 'sound' }[] = [];
          let left = b - a;
          for (const p of parts) {
            if (left <= 0) break;
            const n = Math.min(p, left);
            groups.push({ n, kind: 'sound' });
            left -= n;
          }
          if (left > 0) groups.push({ n: left, kind: 'sound' });
          const r = fillRange(d, a, b, groups);
          expect(checkInvariants(r.doc)).toEqual([]);
          const outside = (o: number) => o < a || o >= b;
          expect(onsets(r.doc).filter(outside)).toEqual(onsets(d).filter(outside));
          let k = a;
          const inside = groups.map((g) => ((k += g.n), k - g.n));
          expect(onsets(r.doc).filter((o) => !outside(o))).toEqual(inside);
          expect(buildGrid(r.doc.meter).TS).toBe(36);
        },
      ),
      { numRuns: 400 },
    );
  });

  it('insertAtPulse keeps the invariants', () => {
    fc.assert(
      fc.property(docArb, fc.nat(36), fc.integer({ min: 1, max: 4 }), (d, k, n) => {
        const r = insertAtPulse(d, k, [{ n, kind: 'sound' }]);
        expect(checkInvariants(r.doc)).toEqual([]);
        if (r.report.ok) expect(r.caret).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });
});
