import { describe, expect, it } from 'vitest';
import { carryColors, docFrom, makeMeter, setColors } from '../doc';
import { remove, split } from '../ops/items';
import { slide } from '../ops/move';
import { randomTileColor, sizeColor, TILE_PALETTES } from '../../score/colors';

const base = () => docFrom(makeMeter(4, 2, 4), [3, 5, '|', 4]); // g1 3, g2 5, space, g3 4

describe('tile colours', () => {
  it('are given to sounding groups only and taken back', () => {
    const d = setColors(base(), ['g1', 'space'], () => '#123abc');
    expect(d.colors).toEqual({ g1: '#123abc' });
    expect(setColors(d, ['g1'], () => '#123abc')).toBe(d);
    expect(setColors(d, ['g1'], () => 'red').colors).toEqual({});
    const none = setColors(d, ['g1'], () => null);
    expect(none.colors).toEqual({});
    expect(carryColors(d, none).colors).toEqual({}); // a commit does not bring them back
  });
  it('ride with their group through the edits', () => {
    const d = setColors(base(), ['g1', 'g2'], (id) => (id === 'g1' ? '#111111' : '#222222'));
    expect(carryColors(d, slide(d, ['g2'], 2).doc).colors).toEqual(d.colors);
    expect(carryColors(d, split(d, ['g2']).doc).colors).toEqual(d.colors);
    expect(carryColors(d, remove(d, ['g1']).doc).colors).toEqual({ g2: '#222222' });
    expect(carryColors(d, remove(d, ['g1', 'g2']).doc).colors).toEqual({});
  });
  it('random colours are valid; every palette has a colour per size and classic is first', () => {
    for (let i = 0; i < 50; i++) expect(randomTileColor()).toMatch(/^#[0-9a-f]{6}$/);
    expect(TILE_PALETTES[0]!.id).toBe('classic');
    expect(sizeColor(2, TILE_PALETTES[0]!.colors)).toBe('#159a90');
    for (const p of TILE_PALETTES) {
      expect(p.colors).toHaveLength(13);
      expect(new Set(p.colors.slice(1)).size).toBe(12);
    }
  });
});
