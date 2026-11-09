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
  const { tempo, currentName, perRow, fitRows } = ui();
  return toSaved(useDocStore.getState().doc, currentName, { tempo, perRow, fitRows });
}

/** Make a parsed file (any version) the open composition. Returns its name. */
function adopt(id: string, raw: unknown, rename?: (name: string) => string): string {
  const parsed = fromSaved(raw);
  const { doc, settings } = parsed;
  const name = rename ? rename(parsed.name) : parsed.name;
  useDocStore.getState().load(doc);
  clearSelection();
  ui().set({
    currentId: id,
    currentName: name,
    tempo: settings.tempo,
    perRow: settings.perRow ?? 1,
    fitRows: settings.fitRows ?? false,
    preview: null,
    selection: [],
    caret: null,
    range: null,
  });
  return name;
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
      adopt(id, piece, (n) => `${n} (shared)`);
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
      s.tempo !== prev.tempo ||
      s.currentName !== prev.currentName ||
      s.perRow !== prev.perRow ||
      s.fitRows !== prev.fitRows
    )
      scheduleSave();
  });
  window.addEventListener('pagehide', () => void saveNow());
  // iOS may suspend a home-screen app without `pagehide`: save when it leaves the screen too
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveNow();
  });
  // ask the browser to keep the library (otherwise it may be evicted when storage runs low)
  void navigator.storage?.persist?.().catch(() => undefined);
  // lets tests (and anything else) know the composition is loaded and edits are safe
  document.documentElement.dataset.ready = '1';
}

/* ------------------------------------------------------------------ library actions */

export async function openPiece(id: string): Promise<void> {
  await saveNow();
  const piece = await loadPiece(id);
  if (!piece) return toast('That composition is gone.');
  const name = adopt(id, piece);
  await setCurrentPieceId(id);
  announce(`Opened ${name}`);
}

export async function createPiece(doc: Doc = blankDoc(), name = 'Untitled'): Promise<void> {
  await saveNow();
  const id = newId();
  useDocStore.getState().load(doc);
  clearSelection();
  ui().set({ currentId: id, currentName: name, caret: null, range: null });
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
  const wasOpen = id === ui().currentId;
  // forget it first: opening the next piece saves "the current one", which would bring it back
  if (wasOpen) {
    clearTimeout(saveTimer);
    ui().set({ currentId: null });
  }
  await deletePiece(id);
  if (wasOpen) {
    const rest = await listPieces();
    if (rest[0]) await openPiece(rest[0].id);
    else await createPiece();
  }
}

export { listPieces };

/** A safe file name from a title (keeps letters in any script). */
export const fileName = (title: string, ext: string) =>
  `${title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'composition'}.${ext}`;

/**
 * Hand a file to the user. On phones the share sheet ("Save to Files", AirDrop…) is the natural
 * way; elsewhere it downloads.
 */
export async function deliverFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function exportFile(): Promise<void> {
  const piece = currentSaved();
  const blob = new Blob([JSON.stringify(piece, null, 2) + '\n'], { type: 'application/json' });
  await deliverFile(blob, fileName(piece.title, 'timesculpture.json'));
}

export async function importFile(file: File): Promise<void> {
  try {
    const raw: unknown = JSON.parse(await file.text());
    fromSaved(raw); // validate before touching anything
    await saveNow();
    const id = newId();
    const name = adopt(id, raw);
    await savePiece(id, currentSaved());
    toast(`Imported ${name}`);
  } catch (e) {
    toast(e instanceof Error ? e.message : 'That file could not be read.');
  }
}

export async function shareLink(): Promise<string> {
  const code = await encodeShare(currentSaved());
  return `${location.origin}${location.pathname}#s=${code}`;
}

/** Save the composition as a printed score sheet (PDF). The renderer loads on demand. */
export async function exportPdf(): Promise<void> {
  const { sheetPdf } = await import('../export/sheet');
  const { tempo, currentName, perRow, fitRows } = ui();
  toast('Preparing the PDF…');
  const blob = await sheetPdf({
    doc: useDocStore.getState().doc,
    title: currentName,
    tempo,
    perRow,
    fitRows,
  });
  await deliverFile(blob, fileName(currentName, 'pdf'));
  toast('PDF ready');
}
