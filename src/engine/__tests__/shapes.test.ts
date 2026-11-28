import { describe, expect, it } from 'vitest';
import { shapeFills, shapeOf, wovenLabel } from '../shapes';

const fam = (t: number[]) => shapeOf(t)?.family;

describe('shapes', () => {
  it('names the shape of a fill', () => {
    expect(shapeOf([3, 2, 4, 3, 2, 4])?.label).toBe('(3 2 4) ×2');
    // rhythms with a name, at any scale and any number of times
    expect(shapeOf([3, 3, 2, 3, 3, 2])?.label).toBe('Tresillo ×2');
    expect(shapeOf([6, 6, 4])?.label).toBe('Tresillo, 2 times as broad');
    expect(fam([3, 3, 4, 2, 4])).toBe('world');
    // a cell that starts one group later each time
    expect(shapeOf([4, 3, 2, 3, 2, 4, 2, 4, 3])?.label).toBe('(4 3 2) turning, ×3');
    expect(fam([4, 3, 2, 2, 4, 3])).toBe('turn');
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

  it('builds known rhythms and turning cells that fit', () => {
    const fills = shapeFills(32, [2, 3, 4]);
    const keys = new Map(fills.map((f) => [f.sizes.join(' '), f.shape]));
    expect(keys.get('3 3 4 2 4 3 3 4 2 4')?.label).toBe('Son clave ×2');
    expect(keys.get('3 3 2 3 3 2 3 3 2 3 3 2')?.family).toBe('world');
    const turns = shapeFills(27, [2, 3, 4]).filter((f) => f.shape.family === 'turn');
    expect(turns.map((f) => f.sizes.join(' '))).toContain('4 3 2 3 2 4 2 4 3');
    for (const f of fills) expect(f.sizes.reduce((a, b) => a + b, 0)).toBe(32);
    for (const f of turns) expect(f.sizes.reduce((a, b) => a + b, 0)).toBe(27);
  });
});

describe('woven yatis (prastara)', () => {
  it('names 1 6 2 5 3 4 4 3 and builds it', () => {
    expect(wovenLabel([1, 6, 2, 5, 3, 4, 4, 3])).toBe('Woven 1→4 with 6→3, every pair 7');
    expect(wovenLabel([3, 3, 3, 3, 3, 3])).toBeNull();
    const all = shapeFills(28, [1, 2, 3, 4, 5, 6]).filter((f) => f.shape.family === 'woven');
    expect(all.map((f) => f.sizes.join(' '))).toContain('1 6 2 5 3 4 4 3');
  });
});

describe('the fills of a shape hold still (user report: Mirror showed others each time)', () => {
  it('shapeFills gives the same list every time', () => {
    const keys = () => shapeFills(32, [1, 2, 3, 4, 5]).map((o) => o.sizes.join(' '));
    expect(keys()).toEqual(keys());
    expect(shapeFills(32, [1, 2, 3, 4, 5]).some((o) => o.shape.family === 'mirror')).toBe(true);
  });
  it('fillOptions lists the same fills under each shape, whatever the random draw', async () => {
    const { fillOptions } = await import('../fills');
    const { makeMeter } = await import('../doc');
    const meter = makeMeter(4, 2, 4);
    const shaped = (seed: number) => {
      let x = seed;
      const rng = () => (x = (x * 9301 + 49297) % 233280) / 233280;
      return fillOptions(meter, 0, 32, [1, 2, 3, 4, 5], 400, rng)
        .options.filter((o) => o.shape)
        .map((o) => o.key)
        .sort();
    };
    expect(shaped(1)).toEqual(shaped(2));
  });
});
