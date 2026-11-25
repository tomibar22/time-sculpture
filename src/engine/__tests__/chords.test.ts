import { describe, expect, it } from 'vitest';
import { carryChords, chordOf, docFrom, makeMeter, setChord } from '../doc';
import { merge, remove, split } from '../ops/items';
import { slide } from '../ops/move';
import { copyGroups, formatClip, parseGroups, placeChords } from '../ops/edit';
import { insertAtPulse, sliceRange } from '../ops/range';

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

describe('chords on the clipboard', () => {
  it('are copied with their groups, as text too', () => {
    const d = setChord(setChord(base(), 'g1', 'C-7(b6)'), 'g2', 'F7 alt, +5');
    const groups = copyGroups(d, ['g1', 'g2']);
    expect(groups).toEqual([
      { n: 3, kind: 'sound', chord: 'C-7(b6)' },
      { n: 5, kind: 'sound', chord: 'F7 alt, +5' },
    ]);
    const text = formatClip(groups);
    expect(text).toBe('3[C-7(b6)] 5[F7 alt, +5]');
    expect(parseGroups(text)).toEqual(groups);
    expect(parseGroups('3 (2) 4[G]')).toEqual([
      { n: 3, kind: 'sound' },
      { n: 2, kind: 'rest' },
      { n: 4, kind: 'sound', chord: 'G' },
    ]);
    expect(sliceRange(d, 0, 8)[0]).toEqual({ n: 3, kind: 'sound', chord: 'C-7(b6)' });
  });
  it('come back on the pasted groups, keeping the ones already there', () => {
    const d = setChord(base(), 'g1', 'C');
    const groups = parseGroups('2[D] 2[E]')!;
    const r = insertAtPulse(d, 8, groups); // after g2, in the open space
    const out = placeChords(r.doc, 8, groups, d);
    const ids = r.report.created.filter(
      (id) => out.items.find((x) => x.id === id)?.kind === 'sound',
    );
    expect(ids.map((id) => chordOf(out, id))).toEqual(['D', 'E']);
    expect(chordOf(out, 'g1')).toBe('C');
  });
});
