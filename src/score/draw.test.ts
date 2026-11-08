import { describe, expect, it } from 'vitest';
import { beatsLabel } from './draw';

describe('beatsLabel', () => {
  it('reads like a musician counts', () => {
    expect(beatsLabel(3)).toBe('3');
    expect(beatsLabel(1.75)).toBe('1¾');
    expect(beatsLabel(2 + 1 / 3)).toBe('2⅓');
    expect(beatsLabel(0.625)).toBe('⅝');
    expect(beatsLabel(1 + 2 / 7)).toBe('1 2/7');
  });
});
