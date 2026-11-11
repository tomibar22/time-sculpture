import { describe, expect, it } from 'vitest';
import {
  assertValid,
  checkInvariants,
  emptyDoc,
  findItem,
  docFrom,
  freePulses,
  joinRests,
  makeMeter,
  sequence,
  spaceSize,
} from '../doc';
import { insertionIndex, rangeIds } from '../selection';
import { sample } from './helpers';
import type { Doc } from '../types';

describe('document helpers', () => {
  it('describes the phrase as start │ ending', () => {
    expect(sequence(sample())).toEqual({
      start: ['(2)', '3', '3', '2'],
      ending: ['3', '(1)', '3', '2', '4'],
    });
    expect(freePulses(sample())).toBe(3);
    expect(spaceSize(sample())).toBe(3);
    expect(findItem(sample(), 'g2')?.n).toBe(3);
  });

  it('selects ranges without the space', () => {
    expect(rangeIds(sample().items, 'g6', 'g3')).toEqual(['g3', 'g4', 'g5', 'g6']);
    expect(rangeIds(sample().items, 'g6', 'nope')).toEqual([]);
  });

  it('finds insertion points', () => {
    const items = sample().items; // (2) 3 3 2 [open 3 @10] 3 ...
    expect(insertionIndex(items, 0)).toBe(0);
    expect(insertionIndex(items, 1)).toBe(1);
    expect(insertionIndex(items, 10)).toBe(4);
    expect(insertionIndex(items, 12)).toBe(5);
    expect(insertionIndex(items, 99)).toBe(items.length);
  });

  it('detects every kind of invariant violation', () => {
    const bad: Doc = {
      meter: { beatsPerCycle: 2, cycles: 0, subdivision: [9] },
      items: [
        { id: 'a', kind: 'sound', n: 0 },
        { id: 'a', kind: 'rest', n: 1.5 },
      ],
      nextId: 1,
    };
    const errs = checkInvariants(bad);
    expect(errs.length).toBeGreaterThanOrEqual(6);
    expect(() => assertValid(bad)).toThrow();
    expect(assertValid(emptyDoc(makeMeter(5, 1, 3))).items[0]!.n).toBe(15);
  });
});

describe('joinRests', () => {
  it('joins silences side by side, the first keeping its id', () => {
    const d = docFrom(makeMeter(4, 1, 4), [3, [2], [1], 2, '|']);
    const j = joinRests(d);
    expect(j.items.map((x) => `${x.kind === 'space' ? 'S' : x.kind[0]}${x.n}`)).toEqual([
      's3',
      'r3',
      's2',
      'S8',
    ]);
    expect(j.items[1]!.id).toBe(d.items[1]!.id);
    expect(joinRests(j)).toBe(j);
  });

  it('silence next to the open space becomes open space, without moving any onset', () => {
    const d = docFrom(makeMeter(4, 1, 4), [3, [2], '|', [1], 2]);
    const j = joinRests(d);
    expect(j.items.map((x) => `${x.kind === 'space' ? 'S' : x.kind[0]}${x.n}`)).toEqual([
      's3',
      'S11',
      's2',
    ]);
    // an emptied piece is an empty piece again
    const e = joinRests(docFrom(makeMeter(4, 1, 4), [[16], '|']));
    expect(e.items.map((x) => x.kind)).toEqual(['space']);
  });
});
