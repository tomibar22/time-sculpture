import { createStore, del, get, set } from 'idb-keyval';
import type { SavedPiece } from './serialize';

export interface LibraryEntry {
  id: string;
  name: string;
  updated: number;
  /** A small picture of the piece for the list: group sizes in order (see `stripOf`). */
  strip?: number[];
  /** "4 × 2 · ♩72". */
  meta?: string;
}

/** The most groups a list picture shows. */
const STRIP_MAX = 40;

/**
 * A piece as a row of numbers for its picture in the library: sounds as their size, silences
 * negative, the open space as 0.5 + its size (so it is never mistaken for a group).
 */
export function stripOf(piece: SavedPiece): { strip: number[]; meta: string } {
  const v2 = piece as Partial<SavedPiece>;
  const side = (gs: SavedPiece['start'] | undefined) =>
    (gs ?? []).map((g) => (g.rest ? -g.pulses : g.pulses));
  const start = side(v2.start);
  const ending = side(v2.ending);
  const TS = (v2.subdivision ?? []).reduce((a, b) => a + b, 0);
  const open = TS - [...start, ...ending].reduce((a, n) => a + Math.abs(n), 0);
  const strip = [...start, ...(open > 0 ? [open + 0.5] : []), ...ending].slice(0, STRIP_MAX);
  const meta = v2.beatsPerCycle
    ? `${v2.modulations?.length ? `${v2.cycles} bars` : `${v2.beatsPerCycle} × ${v2.cycles}`} · ♩${v2.tempo}`
    : '';
  return { strip, meta };
}

const store =
  typeof indexedDB !== 'undefined' ? createStore('time-sculpture', 'library') : undefined;
const INDEX = 'index';
const CURRENT = 'current';

/**
 * Every change to the library waits for the one before it. The list is read, changed and written
 * back, so two changes running at once (an autosave during a delete, a rename while another piece
 * opens) could otherwise undo each other: a deleted piece back in the list, the wrong piece open
 * after a reload.
 */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => undefined);
  return p;
}

export const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const listPieces = (): Promise<LibraryEntry[]> => serial(listNow);
async function listNow(): Promise<LibraryEntry[]> {
  const idx = (await get<LibraryEntry[]>(INDEX, store)) ?? [];
  // pieces saved before the list had pictures get theirs now
  let changed = false;
  for (const e of idx) {
    if (e.strip) continue;
    const piece = await get<SavedPiece>(`piece:${e.id}`, store);
    Object.assign(e, piece ? stripOf(piece) : { strip: [] });
    changed = true;
  }
  if (changed) await set(INDEX, idx, store);
  return [...idx].sort((a, b) => b.updated - a.updated);
}

export const loadPiece = (id: string): Promise<SavedPiece | undefined> =>
  serial(() => get<SavedPiece>(`piece:${id}`, store));

/**
 * Save a piece. `touch: false` keeps its place in the list (its date) when nothing was edited,
 * e.g. the save made before the library opens. `current: false` leaves the open piece as it is.
 */
export const savePiece = (
  id: string,
  piece: SavedPiece,
  opts: { touch?: boolean; current?: boolean; updated?: number } = {},
): Promise<void> => serial(() => saveNow(id, piece, opts));
async function saveNow(
  id: string,
  piece: SavedPiece,
  opts: { touch?: boolean; current?: boolean; updated?: number },
): Promise<void> {
  await set(`piece:${id}`, piece, store);
  const all = (await get<LibraryEntry[]>(INDEX, store)) ?? [];
  const old = all.find((e) => e.id === id);
  const idx = all.filter((e) => e.id !== id);
  const updated = opts.updated ?? (opts.touch === false && old ? old.updated : Date.now());
  idx.push({ id, name: piece.title, updated, ...stripOf(piece) });
  await set(INDEX, idx, store);
  if (opts.current !== false) await set(CURRENT, id, store);
}

export const deletePiece = (id: string): Promise<void> =>
  serial(async () => {
    await del(`piece:${id}`, store);
    const idx = ((await get<LibraryEntry[]>(INDEX, store)) ?? []).filter((e) => e.id !== id);
    await set(INDEX, idx, store);
  });

export const currentPieceId = (): Promise<string | undefined> =>
  serial(() => get<string>(CURRENT, store));

export const setCurrentPieceId = (id: string): Promise<void> =>
  serial(() => set(CURRENT, id, store));
