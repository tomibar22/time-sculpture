import { create } from 'zustand';
import type { Doc, FillSort, GroupKind, GroupSpec, ItemId } from '../engine';

import { DEFAULT_TEMPO, defaultDoc } from './defaults';

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
  /** What the number pad types: sounds, or silences. */
  addKind: GroupKind;
  /** Bars per row before the score wraps (manual line breaks live in the document). */
  perRow: number;
  /** Stretch rows that end early (at a line break, or the last row) to the full width. */
  fitRows: boolean;
  ticks: boolean;
  tempo: number;
  playing: boolean;
  /** The docked number pad (shown by default on touch screens). */
  keypad: boolean;
  /** Phones: the meter / brush / drag settings are folded into one line until opened. */
  setupOpen: boolean;
  /** Tile sizes the fill panel may use. */
  fillSizes: number[];
  /** The fill panel: closed, or open on the random or browse tab. */
  fillPanel: 'random' | 'browse' | null;
  fillSort: FillSort;
  /** The docked subdivision row, for the beats under the selection, range or caret. */
  subPanel: boolean;
  /** The modulation dialog: adding one at a beat, or editing one (index into meter.sections). */
  modDialog: { at: number } | { index: number } | null;
  /** The endings dialog: a new ending over pulses [ka, kb), or editing one (index into voltas). */
  voltaDialog: { ka: number; kb: number } | { index: number } | null;
  /** Playhead in beats while playing. */
  playhead: number | null;
  theme: Theme;
  /** Live preview during a drag (rendered instead of the document). */
  preview: Doc | null;
  /** Ids of the lifted block during a move drag. */
  lifted: ItemId[];
  /** Text caret on a pulse (0..total), like a caret between letters. */
  caret: number | null;
  /** A selected pulse range [a, b) and its fixed end (the other end follows Shift+arrows). */
  range: { a: number; b: number } | null;
  rangeAnchor: number | null;
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
  addKind: 'sound',
  perRow: 1,
  fitRows: false,
  ticks: true,
  tempo: DEFAULT_TEMPO,
  playing: false,
  fillSizes: [2, 3, 4, 5, 7],
  fillPanel: null,
  fillSort: 'onbeat',
  subPanel: false,
  modDialog: null,
  voltaDialog: null,
  keypad: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  setupOpen: false,
  playhead: null,
  theme: 'system',
  preview: null,
  lifted: [],
  caret: null,
  range: null,
  rangeAnchor: null,
  clipboard: [],
  flash: { ids: [], until: 0 },
  toast: null,
  announcement: '',
  focusedId: null,
  currentId: null,
  currentName: 'Untitled',
  set: (patch) => set(patch),
}));
