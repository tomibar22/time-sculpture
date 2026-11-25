import { describe, expect, it } from 'vitest';
import { carryChords, chordOf, docFrom, makeMeter, setChord } from '../doc';
import { merge, remove, split } from '../ops/items';
import { slide } from '../ops/move';

const base = () => docFrom(makeMeter(4, 2, 4), [3, 5, '|', 4]); // g1 3, g2 5, space, g3 4

describe('chords', () => {
  it('are written, trimmed, changed and removed', () => {
    const d = setChord(base(), 'g1', '  C-7(b6) ');
    expect(chordOf(d, 'g1')).toBe('C-7(b6)');
    expect(setChord(d, 'g1', 'C-7(b6)')).toBe(d); // no change
    expect(chordOf(setChord(d, 'g1', ''), 'g1')).toBe('');
    expect(setChord(d, 'space', 'X')).toBe(d); // only on groups that sound
  });
  it('ride with their group through the edits (the store carries them)', () => {
    const d = setChord(setChord(base(), 'g1', 'C'), 'g2', 'D');
    const moved = carryChords(d, slide(d, ['g2'], 2).doc);
    expect(chordOf(moved, 'g2')).toBe('D');
    const halves = carryChords(d, split(d, ['g2']).doc); // the head keeps the id
    expect(chordOf(halves, 'g2')).toBe('D');
    expect(Object.keys(halves.chords ?? {})).toEqual(['g1', 'g2']);
    const one = carryChords(d, merge(d, ['g1', 'g2']).doc); // the first id stays
    expect(one.chords).toEqual({ g1: 'C' });
    const gone = carryChords(d, remove(d, ['g1']).doc);
    expect(gone.chords).toEqual({ g2: 'D' });
  });
});
