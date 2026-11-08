import { create } from 'zustand';
import type { Doc, GroupKind, GroupSpec, ItemId } from '../engine';

export interface Cursor {
  after: ItemId | null;
}

/** Item index of a cursor in a document, or null if its anchor no longer exists. */
export function cursorIndex(doc: Doc, cursor: Cursor | null): number | null {
  if (!cursor) return null;
  if (cursor.after === null) return 0;
  const i = doc.items.findIndex((x) => x.id === cursor.after);
  return i < 0 ? null : i + 1;
}

/** The cursor for an item index. */
export function cursorAt(doc: Doc, index: number): Cursor {
  return {
    after: index <= 0 ? null : (doc.items[Math.min(index, doc.items.length) - 1]?.id ?? null),
  };
}
import { DEFAULT_TEMPO, DEFAULT_TRAY, defaultDoc } from './defaults';

export type MoveMode = 'pulse' | 'beat' | 'place';
export type Theme = 'system' | 'light' | 'dark';

const HISTORY_LIMIT = 200;
const LOG_LIMIT = 8;

/* ------------------------------------------------------------------ document slice (undoable) */

export interface DocState {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  /** Short labels of recent actions ("+3⇥", "slide +2", …). */
  log: string[];
  /** Increments on every committed change (used to expire toasts and trigger saves). */
  version: number;
  commit: (doc: Doc, label: string) => void;
  /** Replace the latest commit (e.g. typing a second digit) without a new history step. */
  amend: (doc: Doc, label: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  /** Replace the document without history (load from library / share link). */
  load: (doc: Doc) => void;
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: defaultDoc(),
  past: [],
  future: [],
  log: [],
  version: 0,
  commit: (doc, label) => {
    const s = get();
    if (doc === s.doc) return;
    set({
      doc,
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.doc],
      future: [],
      log: [...s.log.slice(-(LOG_LIMIT - 1)), label],
      version: s.version + 1,
    });
  },
  amend: (doc, label) => {
    const s = get();
    if (!s.past.length) return s.commit(doc, label);
    set({ doc, future: [], log: [...s.log.slice(0, -1), label], version: s.version + 1 });
  },
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return false;
    set({
      doc: prev,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future],
      version: s.version + 1,
    });
    return true;
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return false;
    set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), version: s.version + 1 });
    return true;
  },
  load: (doc) => set((s) => ({ doc, past: [], future: [], log: [], version: s.version + 1 })),
}));

/* ------------------------------------------------------------------ UI slice (not undoable) */

export interface Toast {
  id: number;
  message: string;
  /** Show an Undo button while the document is still at this version. */
  undoVersion?: number;
  action?: { label: string; run: () => void };
}

export interface UiState {
  selection: ItemId[];
  anchor: ItemId | null;
  multi: boolean;
  moveMode: MoveMode;
  brush: number;
  addAt: 'start' | 'end';
  addKind: GroupKind;
  tray: number[];
  /** Cycles per row by default, and custom per-row counts (see score/rows.ts). */
  perRow: number;
  rows: number[];
  snap: boolean;
  ticks: boolean;
  tempo: number;
  playing: boolean;
  /** Playhead in beats while playing. */
  playhead: number | null;
  theme: Theme;
  /** Live preview during a drag (rendered instead of the document). */
  preview: Doc | null;
  /** Ids of the lifted block during a move drag. */
  lifted: ItemId[];
  /** Drop caret (item index) while dragging a tray piece over the score. */
  dropCaret: number | null;
  /**
   * Text-editor caret between items. Anchored to the item it follows (null = the very beginning),
   * so it survives edits elsewhere. `{ after: 'space' }` is the start of the ending.
   */
  cursor: Cursor | null;
  /** Copied groups (also written to the system clipboard as text). */
  clipboard: GroupSpec[];
  flash: { ids: ItemId[]; until: number };
  toast: Toast | null;
  announcement: string;
  /** Item focused in the screen-reader list (drawn with a dashed outline). */
  focusedId: ItemId | null;
  currentId: string | null;
  currentName: string;
  set: (patch: Partial<UiState>) => void;
}

let toastSeq = 0;
export const nextToastId = () => ++toastSeq;

export const useUiStore = create<UiState>((set) => ({
  selection: [],
  anchor: null,
  multi: false,
  moveMode: 'pulse',
  brush: 4,
  addAt: 'end',
  addKind: 'sound',
  tray: DEFAULT_TRAY,
  perRow: 1,
  rows: [],
  snap: false,
  ticks: true,
  tempo: DEFAULT_TEMPO,
  playing: false,
  playhead: null,
  theme: 'system',
  preview: null,
  lifted: [],
  dropCaret: null,
  cursor: null,
  clipboard: [],
  flash: { ids: [], until: 0 },
  toast: null,
  announcement: '',
  focusedId: null,
  currentId: null,
  currentName: 'Untitled',
  set: (patch) => set(patch),
}));
