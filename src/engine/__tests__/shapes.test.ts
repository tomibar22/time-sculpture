import { describe, expect, it } from 'vitest';
import { shapeFills, shapeOf } from '../shapes';

const fam = (t: number[]) => shapeOf(t)?.family;

describe('shapes', () => {
  it('names the shape of a fill', () => {
    expect(shapeOf([3, 3, 2, 3, 3, 2])?.label).toBe('(3 3 2) ×2');
    expect(fam([3, 2, 3, 3, 2])).toBe('grow');
    expect(fam([3, 2, 3, 3, 2, 3, 3, 3, 2])).toBe('grow');
    expect(shapeOf([3, 3, 3, 2])?.label).toBe('3 ×3 → 2');
    expect(fam([1, 2, 3, 4])).toBe('pyramid');
    expect(shapeOf([2, 3, 4, 3, 2])?.label).toBe('Arch 2→4→2');
    expect(shapeOf([5, 4, 3, 4, 5])?.label).toBe('Valley 5→3→5');
    expect(fam([2, 2, 3, 3, 4, 4])).toBe('pyramid');
    expect(fam([2, 3, 2, 4, 2, 5])).toBe('refrain');
    expect(fam([3, 2, 3, 2, 2])).toBe('even');
    expect(fam([2, 5, 4, 4, 5, 2])).toBe('mirror');
    expect(shapeOf([2, 5, 3, 7])).toBeNull();
  });
  it('builds shaped fills that fill exactly, with the allowed sizes', () => {
    for (const [R, S] of [
      [16, [2, 3, 4, 5, 7]],
      [24, [2, 3]],
      [13, [1, 2, 3, 4, 5, 6, 7, 8, 9]],
      [7, [7]],
    ] as [number, number[]][]) {
      const out = shapeFills(R, S);
      for (const o of out) {
        expect(o.sizes.reduce((a, b) => a + b, 0)).toBe(R);
        expect(o.sizes.every((v) => S.includes(v))).toBe(true);
        expect(shapeOf(o.sizes)).toEqual(o.shape);
      }
      expect(new Set(out.map((o) => o.sizes.join(' '))).size).toBe(out.length);
    }
    const keys = shapeFills(16, [2, 3, 4, 5]).map((o) => o.sizes.join(' '));
    expect(keys).toContain('3 3 2 3 3 2');
    expect(keys).toContain('3 2 4 2 5');
    expect(keys).toContain('4 3 2 3 4');
  });
});
