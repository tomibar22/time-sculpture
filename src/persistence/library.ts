import { createStore, del, get, set } from 'idb-keyval';
import type { SavedPiece } from './serialize';

export interface LibraryEntry {
  id: string;
  name: string;
  updated: number;
}

const store =
  typeof indexedDB !== 'undefined' ? createStore('time-sculpture', 'library') : undefined;
const INDEX = 'index';
const CURRENT = 'current';

export const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export async function listPieces(): Promise<LibraryEntry[]> {
  const idx = (await get<LibraryEntry[]>(INDEX, store)) ?? [];
  return [...idx].sort((a, b) => b.updated - a.updated);
}

export async function loadPiece(id: string): Promise<SavedPiece | undefined> {
  return get<SavedPiece>(`piece:${id}`, store);
}

export async function savePiece(id: string, piece: SavedPiece): Promise<void> {
  await set(`piece:${id}`, piece, store);
  const idx = ((await get<LibraryEntry[]>(INDEX, store)) ?? []).filter((e) => e.id !== id);
  idx.push({ id, name: piece.title, updated: Date.now() });
  await set(INDEX, idx, store);
  await set(CURRENT, id, store);
}

export async function deletePiece(id: string): Promise<void> {
  await del(`piece:${id}`, store);
  const idx = ((await get<LibraryEntry[]>(INDEX, store)) ?? []).filter((e) => e.id !== id);
  await set(INDEX, idx, store);
}

export async function currentPieceId(): Promise<string | undefined> {
  return get<string>(CURRENT, store);
}

export async function setCurrentPieceId(id: string): Promise<void> {
  await set(CURRENT, id, store);
}
