import { blankDoc } from '../state/defaults';
import { announce, clearSelection, toast } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';
import type { Doc } from '../engine';
import {
  currentPieceId,
  deletePiece,
  listPieces,
  loadPiece,
  newId,
  savePiece,
  setCurrentPieceId,
} from './library';
import { decodeShare, encodeShare, fromSaved, toSaved } from './serialize';
import type { SavedPiece } from './serialize';

/** Glue between the stores and the IndexedDB library: open, autosave, share. */

const ui = () => useUiStore.getState();

export function currentSaved(): SavedPiece {
  const { tray, tempo, currentName, perRow, rows } = ui();
  return toSaved(useDocStore.getState().doc, currentName, { tray, tempo, perRow, rows });
}

function adopt(id: string, piece: SavedPiece): void {
  const { doc, name, settings } = fromSaved(piece);
  useDocStore.getState().load(doc);
  clearSelection();
  ui().set({
    currentId: id,
    currentName: name,
    tray: settings.tray,
    tempo: settings.tempo,
    perRow: settings.perRow ?? 1,
    rows: settings.rows ?? [],
    preview: null,
    selection: [],
    cursor: null,
  });
}

export async function saveNow(): Promise<void> {
  const id = ui().currentId;
  if (id) await savePiece(id, currentSaved());
}

let saveTimer: number | undefined;
function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveNow(), 400);
}

/** Load the share link, or the last piece, or create the first one. Then autosave on change. */
export async function initSession(): Promise<void> {
  const hash = location.hash;
  let loaded = false;
  if (hash.startsWith('#s=')) {
    try {
      const piece = await decodeShare(decodeURIComponent(hash.slice(3)));
      const id = newId();
      adopt(id, { ...piece, name: `${piece.name} (shared)` });
      await savePiece(id, currentSaved());
      toast('Opened a shared composition. It is saved in your library.');
      loaded = true;
    } catch {
      toast('That share link could not be read.');
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!loaded) {
    try {
      const id = await currentPieceId();
      const piece = id ? await loadPiece(id) : undefined;
      if (id && piece) adopt(id, piece);
      else {
        const nid = newId();
        ui().set({ currentId: nid, currentName: 'First phrase' });
        await savePiece(nid, currentSaved());
      }
    } catch {
      // storage unavailable (private mode): keep working in memory
    }
  }
  useDocStore.subscribe((s, prev) => {
    if (s.version !== prev.version) scheduleSave();
  });
  useUiStore.subscribe((s, prev) => {
    if (
      s.tray !== prev.tray ||
      s.tempo !== prev.tempo ||
      s.currentName !== prev.currentName ||
      s.perRow !== prev.perRow ||
      s.rows !== prev.rows
    )
      scheduleSave();
  });
  window.addEventListener('pagehide', () => void saveNow());
}

/* ------------------------------------------------------------------ library actions */

export async function openPiece(id: string): Promise<void> {
  await saveNow();
  const piece = await loadPiece(id);
  if (!piece) return toast('That composition is gone.');
  adopt(id, piece);
  await setCurrentPieceId(id);
  announce(`Opened ${piece.name}`);
}

export async function createPiece(doc: Doc = blankDoc(), name = 'Untitled'): Promise<void> {
  await saveNow();
  const id = newId();
  useDocStore.getState().load(doc);
  clearSelection();
  ui().set({ currentId: id, currentName: name, cursor: null });
  await savePiece(id, currentSaved());
  announce(`New composition: ${name}`);
}

export async function duplicatePiece(): Promise<void> {
  await createPiece(useDocStore.getState().doc, `${ui().currentName} copy`);
  toast('Duplicated. You are now editing the copy.');
}

export function renamePiece(name: string): void {
  const n = name.trim();
  if (n) ui().set({ currentName: n });
}

export async function removePiece(id: string): Promise<void> {
  await deletePiece(id);
  if (id === ui().currentId) {
    const rest = await listPieces();
    if (rest[0]) await openPiece(rest[0].id);
    else await createPiece();
  }
}

export { listPieces };

export function exportFile(): void {
  const piece = currentSaved();
  const blob = new Blob([JSON.stringify(piece, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${piece.name.replace(/[^\w\- ]+/g, '').trim() || 'composition'}.timesculpture.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFile(file: File): Promise<void> {
  try {
    const raw: unknown = JSON.parse(await file.text());
    const piece = raw as SavedPiece;
    fromSaved(piece); // validate
    await saveNow();
    const id = newId();
    adopt(id, piece);
    await savePiece(id, currentSaved());
    toast(`Imported ${piece.name}`);
  } catch (e) {
    toast(e instanceof Error ? e.message : 'That file could not be read.');
  }
}

export async function shareLink(): Promise<string> {
  const code = await encodeShare(currentSaved());
  return `${location.origin}${location.pathname}#s=${code}`;
}
