// @vitest-environment jsdom
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as E from '../engine';
import { docFrom, makeMeter } from '../engine';
import { MIDI_PPQ, midiFile } from './midi';
import { musicXml } from './musicxml';

const parse = (xml: string) => {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  expect(d.querySelector('parsererror')).toBeNull();
  return d;
};
const num = (el: Element, sel: string) => Number(el.querySelector(sel)?.textContent);

/** Read a format-0 file back: notes (on tick, off tick, pitch), tempo changes and the end. */
function readMidi(bytes: Uint8Array) {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4));
  const ppq = (bytes[12]! << 8) | bytes[13]!;
  const len = (bytes[18]! << 24) | (bytes[19]! << 16) | (bytes[20]! << 8) | bytes[21]!;
  let i = 22;
  let tick = 0;
  const on = new Map<number, number>();
  const notes: { on: number; off: number; pitch: number }[] = [];
  const tempi: { tick: number; us: number }[] = [];
  let end = -1;
  while (i < 22 + len) {
    let delta = 0;
    for (;;) {
      const b = bytes[i++]!;
      delta = (delta << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    tick += delta;
    const status = bytes[i++]!;
    if (status === 0xff) {
      const type = bytes[i++]!;
      const n = bytes[i++]!;
      if (type === 0x51)
        tempi.push({ tick, us: (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]! });
      if (type === 0x2f) end = tick;
      i += n;
    } else {
      const pitch = bytes[i++]!;
      i++;
      if (status === 0x90) on.set(pitch, tick);
      else notes.push({ on: on.get(pitch)!, off: tick, pitch });
    }
  }
  return { head, ppq, len, total: bytes.length, notes, tempi, end };
}

describe('MIDI export', () => {
  it('writes every sounding group as a note, in beats', () => {
    // 4 beats × 2 bars at 4:1: 3 3 2 | space 8 | (2) 3 3 … wait for the ending
    const doc = docFrom(makeMeter(4, 2, 4), [3, 3, [2], '|', 4, 4]);
    const m = readMidi(midiFile(doc, 'Phrase', 120));
    expect(m.head).toBe('MThd');
    expect(m.ppq).toBe(MIDI_PPQ);
    expect(m.total).toBe(22 + m.len);
    expect(m.tempi).toEqual([{ tick: 0, us: 500_000 }]);
    expect(m.end).toBe(8 * MIDI_PPQ);
    const q = MIDI_PPQ / 4;
    expect(m.notes.map((n) => n.on).sort((a, b) => a - b)).toEqual([0, 3 * q, 24 * q, 28 * q]);
    // longer groups sound lower
    const byOn = [...m.notes].sort((a, b) => a.on - b.on);
    expect(byOn[0]!.pitch).toBeGreaterThan(byOn[2]!.pitch);
  });

  it('plays repeats out and changes tempo at a modulation', () => {
    let doc = docFrom(makeMeter(4, 2, 2), [2, 2, 2, 2, '|', 4, 4]);
    doc = E.toggleRepeatEnd(doc, 8).doc; // bar 1 twice
    doc = E.addSection(doc, 4, { from: 2, to: 3, beatsPerBar: 4 }).doc;
    const m = readMidi(midiFile(doc, 'x', 60));
    expect(m.end).toBe(12 * MIDI_PPQ);
    expect(m.notes).toHaveLength(4 + 4 + 2);
    // ♩60, then 2:1 = 3:1 → ♩40 from the second bar (after the repeat: beat 8 as heard)
    expect(m.tempi).toEqual([
      { tick: 0, us: 1_000_000 },
      { tick: 8 * MIDI_PPQ, us: 1_500_000 },
    ]);
  });
});

describe('MusicXML export', () => {
  it('writes bars whose notes add up, with ties across beats and tuplets', () => {
    // 3 beats, subdivisions 4 3 5: a group of 5 crosses from beat 1 into the triplet
    const doc = docFrom(makeMeter(3, 1, [4, 3, 5]), [5, 2, [1], '|', 4]);
    const d = parse(musicXml(doc, 'A & B', 72));
    expect(d.querySelector('work-title')?.textContent).toBe('A & B');
    const ms = [...d.querySelectorAll('measure')];
    expect(ms).toHaveLength(1);
    const notes = [...ms[0]!.querySelectorAll('note')];
    expect(notes.reduce((a, n) => a + num(n, 'duration'), 0)).toBe(3 * 840);
    // 5 = a whole beat (quarter) tied to one triplet eighth
    expect(notes[0]!.querySelector('type')?.textContent).toBe('quarter');
    expect(notes[0]!.querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(notes[1]!.querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(notes[1]!.querySelector('actual-notes')?.textContent).toBe('3');
    expect(notes[1]!.querySelector('tuplet')?.getAttribute('type')).toBe('start');
    // the group of 2 fills the rest of the triplet as a quarter in it
    expect(notes[2]!.querySelector('type')?.textContent).toBe('quarter');
    expect(num(notes[2]!, 'duration')).toBe(560);
    // the silence of 1 is a rest in the quintuplet, then the group of 4
    expect(notes[3]!.querySelector('rest')).not.toBeNull();
    expect(notes[3]!.querySelector('actual-notes')?.textContent).toBe('5');
    expect(num(d.documentElement, 'time beats')).toBe(3);
    expect(d.querySelector('sound')?.getAttribute('tempo')).toBe('72');
  });

  it('keeps repeats and endings on bar lines, modulations and named marks', () => {
    let doc = docFrom(makeMeter(4, 4, 2), [4, 4, 4, 4, '|', 4, 4, 4, 4]);
    doc = E.toggleRepeatEnd(doc, 16, 3).doc;
    doc = E.setVolta(doc, 8, 16, [1, 2]).doc;
    doc = E.setVolta(doc, 16, 24, [3]).doc;
    doc = E.nameMark(doc, 0, 'Theme <A>').doc;
    doc = E.addSection(doc, 12, { from: 2, to: 3, beatsPerBar: 3 }).doc;
    const d = parse(musicXml(doc, 'Form', 90));
    const ms = [...d.querySelectorAll('measure')];
    expect(d.querySelector('rehearsal')?.textContent).toBe('Theme <A>');
    expect(d.querySelector('repeat[direction="backward"]')?.getAttribute('times')).toBe('3');
    expect(d.querySelectorAll('ending[type="start"]')).toHaveLength(2);
    // the modulated bars are in 3 and slower
    const times = ms.map((m) => m.querySelector('time beats')?.textContent ?? '');
    expect(times.filter(Boolean)).toContain('3');
    expect([...d.querySelectorAll('sound')].map((s) => s.getAttribute('tempo'))).toEqual([
      '90',
      '60',
    ]);
  });

  it('every bar adds up for any piece', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.integer({ min: 1, max: 8 }), { minLength: 21, maxLength: 21 }),
        fc.array(fc.record({ n: fc.integer({ min: 1, max: 9 }), rest: fc.boolean() }), {
          maxLength: 12,
        }),
        (beats, bars, subs, groups) => {
          const meter = makeMeter(beats, bars, subs.slice(0, beats * bars));
          let doc = E.emptyDoc(meter);
          for (const g of groups) {
            const r = E.add(doc, g.n, g.rest ? 'rest' : 'sound', 'start');
            if (r.report.ok) doc = r.doc;
          }
          const d = parse(musicXml(doc, 't', 72));
          const ms = [...d.querySelectorAll('measure')];
          expect(ms).toHaveLength(bars);
          for (const m of ms) {
            const notes = [...m.querySelectorAll('note')];
            expect(notes.reduce((a, n) => a + num(n, 'duration'), 0)).toBe(beats * 840);
            for (const n of notes) expect(n.querySelector('type')?.textContent).toBeTruthy();
          }
          // ties come in pairs: every start is followed by a stop on the next note
          const all = [...d.querySelectorAll('note')];
          all.forEach((n, i) => {
            const starts = !!n.querySelector('tie[type="start"]');
            const next = all[i + 1];
            expect(starts).toBe(!!next?.querySelector('tie[type="stop"]'));
          });
          // sounding onsets = sounding groups
          const onsets = all.filter(
            (n) => n.querySelector('pitch') && !n.querySelector('tie[type="stop"]'),
          ).length;
          expect(onsets).toBe(doc.items.filter((x) => x.kind === 'sound').length);
        },
      ),
      { numRuns: 60 },
    );
  });
});
