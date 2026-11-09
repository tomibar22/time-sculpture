import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fillGroups, fillOptions, formatGroups, makeMeter, tihaiFills, variations } from '..';
import type { GroupSpec } from '..';

const g = (text: string): GroupSpec[] =>
  text
    .split(' ')
    .map((t) =>
      t.startsWith('(')
        ? { n: Number(t.slice(1, -1)), kind: 'rest' }
        : { n: Number(t), kind: 'sound' },
    );

describe('variations', () => {
  it('offers the passage backwards, rotated and regrouped, never the passage itself', () => {
    const v = variations(g('3 3 2'), 40, () => 0.5);
    const keys = v.map((x) => x.key);
    expect(keys).toContain('2 3 3');
    expect(keys).toContain('3 2 3');
    expect(keys).toContain('6 2');
    expect(keys).toContain('2 1 2 1 1 1');
    expect(keys).toContain('1 (2) 1 (2) 1 (1)');
    expect(keys).not.toContain('3 3 2');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps silences as silences', () => {
    const v = variations(g('3 (2) 4'));
    expect(v.find((x) => x.label === 'Backwards')?.key).toBe('4 (2) 3');
  });

  it('every variation has the length of the passage', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ n: fc.integer({ min: 1, max: 9 }), rest: fc.boolean() }), {
          minLength: 1,
          maxLength: 8,
        }),
        (spec) => {
          const base: GroupSpec[] = spec.map((x) => ({ n: x.n, kind: x.rest ? 'rest' : 'sound' }));
          const T = base.reduce((a, x) => a + x.n, 0);
          for (const v of variations(base)) {
            expect(v.groups.reduce((a, x) => a + x.n, 0)).toBe(T);
            expect(v.groups.every((x) => x.n >= 1)).toBe(true);
            expect(v.key).not.toBe(formatGroups(base));
          }
        },
      ),
    );
  });
});

describe('tihai', () => {
  it('says a phrase three times with the same breath between, filling the region exactly', () => {
    const t = tihaiFills(16, [2, 3, 4]);
    expect(t.length).toBeGreaterThan(0);
    for (const o of t) {
      expect(o.sizes.reduce((a, b) => a + b, 0)).toBe(16);
      expect(o.rests).toHaveLength(2);
      const n = o.rests[0]!;
      const phrase = o.sizes.slice(0, n);
      expect(o.sizes.slice(n + 1, 2 * n + 1)).toEqual(phrase);
      expect(o.sizes.slice(2 * n + 2)).toEqual(phrase);
      expect(o.sizes[o.rests[0]!]).toBe(o.sizes[o.rests[1]!]);
    }
    // 4 (2) 4 (2) 4
    expect(t.some((o) => o.sizes.join(' ') === '4 2 4 2 4')).toBe(true);
  });

  it('is offered among the fill options, with its silences', () => {
    const { options } = fillOptions(makeMeter(4, 2, 4), 0, 16, [2, 3, 4]);
    const tihai = options.filter((o) => o.shape?.family === 'tihai');
    expect(tihai.length).toBeGreaterThan(0);
    const o = tihai.find((x) => x.key === '4 (2) 4 (2) 4')!;
    expect(fillGroups(o).map((x) => x.kind)).toEqual(['sound', 'rest', 'sound', 'rest', 'sound']);
    expect(o.tiles).toBe(3);
    // onsets at pulses 0, 6, 12: on the beat at 0 and 12
    expect(o.onBeat).toBe(2);
  });

  it('there is none when the pulses do not divide that way', () => {
    expect(tihaiFills(4, [2, 3])).toEqual([]);
  });
});
