import {
  buildGrid,
  checkInvariants,
  group,
  spaceIndex,
  syncSpace,
  toMain,
  withBreaks,
  withMarks,
} from '../engine';
import type { Doc, Item, Meter } from '../engine';
import { hasForm, playOrder, refitForm } from '../engine';
import { SPACE_ID } from '../engine';

/**
 * The Time Sculpture file (version 2): plain, readable JSON meant to be easy to use elsewhere.
 * See docs/file-format.md. Version 1 files (and library entries) still load.
 */

/** Settings saved with a composition (not part of the undoable document). */
export interface PieceSettings {
  tempo: number;
  /** Score layout: bars per row before it wraps (line breaks are part of the document). */
  perRow?: number;
  /** Stretch short rows to the full width. */
  fitRows?: boolean;
}

/** One group of the phrase: `pulses` long; `rest: true` for silence. */
export interface FileGroup {
  pulses: number;
  rest?: true;
}

/** A sounding group in time, derived for other programs (ignored when reading). */
export interface FileSound {
  /** Onset in beats from the top of the phrase (0 = beat 1 of cycle 1). */
  at: number;
  /** Length in beats. */
  length: number;
  pulses: number;
}

export interface SavedPiece {
  format: 'time-sculpture';
  version: 2;
  title: string;
  /** Beats per minute. */
  tempo: number;
  beatsPerCycle: number;
  cycles: number;
  /** Pulses per beat, one number for every beat of the piece. */
  subdivision: number[];
  /** Phrase marks: times in beats where a phrase starts (optional). */
  phraseStarts?: number[];
  /**
   * Metric modulations (optional): from local beat `atBeat`, a pulse of `from`:1 before equals a
   * pulse of `to`:1 after, and bars have `beatsPerBar` beats.
   */
  modulations?: { atBeat: number; from: number; to: number; beatsPerBar: number }[];
  /**
   * Repeats (optional): start signs `|:` and end signs `:|` (times in beats; `times` = how often
   * the passage is played in all), and endings (brackets over [fromBeat, toBeat) played on the
   * listed passes: 1., 2. …). An end sign without a start repeats from the previous end sign or
   * from the top.
   */
  repeats?: {
    starts: number[];
    ends: { atBeat: number; times: number }[];
    endings: { fromBeat: number; toBeat: number; passes: number[] }[];
  };
  /** The phrase as written from the top; the open space comes next. */
  start: FileGroup[];
  /** The phrase as written to the end; it ends exactly on the next beat 1. */
  ending: FileGroup[];
  /** Bars per row, and manual line breaks (times in beats where a new row starts). */
  layout: { cyclesPerRow: number; breaks: number[]; fitRows?: boolean };
  sounds?: FileSound[];
  /**
   * Derived for other programs (ignored when reading): the order the piece is heard in, as
   * stretches of written time in beats, with every repeat and ending played out.
   */
  playOrder?: { fromBeat: number; toBeat: number }[];
}

const round = (x: number) => Math.round(x * 1e6) / 1e6;

export function toSaved(
  doc: Doc,
  title: string,
  settings: PieceSettings,
  opts: { sounds?: boolean } = { sounds: true },
): SavedPiece {
  const si = spaceIndex(doc.items);
  const fg = (x: Item): FileGroup =>
    x.kind === 'rest' ? { pulses: x.n, rest: true } : { pulses: x.n };
  const piece: SavedPiece = {
    format: 'time-sculpture',
    version: 2,
    title,
    tempo: settings.tempo,
    beatsPerCycle: doc.meter.beatsPerCycle,
    cycles: doc.meter.cycles,
    subdivision: [...doc.meter.subdivision],
    ...(doc.meter.marks?.length ? { phraseStarts: [...doc.meter.marks] } : {}),
    ...(doc.meter.sections?.length
      ? {
          modulations: doc.meter.sections.map((m) => ({
            atBeat: m.at,
            from: m.from,
            to: m.to,
            beatsPerBar: m.beatsPerBar,
          })),
        }
      : {}),
    ...(hasForm(doc.meter)
      ? {
          repeats: {
            starts: [...(doc.meter.repeatStarts ?? [])],
            ends: (doc.meter.repeatEnds ?? []).map((e) => ({ atBeat: e.at, times: e.times })),
            endings: (doc.meter.voltas ?? []).map((v) => ({
              fromBeat: v.a,
              toBeat: v.b,
              passes: [...v.passes],
            })),
          },
        }
      : {}),
    start: doc.items.slice(0, si).map(fg),
    ending: doc.items.slice(si + 1).map(fg),
    layout: {
      cyclesPerRow: settings.perRow ?? 1,
      breaks: [...(doc.meter.breaks ?? [])],
      ...(settings.fitRows ? { fitRows: true } : {}),
    },
  };
  if (opts.sounds) {
    const { times } = buildGrid(doc.meter);
    const sounds: FileSound[] = [];
    let k = 0;
    for (const x of doc.items) {
      if (x.kind === 'sound')
        // in beats of the main tempo, so modulated sections come out in real time
        sounds.push({
          at: round(toMain(doc.meter, times[k]!)),
          length: round(toMain(doc.meter, times[k + x.n]!) - toMain(doc.meter, times[k]!)),
          pulses: x.n,
        });
      k += x.n;
    }
    piece.sounds = sounds;
    if (hasForm(doc.meter)) {
      // contiguous stretches joined, so the list reads like the jumps a player makes
      const order: { fromBeat: number; toBeat: number }[] = [];
      for (const x of playOrder(doc.meter)) {
        const last = order[order.length - 1];
        if (last && Math.abs(last.toBeat - round(x.a)) < 1e-6) last.toBeat = round(x.b);
        else order.push({ fromBeat: round(x.a), toBeat: round(x.b) });
      }
      piece.playOrder = order;
    }
  }
  return piece;
}

interface Parsed {
  doc: Doc;
  name: string;
  settings: PieceSettings;
}

/** Parse and validate a file (v2, or the older v1). Throws with a readable message. */
export function fromSaved(raw: unknown): Parsed {
  const p = raw as Record<string, unknown> | null;
  if (!p || p.format !== 'time-sculpture') throw new Error('Not a Time Sculpture file');
  if (p.version === 1) return fromV1(p);
  if (p.version !== 2) throw new Error('This file is from a newer version of Time Sculpture');
  const meter = {
    beatsPerCycle: Number(p.beatsPerCycle),
    cycles: Number(p.cycles),
    subdivision: Array.isArray(p.subdivision) ? p.subdivision.map(Number) : [],
    ...(Array.isArray(p.phraseStarts)
      ? { marks: p.phraseStarts.map(Number).filter(Number.isFinite) }
      : {}),
    ...(Array.isArray(p.modulations) && p.modulations.length
      ? {
          sections: (p.modulations as Record<string, unknown>[]).map((m) => ({
            at: Number(m.atBeat),
            from: Number(m.from),
            to: Number(m.to),
            beatsPerBar: Number(m.beatsPerBar),
          })),
        }
      : {}),
    ...readRepeats(p.repeats),
  };
  let next = 1;
  const toItem = (g: unknown): Item => {
    const x = g as Partial<FileGroup> | null;
    return group(`g${next++}`, Number(x?.pulses), x?.rest ? 'rest' : 'sound');
  };
  const start = Array.isArray(p.start) ? p.start.map(toItem) : [];
  const ending = Array.isArray(p.ending) ? p.ending.map(toItem) : [];
  const items: Item[] = [...start, { id: SPACE_ID, kind: 'space', n: 0 }, ...ending];
  const layout = (p.layout ?? {}) as {
    cyclesPerRow?: unknown;
    rows?: unknown;
    breaks?: unknown;
    fitRows?: unknown;
  };
  return finish(
    meter,
    items,
    next,
    String(p.title ?? 'Untitled'),
    p.tempo,
    layout.cyclesPerRow,
    layout.rows,
    layout.breaks,
    layout.fitRows,
  );
}

function fromV1(p: Record<string, unknown>): Parsed {
  const meter = {
    beatsPerCycle: Number(p.beats),
    cycles: Number(p.cycles),
    subdivision: Array.isArray(p.subdivision) ? p.subdivision.map(Number) : [],
  };
  let next = 1;
  const items: Item[] = (Array.isArray(p.items) ? (p.items as string[]) : []).map((s) => {
    if (s === '|') return { id: SPACE_ID, kind: 'space', n: 0 };
    const rest = s.startsWith('r');
    return group(`g${next++}`, Number(rest ? s.slice(1) : s), rest ? 'rest' : 'sound');
  });
  return finish(
    meter,
    items,
    next,
    String(p.name ?? 'Untitled'),
    p.tempo,
    p.perRow,
    p.rows,
    undefined,
    undefined,
  );
}

/** Old layouts saved as bars per row become line breaks at those bar lines. */
function rowsToBreaks(rows: readonly number[], beatsPerCycle: number, cycles: number): number[] {
  const out: number[] = [];
  let c = 0;
  for (const n of rows) {
    c += n;
    if (c >= cycles) break;
    out.push(c * beatsPerCycle);
  }
  return out;
}

function finish(
  meter: Doc['meter'],
  items: Item[],
  nextId: number,
  name: string,
  tempo0: unknown,
  perRow0: unknown,
  rows0: unknown,
  breaks0: unknown,
  fit0: unknown,
): Parsed {
  if (!Number.isInteger(meter.beatsPerCycle) || !Number.isInteger(meter.cycles))
    throw new Error('This file is damaged: the meter is missing');
  const breaks = Array.isArray(breaks0)
    ? breaks0.map(Number).filter(Number.isFinite)
    : Array.isArray(rows0)
      ? rowsToBreaks(
          rows0.map(Number).filter((n) => Number.isInteger(n) && n >= 1),
          meter.beatsPerCycle,
          meter.cycles,
        )
      : [];
  const withB = breaks.length ? withBreaks(meter, breaks) : meter;
  const m0 = meter.marks ? withMarks(withB, meter.marks) : withB;
  const m = refitForm(m0); // also drops empty repeat fields
  const doc: Doc = { meter: m, items: syncSpace(items, buildGrid(m).TS), nextId };
  const errs = checkInvariants(doc);
  if (errs.length) throw new Error(`This file is damaged: ${errs[0]}`);
  const tempo = Number.isFinite(tempo0) ? Math.min(160, Math.max(40, Number(tempo0))) : 72;
  const perRow = Number.isInteger(perRow0) ? Math.min(8, Math.max(1, Number(perRow0))) : 1;
  return { doc, name, settings: { tempo, perRow, ...(fit0 === true ? { fitRows: true } : {}) } };
}

/** The file's repeats as meter fields (lenient: odd values are cleaned up by refitForm). */
function readRepeats(raw: unknown): Partial<Meter> {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== 'object') return {};
  const list = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
  const num = (x: unknown) => Number(x);
  return {
    repeatStarts: (Array.isArray(r.starts) ? r.starts : []).map(num).filter(Number.isFinite),
    repeatEnds: list(r.ends)
      .map((e) => ({ at: num(e.atBeat), times: num(e.times) }))
      .filter((e) => Number.isFinite(e.at)),
    voltas: list(r.endings)
      .map((v) => ({
        a: num(v.fromBeat),
        b: num(v.toBeat),
        passes: (Array.isArray(v.passes) ? v.passes : []).map(num),
      }))
      .filter((v) => Number.isFinite(v.a) && Number.isFinite(v.b)),
  };
}

/* ------------------------------------------------------------------ share links */

const b64url = {
  encode(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str: string): Uint8Array {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encode a piece for the URL hash: "z" + deflate + base64url, or "j" + base64url JSON if compression is unavailable. */
export async function encodeShare(piece: SavedPiece): Promise<string> {
  // the derived sounds are left out to keep links short
  const lean: SavedPiece = { ...piece };
  delete lean.sounds;
  const json = new TextEncoder().encode(JSON.stringify(lean));
  if (typeof CompressionStream !== 'undefined')
    return `z${b64url.encode(await pipe(json, new CompressionStream('deflate-raw')))}`;
  return `j${b64url.encode(json)}`;
}

export async function decodeShare(code: string): Promise<SavedPiece> {
  const body = b64url.decode(code.slice(1));
  const bytes = code[0] === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return JSON.parse(new TextDecoder().decode(bytes)) as SavedPiece;
}
