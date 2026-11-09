import { barMap, buildGrid, EPS, isSpace, repeatsOf, voltaRepeat } from '../engine';
import type { Doc } from '../engine';

/**
 * The piece as MusicXML, as it is written: one staff with the rhythm on a single pitch, ready to
 * be given notes in a notation program (Dorico, Sibelius, MuseScore…). A beat is a quarter note;
 * beats with 3, 5, 6 or 7 pulses are tuplets; a group that crosses a beat is tied; silences and
 * the open space are rests. Bars, metric modulations (a new tempo and time signature), repeat
 * signs and endings that sit on bar lines, and named phrase marks (as rehearsal marks) are kept.
 */

/** Divisions per quarter note: divisible by every subdivision 1–8. */
const DIV = 840;

/** How a beat of d pulses is written: its pulse's note type, and its tuplet (actual in normal). */
const UNIT: Record<number, { type: number; tuplet?: [number, number] }> = {
  // type as a power of two under a quarter: 0 = quarter, 1 = eighth, 2 = 16th, 3 = 32nd
  1: { type: 0 },
  2: { type: 1 },
  3: { type: 1, tuplet: [3, 2] },
  4: { type: 2 },
  5: { type: 2, tuplet: [5, 4] },
  6: { type: 2, tuplet: [6, 4] },
  7: { type: 2, tuplet: [7, 4] },
  8: { type: 3 },
};
const TYPES = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd'];
/** Note values in pulses that have a plain or dotted shape. */
const SHAPES: [number, number, boolean][] = [
  // pulses, steps longer than the unit, dotted
  [8, 3, false],
  [6, 2, true],
  [4, 2, false],
  [3, 1, true],
  [2, 1, false],
  [1, 0, false],
];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Piece {
  /** Pulses in this beat, and the beat's subdivision. */
  j: number;
  d: number;
  sound: boolean;
  /** Tied from the note before / to the note after (the same sounding group). */
  tieIn: boolean;
  tieOut: boolean;
}

export function musicXml(doc: Doc, title: string, tempo: number): string {
  const grid = buildGrid(doc.meter);
  const bm = barMap(doc.meter);
  const sd = doc.meter.subdivision;

  // what every pulse belongs to: the index of its item, and whether that item sounds
  const owner: number[] = [];
  doc.items.forEach((x, i) => {
    for (let n = 0; n < x.n; n++) owner.push(i);
  });
  const sounds = (i: number) => {
    const x = doc.items[i];
    return !!x && !isSpace(x) && x.kind === 'sound';
  };

  /** The notes and rests of one beat. */
  const beatPieces = (b: number): Piece[] => {
    const d = sd[b]!;
    const k0 = grid.pre[b]!;
    const out: Piece[] = [];
    let j0 = 0;
    while (j0 < d) {
      const it = owner[k0 + j0]!;
      const snd = sounds(it);
      let j1 = j0 + 1;
      // a sound runs to the end of its group; rests of any kind run together
      while (j1 < d && (snd ? owner[k0 + j1] === it : !sounds(owner[k0 + j1]!))) j1++;
      const first = snd && owner[k0 + j0 - 1] !== it;
      const last = snd && owner[k0 + j1] !== it;
      // cut the run into writable values (5 pulses = 4 tied to 1)
      let left = j1 - j0;
      const whole = left === d;
      const parts: number[] = [];
      if (whole) parts.push(d);
      else
        while (left > 0) {
          const v = SHAPES.find(([p]) => p <= left)![0];
          parts.push(v);
          left -= v;
        }
      parts.forEach((p, pi) =>
        out.push({
          j: p,
          d,
          sound: snd,
          tieIn: snd && (pi > 0 || !first),
          tieOut: snd && (pi < parts.length - 1 || !last),
        }),
      );
      j0 = j1;
    }
    return out;
  };

  const note = (p: Piece, tuplet: 'start' | 'stop' | 'both' | null): string => {
    const u = UNIT[p.d]!;
    const whole = p.j === p.d;
    let type: string;
    let dot = false;
    if (whole) type = 'quarter';
    else {
      const shape = SHAPES.find(([n]) => n === p.j)!;
      type = TYPES[2 + u.type - shape[1]]!;
      dot = shape[2];
    }
    const tm = !whole && u.tuplet;
    const notations: string[] = [];
    if (p.tieIn) notations.push('<tied type="stop"/>');
    if (p.tieOut) notations.push('<tied type="start"/>');
    if (tuplet === 'start' || tuplet === 'both') notations.push('<tuplet type="start"/>');
    if (tuplet === 'stop' || tuplet === 'both') notations.push('<tuplet type="stop"/>');
    return [
      '      <note>',
      p.sound ? '        <pitch><step>B</step><octave>4</octave></pitch>' : '        <rest/>',
      `        <duration>${(DIV / p.d) * p.j}</duration>`,
      p.tieIn ? '        <tie type="stop"/>' : '',
      p.tieOut ? '        <tie type="start"/>' : '',
      '        <voice>1</voice>',
      `        <type>${type}</type>`,
      dot ? '        <dot/>' : '',
      tm
        ? `        <time-modification><actual-notes>${tm[0]}</actual-notes><normal-notes>${tm[1]}</normal-notes></time-modification>`
        : '',
      p.sound ? '        <stem>up</stem>' : '',
      notations.length ? `        <notations>${notations.join('')}</notations>` : '',
      '      </note>',
    ]
      .filter(Boolean)
      .join('\n');
  };

  // repeat signs and endings that sit on bar lines
  const barAt = new Map(bm.barStarts.map((t, i) => [t, i]));
  const isBarLine = (t: number) =>
    Math.abs(t - Math.round(t)) < EPS && (barAt.has(Math.round(t)) || Math.round(t) === bm.NB);
  const starts = new Set((doc.meter.repeatStarts ?? []).filter(isBarLine).map(Math.round));
  // a repeat that goes back to the top needs no start sign; one that goes back to an earlier end
  // sign does
  for (const r of repeatsOf(doc.meter))
    if (r.s > EPS && isBarLine(r.s) && isBarLine(r.e)) starts.add(Math.round(r.s));
  const ends = new Map(
    (doc.meter.repeatEnds ?? []).filter((e) => isBarLine(e.at)).map((e) => [Math.round(e.at), e]),
  );
  const voltas = (doc.meter.voltas ?? []).filter((v) => isBarLine(v.a) && isBarLine(v.b));
  const names = doc.meter.markNames ?? [];
  const marks = (doc.meter.marks ?? []).map((t, i) => ({ t, name: names[i] ?? '' }));

  const measures: string[] = [];
  let barSize = -1;
  bm.barStarts.forEach((b0, bar) => {
    const b1 = bm.barStarts[bar + 1] ?? bm.NB;
    const si = bm.sectionOf[b0]!;
    const sec = bm.sections[si]!;
    const lines: string[] = [`    <measure number="${bar + 1}">`];
    // left barline: a start repeat, the start of an ending
    const vStart = voltas.find((v) => Math.round(v.a) === b0);
    if (starts.has(b0) || vStart) {
      lines.push('      <barline location="left">');
      if (starts.has(b0)) lines.push('        <bar-style>heavy-light</bar-style>');
      if (vStart)
        lines.push(
          `        <ending number="${vStart.passes.join(',')}" type="start">${vStart.passes.map((p) => `${p}.`).join(' ')}</ending>`,
        );
      if (starts.has(b0)) lines.push('        <repeat direction="forward"/>');
      lines.push('      </barline>');
    }
    if (bar === 0 || b1 - b0 !== barSize) {
      barSize = b1 - b0;
      lines.push('      <attributes>');
      if (bar === 0) lines.push(`        <divisions>${DIV}</divisions>`);
      lines.push(
        `        <time><beats>${barSize}</beats><beat-type>4</beat-type></time>`,
        bar === 0 ? '        <clef><sign>G</sign><line>2</line></clef>' : '',
        '      </attributes>',
      );
    }
    if (b0 === sec.at) {
      const bpm = Math.round((tempo / sec.scale) * 100) / 100;
      const eq = si > 0 ? `<words>${sec.from}:1 = ${sec.to}:1</words>` : '';
      lines.push(
        '      <direction placement="above">',
        eq ? `        <direction-type>${eq}</direction-type>` : '',
        `        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type>`,
        `        <sound tempo="${bpm}"/>`,
        '      </direction>',
      );
    }
    for (let b = b0; b < b1; b++) {
      // named phrase marks that start in this beat become rehearsal marks
      for (const m of marks)
        if (m.name && m.t >= b - EPS && m.t < b + 1 - EPS)
          lines.push(
            `      <direction placement="above"><direction-type><rehearsal>${esc(m.name)}</rehearsal></direction-type></direction>`,
          );
      const ps = beatPieces(b);
      const tup = !!UNIT[sd[b]!]!.tuplet && ps.length > 1;
      ps.forEach((p, i) =>
        lines.push(note(p, !tup ? null : i === 0 ? 'start' : i === ps.length - 1 ? 'stop' : null)),
      );
    }
    // right barline: an end repeat, the end of an ending, the final bar
    const end = ends.get(b1);
    const vEnd = voltas.find((v) => Math.round(v.b) === b1);
    const final = bar === bm.barStarts.length - 1;
    if (end || vEnd || final) {
      lines.push('      <barline location="right">');
      if (end || final) lines.push('        <bar-style>light-heavy</bar-style>');
      if (vEnd) {
        // an ending inside its repeat closes with a hook; the last one is left open
        const closes = voltaRepeat(doc.meter, vEnd).inside;
        lines.push(
          `        <ending number="${vEnd.passes.join(',')}" type="${closes ? 'stop' : 'discontinue'}"/>`,
        );
      }
      if (end)
        lines.push(
          `        <repeat direction="backward"${end.times > 2 ? ` times="${end.times}"` : ''}/>`,
        );
      lines.push('      </barline>');
    }
    lines.push('    </measure>');
    measures.push(lines.filter(Boolean).join('\n'));
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${esc(title || 'Untitled')}</work-title></work>
  <identification><encoding><software>Time Sculpture</software></encoding></identification>
  <part-list>
    <score-part id="P1"><part-name>Rhythm</part-name></score-part>
  </part-list>
  <part id="P1">
${measures.join('\n')}
  </part>
</score-partwise>
`;
}
