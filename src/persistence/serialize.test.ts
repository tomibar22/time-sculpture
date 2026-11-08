import { describe, expect, it } from 'vitest';
import { docFrom, makeMeter, sequence } from '../engine';
import { decodeShare, encodeShare, fromSaved, toSaved } from './serialize';

const doc = docFrom(makeMeter(4, 2, [4, 3, 4, 4, 2, 4, 4, 4]), [[2], 3, '|', 5, 2]);

describe('serialisation', () => {
  it('round-trips through the file format', () => {
    const saved = toSaved(doc, 'Phrase', { tray: [2, 3], tempo: 96, perRow: 2, rows: [1, 1] });
    const back = fromSaved(JSON.parse(JSON.stringify(saved)));
    expect(sequence(back.doc)).toEqual(sequence(doc));
    expect(back.doc.meter.subdivision).toEqual(doc.meter.subdivision);
    expect(back.settings).toEqual({ tray: [2, 3], tempo: 96, perRow: 2, rows: [1, 1] });
    const old = { ...saved, perRow: undefined, rows: undefined };
    expect(fromSaved(old).settings).toMatchObject({ perRow: 1, rows: [] });
    expect(back.name).toBe('Phrase');
  });

  it('rejects foreign and damaged files', () => {
    expect(() => fromSaved({ hello: 1 })).toThrow('Not a Time Sculpture file');
    const bad = { ...toSaved(doc, 'x', { tray: [2], tempo: 72 }), items: ['99', '|'] };
    expect(() => fromSaved(bad)).toThrow(/damaged/);
  });

  it('round-trips through a compact share code', async () => {
    const saved = toSaved(doc, 'Phrase', { tray: [2, 3], tempo: 96 });
    const code = await encodeShare(saved);
    expect(code.startsWith('z')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(code)).toEqual(saved);
  });
});
