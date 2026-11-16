import { libraryIndex, loadPiece, savePiece, setChangeListener } from './library';
import { reloadOpen, removePiece, saveNow } from './session';
import { fromSaved } from './serialize';
import type { SavedPiece } from './serialize';
import { toast } from '../state/actions';
import { MAX_MOTIFS, useUiStore } from '../state/store';

/**
 * The library kept the same on every device (iPhone, iPad, computer) through `/api/sync`
 * (api/sync.ts, Neon Postgres). Each device keeps working from its own IndexedDB library, offline
 * too; this module sends what changed here and takes in what changed elsewhere.
 *
 * - Every save or delete here goes into an outbox (localStorage), sent soon after, and kept until
 *   the server has it, so nothing is lost offline or when the app is closed.
 * - The newest edit of a piece wins (by its `updated` time), on the server and here.
 * - A device asks only for what changed since it last looked (`rev`).
 * - It syncs when the app opens or comes back on screen, comes back online, after a save, and
 *   every minute while it is on screen.
 */

const KEY = 'time-sculpture/sync';
const OUT = 'time-sculpture/sync-out';
const API = '/api/sync';
/** Look back a little: a write numbered before another can be committed after it. */
const OVERLAP = 50;
const EVERY = 60_000;

export type SyncState =
  | { on: false }
  | { on: true; status: 'idle' | 'syncing' | 'offline' | 'error'; at?: number; error?: string };

interface Saved {
  code: string;
  rev: number;
  at?: number;
}

/** Waiting to be sent: id → its date and whether it was deleted. */
type Outbox = Record<string, { updated: number; deleted: boolean }>;

interface Row {
  id: string;
  name: string;
  updated: number;
  deleted: boolean;
  piece: SavedPiece | null;
  rev: number;
}

const read = <T>(k: string): T | undefined => {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : undefined;
  } catch {
    return undefined;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage full or blocked: the next sync tries again
  }
};

let state: SyncState = read<Saved>(KEY) ? { on: true, status: 'idle' } : { on: false };
const listeners = new Set<(s: SyncState) => void>();
function setState(s: SyncState) {
  state = s;
  listeners.forEach((fn) => fn(s));
}
export const syncState = () => state;
export function onSyncState(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pieces that came in from another device: the library list redraws. */
export const SYNCED = 'time-sculpture:synced';

class SyncError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function call<T>(code: string, init: RequestInit & { query?: string } = {}): Promise<T> {
  const res = await fetch(API + (init.query ?? ''), {
    ...init,
    headers: {
      authorization: `Bearer ${code}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    cache: 'no-store',
    // leaving the app: let the request finish after the page is put away
    keepalive:
      document.visibilityState === 'hidden' && (init.body?.toString().length ?? 0) < 60_000,
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new SyncError(body.error ?? 'server', res.status);
  return body;
}

const outbox = () => read<Outbox>(OUT) ?? {};

/* ------------------------------------------------------------------ hearts (kept fills) */
/**
 * Every fill kept with the heart is one row on the server (id "m-3_3_2", the piece is {sizes}),
 * so adding on one device and removing on another never undo each other, and a removal travels
 * as a tombstone like a deleted composition. `MOTIF_META` remembers when each was last changed
 * here (kept or let go), for the same "newest change wins" rule.
 */
const MOTIF_META = 'time-sculpture/sync-motifs';
const motifId = (sizes: readonly number[]) => `m-${sizes.join('_')}`;
const motifSizes = (id: string) => id.slice(2).split('_').map(Number);
const isMotifId = (id: string) => id.startsWith('m-');
type MotifMeta = Record<string, { updated: number; deleted: boolean }>;

/** A fill was kept or let go on this device: send it. */
export function noteMotif(sizes: readonly number[], deleted: boolean): void {
  const id = motifId(sizes);
  const updated = Date.now();
  write(MOTIF_META, { ...(read<MotifMeta>(MOTIF_META) ?? {}), [id]: { updated, deleted } });
  queue(id, updated, deleted);
}

/** One heart from the server, if its change is newer than ours. */
function takeMotif(row: Row): boolean {
  const meta = read<MotifMeta>(MOTIF_META) ?? {};
  if ((outbox()[row.id]?.updated ?? 0) >= row.updated) return false;
  if ((meta[row.id]?.updated ?? 0) >= row.updated) return false;
  const sizes = motifSizes(row.id);
  if (!sizes.length || sizes.some((n) => !Number.isInteger(n) || n < 1 || n > 64)) return false;
  const k = sizes.join(' ');
  const ui = useUiStore.getState();
  const has = ui.motifs.some((m) => m.join(' ') === k);
  write(MOTIF_META, { ...meta, [row.id]: { updated: row.updated, deleted: row.deleted } });
  if (row.deleted && has) ui.set({ motifs: ui.motifs.filter((m) => m.join(' ') !== k) });
  else if (!row.deleted && !has) ui.set({ motifs: [sizes, ...ui.motifs].slice(0, MAX_MOTIFS) });
  else return false;
  return true;
}

function queue(id: string, updated: number, deleted: boolean) {
  if (!read<Saved>(KEY)) return;
  write(OUT, { ...outbox(), [id]: { updated, deleted } });
  later(1500);
}

/* ------------------------------------------------------------------ one round */

let running: Promise<void> | undefined;
let again = false;

/** Send, then take in. One round at a time; asked again meanwhile, it runs once more after. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = round()
    .catch(() => undefined)
    .finally(() => {
      running = undefined;
      if (again) {
        again = false;
        void syncNow();
      }
    });
  return running;
}

async function round(): Promise<void> {
  const saved = read<Saved>(KEY);
  if (!saved) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState({ on: true, status: 'offline', at: saved.at });
    return;
  }
  setState({ on: true, status: 'syncing', at: saved.at });
  try {
    await saveNow(); // an edit still waiting is part of what is sent
    await push(saved.code);
    const rev = await pull(saved.code, saved.rev);
    const at = Date.now();
    if (read<Saved>(KEY)) write(KEY, { ...saved, rev, at });
    setState({ on: true, status: 'idle', at });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'network';
    setState({
      on: true,
      status: code === 'network' ? 'offline' : 'error',
      at: saved.at,
      error: code,
    });
    throw e;
  }
}

async function push(code: string): Promise<void> {
  const out = outbox();
  const ids = Object.keys(out);
  for (let i = 0; i < ids.length; i += 50) {
    const pieces = [];
    for (const id of ids.slice(i, i + 50)) {
      const o = out[id]!;
      if (isMotifId(id)) {
        const sizes = motifSizes(id);
        pieces.push({
          id,
          name: sizes.join(' '),
          updated: o.updated,
          deleted: o.deleted,
          piece: o.deleted ? null : { sizes },
        });
        continue;
      }
      const piece = o.deleted ? null : await loadPiece(id);
      if (!o.deleted && !piece) continue; // gone since: its delete is queued too
      pieces.push({ id, name: piece?.title ?? '', updated: o.updated, deleted: o.deleted, piece });
    }
    await call(code, { method: 'POST', body: JSON.stringify({ pieces }) });
    // sent: forget them, unless they changed again while on the way
    const now = outbox();
    for (const id of ids.slice(i, i + 50))
      if (now[id]?.updated === out[id]!.updated && now[id]?.deleted === out[id]!.deleted)
        delete now[id];
    write(OUT, now);
  }
}

async function pull(code: string, rev: number): Promise<number> {
  let since = Math.max(0, rev - OVERLAP);
  let top = rev;
  let changed = false;
  for (;;) {
    const page = await call<{ rows: Row[]; rev: number; more: boolean }>(code, {
      query: `?since=${since}`,
    });
    const have = new Map((await libraryIndex()).map((e) => [e.id, e.updated]));
    for (const row of page.rows) if (await take(row, have.get(row.id))) changed = true;
    top = Math.max(top, page.rev);
    if (!page.more) break;
    since = page.rev;
  }
  if (changed) window.dispatchEvent(new Event(SYNCED));
  return top;
}

/** One piece from the server, if it is newer than the one here. Returns whether it changed. */
async function take(row: Row, here: number | undefined): Promise<boolean> {
  if (isMotifId(row.id)) return takeMotif(row);
  const waiting = outbox()[row.id];
  if (waiting && waiting.updated >= row.updated) return false; // ours is newer: it goes up next
  if (row.deleted) {
    if (here === undefined || here > row.updated) return false;
    await removePiece(row.id, { remote: true });
    return true;
  }
  if (here !== undefined && here >= row.updated) return false;
  if (!row.piece) return false;
  try {
    fromSaved(row.piece); // only pieces that read cleanly
  } catch {
    return false;
  }
  await savePiece(row.id, row.piece, { current: false, updated: row.updated, remote: true });
  if (reloadOpen(row.id, row.piece)) toast('Updated from another device');
  return true;
}

/* ------------------------------------------------------------------ turning it on and off */

/** Join this device with a sync code. Everything in this library goes up; the rest comes down. */
export async function connect(code: string): Promise<'ok' | 'bad-code' | 'not-set-up' | 'offline'> {
  const c = code.trim();
  try {
    await call(c, { query: `?since=${Number.MAX_SAFE_INTEGER}` });
  } catch (e) {
    if (e instanceof SyncError) return e.code === 'not-set-up' ? 'not-set-up' : 'bad-code';
    return 'offline';
  }
  write(KEY, { code: c, rev: 0 } satisfies Saved);
  const out: Outbox = {};
  for (const e of await libraryIndex()) out[e.id] = { updated: e.updated, deleted: false };
  // the hearts already kept here go up too
  const now = Date.now();
  const meta = read<MotifMeta>(MOTIF_META) ?? {};
  for (const m of useUiStore.getState().motifs) {
    const id = motifId(m);
    out[id] = { updated: now, deleted: false };
    meta[id] = { updated: now, deleted: false };
  }
  write(MOTIF_META, meta);
  write(OUT, { ...outbox(), ...out });
  setState({ on: true, status: 'idle' });
  await syncNow();
  return 'ok';
}

/** This device stops syncing. Its library stays as it is. */
export function disconnect(): void {
  write(KEY, undefined);
  write(OUT, undefined);
  setState({ on: false });
}

/* ------------------------------------------------------------------ when */

let timer: number | undefined;
function later(ms: number) {
  clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), ms);
}

let started = false;
export function startSync(): void {
  if (started) return;
  started = true;
  setChangeListener((c) => queue(c.id, c.updated, c.deleted));
  // coming back: take in what the other devices did; leaving: send what was done here at once
  // (going from the iPhone to the iPad, the edit should already be there)
  document.addEventListener('visibilitychange', () => void syncNow());
  window.addEventListener('online', () => void syncNow());
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, EVERY);
  void syncNow();
}
