import { describe, expect, it } from 'vitest';
import { addSection, docFrom, makeMeter, setChord } from '../engine';
import { toSaved } from './serialize';
import { createdOf, factsOf, filterEntries, filterGroups, sortEntries } from './facts';
import type { Sortable } from './facts';
import {
  canMoveFolder,
  childrenOf,
  countIn,
  deleteChanges,
  emptyShelf,
  folderOf,
  freeName,
  parentOf,
  pathOf,
  treeOf,
  within,
} from './shelf';
import type { Shelf } from './shelf';

const settings = { tempo: 80 };

describe('what the library knows about a piece', () => {
  it('reads bars, pulses, tiles, ratios and whether it lands', () => {
    const d = docFrom(makeMeter(4, 2, [4, 3, 4, 4, 2, 4, 4, 4]), [[2], 3, '|', 5, 2]);
    const f = factsOf(toSaved(d, 'A', settings));
    expect(f).toMatchObject({
      bars: 2,
      beats: 8,
      pulses: 29,
      tiles: 3,
      tempo: 80,
      barSizes: [4],
      ratios: [2, 3, 4],
      modulation: false,
      metreChange: false,
      finished: false,
      chords: false,
    });
    const full = docFrom(makeMeter(3, 1, 2), [3, 3]);
    expect(factsOf(toSaved(full, 'B', settings)).finished).toBe(true);
  });
  it('sees modulations, metre changes and chords', () => {
    let d = docFrom(makeMeter(4, 2, 4), [4, '|']);
    d = addSection(d, 4, { from: 2, to: 3, beatsPerBar: 3 }).doc;
    d = setChord(d, d.items[0]!.id, 'C-7');
    const f = factsOf(toSaved(d, 'M', settings));
    expect(f.modulation).toBe(true);
    expect(f.barSizes).toEqual([3, 4]);
    expect(f.metreChange).toBe(true);
    expect(f.chords).toBe(true);
  });
  it('reads when a piece was made from its id', () => {
    const t = Date.UTC(2026, 3, 1);
    expect(createdOf(`c${t.toString(36)}abcde`, t + 5000)).toBe(t);
    expect(createdOf('imported', 42)).toBe(42);
  });
});

const e = (id: string, name: string, updated: number, f: Partial<ReturnType<typeof factsOf>>) =>
  ({
    id,
    name,
    updated,
    facts: {
      v: 1,
      bars: 2,
      beats: 8,
      pulses: 32,
      tiles: 5,
      tempo: 72,
      barSizes: [4],
      ratios: [4],
      modulation: false,
      metreChange: false,
      finished: false,
      repeats: false,
      chords: false,
      named: false,
      ...f,
    },
  }) satisfies Sortable;

const list = [
  e('a', 'Tihai in 7', 300, { barSizes: [7], bars: 8, beats: 56, tempo: 120, finished: true }),
  e('b', 'étude 2', 100, { ratios: [3, 4], bars: 20, beats: 80, tiles: 30 }),
  e('c', 'Etude 10', 200, { modulation: true, bars: 4, beats: 16 }),
];

describe('sorting and filtering the list', () => {
  it('sorts by date, name (naturally), length and tempo, either way round', () => {
    expect(sortEntries(list, 'edited').map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(sortEntries(list, 'name').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(sortEntries(list, 'name', true).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(sortEntries(list, 'length').map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(sortEntries(list, 'tempo')[0]!.id).toBe('a');
  });
  it('a chip of a group is "or", groups are "and"', () => {
    expect(filterEntries(list, ['bar:7', 'bar:4']).length).toBe(3);
    expect(filterEntries(list, ['bar:4', 'has:modulation']).map((x) => x.id)).toEqual(['c']);
    expect(filterEntries(list, ['ratio:mixed']).map((x) => x.id)).toEqual(['b']);
    expect(filterEntries(list, ['state:finished']).map((x) => x.id)).toEqual(['a']);
    expect(filterEntries(list, ['length:long']).map((x) => x.id)).toEqual(['b']);
  });
  it('offers only chips that tell the pieces apart', () => {
    const gs = filterGroups(list, [], 400);
    const keys = gs.flatMap((g) => g.chips.map((c) => c.key));
    expect(keys).toContain('bar:7');
    expect(keys).toContain('has:modulation');
    expect(keys).not.toContain('has:chords'); // no piece has chords
    const same = [list[2]!, { ...list[2]!, id: 'd' }];
    expect(filterGroups(same, [], 400).find((g) => g.id === 'bar')).toBeUndefined();
  });
});

describe('folders', () => {
  const shelf = (): Shelf => ({
    folders: {
      a: { name: 'Etudes', parent: null, updated: 1 },
      b: { name: 'Tihais', parent: 'a', updated: 1 },
      c: { name: 'Old', parent: null, updated: 1, deleted: true },
      d: { name: 'Lost', parent: 'c', updated: 1 },
    },
    places: {
      p1: { folder: 'b', updated: 1 },
      p2: { folder: 'a', updated: 1 },
      p3: { folder: 'c', updated: 1 },
    },
  });
  it('reads the tree; what is in a deleted folder is at the top', () => {
    const s = shelf();
    expect(childrenOf(s, null)).toEqual(['a', 'd']);
    expect(pathOf(s, 'b')).toEqual(['a', 'b']);
    expect(folderOf(s, 'p3')).toBe(null);
    expect(countIn(s, 'a', ['p1', 'p2', 'p3'])).toBe(2);
    expect(within(s, 'p1', 'a')).toBe(true);
    expect(within(s, 'p2', 'b')).toBe(false);
    expect(treeOf(s).map((t) => `${t.id}${t.depth}`)).toEqual(['a0', 'b1', 'd0']);
  });
  it('never lets a folder into itself, and cuts a loop at the top', () => {
    const s = shelf();
    expect(canMoveFolder(s, 'a', 'b')).toBe(false);
    expect(canMoveFolder(s, 'b', 'd')).toBe(true);
    const loop: Shelf = {
      ...s,
      folders: { ...s.folders, a: { ...s.folders.a!, parent: 'b' } },
    };
    expect(parentOf(loop, 'a')).toBe(null);
    expect(treeOf(loop).length).toBeGreaterThan(0);
  });
  it('deleting a folder keeps what is in it, one level up', () => {
    const s = shelf();
    const ch = deleteChanges(s, 'a', ['p1', 'p2'], 9);
    expect(ch.folders.b).toMatchObject({ parent: null, updated: 9 });
    expect(ch.places.p2).toEqual({ folder: null, updated: 9 });
    expect(ch.folders.a!.deleted).toBe(true);
  });
  it('names a new folder so it is not mistaken for another', () => {
    const s = emptyShelf();
    expect(freeName(s, null)).toBe('New folder');
    s.folders.x = { name: 'New folder', parent: null, updated: 1 };
    expect(freeName(s, null)).toBe('New folder 2');
  });
});
