import { describe, expect, it } from 'vitest';
import { docFrom, makeMeter, sequence } from '../engine';
import { decodeShare, encodeShare, fromSaved, toSaved } from './serialize';

// 4 beats × 2 cycles; beat 2 is 3:1, beat 5 is 2:1, the rest 4:1 (29 pulses)
const doc = docFrom(makeMeter(4, 2, [4, 3, 4, 4, 2, 4, 4, 4]), [[2], 3, '|', 5, 2]);
const settings = { tempo: 96, perRow: 2, rows: [1, 1] };

describe('the Time Sculpture file (v2)', () => {
  it('is plain and readable', () => {
    const f = toSaved(doc, 'Phrase', settings);
    expect(f).toMatchObject({
      format: 'time-sculpture',
      version: 2,
      title: 'Phrase',
      tempo: 96,
      beatsPerCycle: 4,
      cycles: 2,
      subdivision: [4, 3, 4, 4, 2, 4, 4, 4],
      start: [{ pulses: 2, rest: true }, { pulses: 3 }],
      ending: [{ pulses: 5 }, { pulses: 2 }],
      layout: { cyclesPerRow: 2, rows: [1, 1] },
    });
  });

  it('lists the sounding groups in beats for other programs', () => {
    const f = toSaved(doc, 'Phrase', settings);
    // the 3 starts at pulse 2 = beat 0.5 and lasts 2 pulses of 4:1 + 1 of 3:1
    expect(f.sounds![0]).toEqual({ at: 0.5, length: 0.833333, pulses: 3 });
    // the last 2 ends exactly on the next beat 1 (beat 8)
    const last = f.sounds![f.sounds!.length - 1]!;
    expect(last.at + last.length).toBeCloseTo(8);
  });

  it('round-trips', () => {
    const back = fromSaved(JSON.parse(JSON.stringify(toSaved(doc, 'Phrase', settings))));
    expect(sequence(back.doc)).toEqual(sequence(doc));
    expect(back.doc.meter.subdivision).toEqual(doc.meter.subdivision);
    expect(back.settings).toEqual(settings);
    expect(back.name).toBe('Phrase');
  });

  it('still reads version 1 files', () => {
    const v1 = {
      format: 'time-sculpture',
      version: 1,
      name: 'Old',
      beats: 4,
      cycles: 2,
      subdivision: [4, 4, 4, 4, 4, 4, 4, 4],
      items: ['r2', '3', '|', '4'],
      tray: [2, 3],
      tempo: 80,
    };
    const back = fromSaved(v1);
    expect(sequence(back.doc)).toEqual({ start: ['(2)', '3'], ending: ['4'] });
    expect(back.settings).toEqual({ tempo: 80, perRow: 1, rows: [] });
    expect(back.name).toBe('Old');
  });

  it('rejects foreign, future and damaged files', () => {
    expect(() => fromSaved({ hello: 1 })).toThrow('Not a Time Sculpture file');
    expect(() => fromSaved({ format: 'time-sculpture', version: 9 })).toThrow(/newer version/);
    const bad = { ...toSaved(doc, 'x', settings), ending: [{ pulses: 99 }] };
    expect(() => fromSaved(bad)).toThrow(/damaged/);
    const zero = { ...toSaved(doc, 'x', settings), start: [{ pulses: 0 }] };
    expect(() => fromSaved(zero)).toThrow(/damaged/);
  });

  it('round-trips through a compact share code without the derived sounds', async () => {
    const saved = toSaved(doc, 'Phrase', settings);
    const code = await encodeShare(saved);
    expect(code.startsWith('z')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const lean = { ...saved };
    delete lean.sounds;
    expect(await decodeShare(code)).toEqual(lean);
  });
});
