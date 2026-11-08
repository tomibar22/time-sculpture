import { buildGrid, checkInvariants, group, syncSpace } from '../engine';
import type { Doc, Item } from '../engine';
import { SPACE_ID } from '../engine';

/** Settings saved with a composition (not part of the undoable document). */
export interface PieceSettings {
  tray: number[];
  tempo: number;
  /** Score layout: cycles per row, and custom per-row counts. */
  perRow?: number;
  rows?: number[];
}

/** File format v1. Items are written compactly: "3" sound, "r3" rest, "|" space. */
export interface SavedPiece {
  format: 'time-sculpture';
  version: 1;
  name: string;
  beats: number;
  cycles: number;
  subdivision: number[];
  items: string[];
  tray: number[];
  tempo: number;
  perRow?: number;
  rows?: number[];
}

export function toSaved(doc: Doc, name: string, settings: PieceSettings): SavedPiece {
  return {
    format: 'time-sculpture',
    version: 1,
    name,
    beats: doc.meter.beatsPerCycle,
    cycles: doc.meter.cycles,
    subdivision: [...doc.meter.subdivision],
    items: doc.items.map((x) =>
      x.kind === 'space' ? '|' : x.kind === 'rest' ? `r${x.n}` : `${x.n}`,
    ),
    tray: [...settings.tray],
    tempo: settings.tempo,
    perRow: settings.perRow ?? 1,
    rows: [...(settings.rows ?? [])],
  };
}

/** Parse and validate. Throws with a readable message on bad input. */
export function fromSaved(raw: unknown): { doc: Doc; name: string; settings: PieceSettings } {
  const p = raw as Partial<SavedPiece>;
  if (!p || p.format !== 'time-sculpture' || p.version !== 1)
    throw new Error('Not a Time Sculpture file');
  const meter = {
    beatsPerCycle: Number(p.beats),
    cycles: Number(p.cycles),
    subdivision: (p.subdivision ?? []).map(Number),
  };
  let next = 1;
  const items: Item[] = (p.items ?? []).map((s) => {
    if (s === '|') return { id: SPACE_ID, kind: 'space', n: 0 };
    const rest = s.startsWith('r');
    return group(`g${next++}`, Number(rest ? s.slice(1) : s), rest ? 'rest' : 'sound');
  });
  const doc: Doc = { meter, items: syncSpace(items, buildGrid(meter).TS), nextId: next };
  const errs = checkInvariants(doc);
  if (errs.length) throw new Error(`This file is damaged: ${errs[0]}`);
  const tray =
    Array.isArray(p.tray) && p.tray.length
      ? p.tray.map(Number).filter((n) => n >= 1 && n <= 12)
      : [2, 3, 4, 5, 7];
  const tempo = Number.isFinite(p.tempo) ? Math.min(160, Math.max(40, Number(p.tempo))) : 72;
  const perRow = Number.isInteger(p.perRow) ? Math.min(8, Math.max(1, Number(p.perRow))) : 1;
  const rows = Array.isArray(p.rows)
    ? p.rows.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 8)
    : [];
  return { doc, name: String(p.name ?? 'Untitled'), settings: { tray, tempo, perRow, rows } };
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
  const json = new TextEncoder().encode(JSON.stringify(piece));
  if (typeof CompressionStream !== 'undefined')
    return `z${b64url.encode(await pipe(json, new CompressionStream('deflate-raw')))}`;
  return `j${b64url.encode(json)}`;
}

export async function decodeShare(code: string): Promise<SavedPiece> {
  const body = b64url.decode(code.slice(1));
  const bytes = code[0] === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return JSON.parse(new TextDecoder().decode(bytes)) as SavedPiece;
}
