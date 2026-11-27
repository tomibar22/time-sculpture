import { byName } from './facts';

/**
 * Folders for the library: a tree of named folders, and for each piece the folder it is in.
 * Pure: storing it is folders.ts, sending it to the other devices sync.ts.
 *
 * Both are kept as "newest change wins" records, like the pieces, so a folder renamed on the
 * iPad and a piece moved on the iPhone never undo each other. A deleted folder stays as a
 * tombstone. Anything whose folder is gone (deleted, or never arrived) is simply at the top, and
 * a loop made by two devices moving folders into each other at once is cut at the top too, so
 * the tree always reads.
 */
export interface Folder {
  name: string;
  parent: string | null;
  updated: number;
  deleted?: boolean;
}
export interface Place {
  folder: string | null;
  updated: number;
}
export interface Shelf {
  folders: Record<string, Folder>;
  places: Record<string, Place>;
}

export const emptyShelf = (): Shelf => ({ folders: {}, places: {} });

export const MAX_FOLDER_NAME = 60;
/** How deep folders may go. */
export const MAX_DEPTH = 8;

export const isLive = (s: Shelf, id: string | null | undefined): id is string =>
  !!id && !!s.folders[id] && !s.folders[id].deleted;

/** The folder a folder is in, as it can be read: null for the top (or a loop cut there). */
export function parentOf(s: Shelf, id: string): string | null {
  const seen = new Set<string>([id]);
  const p = s.folders[id]?.parent ?? null;
  // walk up: a loop or a missing folder puts this one at the top
  let q = p;
  while (q) {
    if (seen.has(q) || !isLive(s, q)) return null;
    seen.add(q);
    q = s.folders[q]!.parent;
  }
  return p;
}

/** The folder a piece is in (null = the top). */
export function folderOf(s: Shelf, pieceId: string): string | null {
  const f = s.places[pieceId]?.folder ?? null;
  return isLive(s, f) && pathOf(s, f).length ? f : null;
}

/** The folders from the top down to this one (this one last); [] for the top. */
export function pathOf(s: Shelf, id: string | null): string[] {
  const path: string[] = [];
  let q: string | null = isLive(s, id) ? id : null;
  while (q) {
    path.unshift(q);
    q = parentOf(s, q);
  }
  return path;
}

/** The folders right inside one (null = the top), by name. */
export function childrenOf(s: Shelf, id: string | null): string[] {
  return Object.keys(s.folders)
    .filter((f) => isLive(s, f) && parentOf(s, f) === id)
    .sort((a, b) => byName(s.folders[a]!.name, s.folders[b]!.name));
}

/** Every folder inside one, at any depth (not itself). */
export function descendantsOf(s: Shelf, id: string | null): string[] {
  const out: string[] = [];
  const walk = (f: string | null) => {
    for (const c of childrenOf(s, f)) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

/** Can a folder go into another (null = the top)? Not into itself or anything inside it. */
export function canMoveFolder(s: Shelf, id: string, into: string | null): boolean {
  if (into === null) return true;
  if (!isLive(s, into) || into === id) return false;
  if (descendantsOf(s, id).includes(into)) return false;
  const depth = pathOf(s, into).length + 1 + depthBelow(s, id);
  return depth <= MAX_DEPTH;
}
function depthBelow(s: Shelf, id: string): number {
  const cs = childrenOf(s, id);
  return cs.length ? 1 + Math.max(...cs.map((c) => depthBelow(s, c))) : 0;
}

/** Every folder as a tree in reading order, with its depth: for "Move to". */
export function treeOf(s: Shelf): { id: string; depth: number }[] {
  const out: { id: string; depth: number }[] = [];
  const walk = (f: string | null, depth: number) => {
    for (const c of childrenOf(s, f)) {
      out.push({ id: c, depth });
      walk(c, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** How many pieces are in a folder, counting the folders inside it. */
export function countIn(s: Shelf, id: string, pieceIds: readonly string[]): number {
  const inside = new Set([id, ...descendantsOf(s, id)]);
  return pieceIds.filter((p) => {
    const f = folderOf(s, p);
    return f !== null && inside.has(f);
  }).length;
}

/** Is a piece in this folder or one inside it (null = anywhere)? */
export function within(s: Shelf, pieceId: string, id: string | null): boolean {
  if (id === null) return true;
  return pathOf(s, folderOf(s, pieceId)).includes(id);
}

/** A name not used yet beside these folders: "New folder", "New folder 2"… */
export function freeName(s: Shelf, parent: string | null, base = 'New folder'): string {
  const used = new Set(childrenOf(s, parent).map((c) => s.folders[c]!.name.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export const cleanName = (name: string) =>
  name.replace(/\s+/g, ' ').trim().slice(0, MAX_FOLDER_NAME);

/**
 * Deleting a folder keeps everything in it: its folders and pieces move to the folder it was in.
 * Returns the changes to make (each a record with a new date), the folder's tombstone last.
 */
export function deleteChanges(
  s: Shelf,
  id: string,
  pieceIds: readonly string[],
  now: number,
): { folders: Record<string, Folder>; places: Record<string, Place> } {
  const up = parentOf(s, id);
  const folders: Record<string, Folder> = {};
  const places: Record<string, Place> = {};
  for (const c of childrenOf(s, id)) folders[c] = { ...s.folders[c]!, parent: up, updated: now };
  for (const p of pieceIds) if (folderOf(s, p) === id) places[p] = { folder: up, updated: now };
  folders[id] = { ...s.folders[id]!, deleted: true, updated: now };
  return { folders, places };
}

/** A record from another device, if it is newer than the one here. */
export function newer<T extends { updated: number }>(here: T | undefined, there: T): boolean {
  return !here || there.updated > here.updated;
}

/** Read a folder record that came from elsewhere (a backup, the server); undefined if it is not one. */
export function readFolder(x: unknown, updated: number, deleted = false): Folder | undefined {
  if (deleted) return { name: '', parent: null, updated, deleted: true };
  const f = x as Partial<Folder> | null;
  if (!f || typeof f.name !== 'string') return undefined;
  const parent = typeof f.parent === 'string' && /^[\w-]{1,80}$/.test(f.parent) ? f.parent : null;
  const name = cleanName(f.name);
  return name ? { name, parent, updated } : undefined;
}
