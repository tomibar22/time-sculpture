import * as E from '../engine';
import type { GroupKind, GroupSpec, ItemId } from '../engine';
import { startPlayback, stopPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { announce, plural, run, toast } from './actions';
import { cursorAt, cursorIndex, useDocStore, useUiStore } from './store';
import type { Cursor } from './store';

/**
 * Word-processor editing on the timeline: a caret between groups, typing sizes, Backspace/Delete,
 * Shift+arrow selection, copy/cut/paste, resize and retrograde.
 */

const doc = () => useDocStore.getState().doc;
const ui = () => useUiStore.getState();
const setUi = (p: Parameters<ReturnType<typeof useUiStore.getState>['set']>[0]) => ui().set(p);

/* ------------------------------------------------------------------ the caret */

/** Human description of a caret position, e.g. "end of the start, cycle 1 beat 3". */
export function describeCursor(index: number): string {
  const d = doc();
  const si = E.spaceIndex(d.items);
  const grid = E.buildGrid(d.meter);
  const k = E.startOf(d.items, index);
  const B = d.meter.beatsPerCycle;
  const where =
    k >= grid.TS
      ? 'the very end'
      : (() => {
          const b = E.beatOfPulse(grid, k);
          const onBeat = grid.pre[b] === k;
          return `cycle ${Math.floor(b / B) + 1}, beat ${(b % B) + 1}${onBeat ? '' : '+'}`;
        })();
  const side =
    index === si
      ? 'end of the start'
      : index === si + 1
        ? 'start of the ending'
        : index < si
          ? 'in the start'
          : 'in the ending';
  return `${side}, ${where}`;
}

export function setCursor(index: number | null, opts: { quiet?: boolean } = {}): void {
  if (index === null) return setUi({ cursor: null });
  const d = doc();
  const i = E.clamp(index, 0, d.items.length);
  setUi({ cursor: cursorAt(d, i), selection: [], anchor: null, multi: false });
  if (!opts.quiet) announce(`Caret: ${describeCursor(i)}`);
}

/** Current caret index; with a selection, the caret is at the selection's end. */
export function caretIndex(): number | null {
  const d = doc();
  const idx = E.selectedIndices(d.items, ui().selection);
  if (idx.length) return idx[idx.length - 1]! + 1;
  return cursorIndex(d, ui().cursor);
}

export function moveCursor(dir: -1 | 1): void {
  const i = cursorIndex(doc(), ui().cursor);
  if (i === null) return setCursor(dir > 0 ? 0 : doc().items.length);
  const next = i + dir;
  if (next < 0 || next > doc().items.length) return sfx.nope();
  sfx.snap();
  setCursor(next);
}

export function cursorHome(end: boolean): void {
  sfx.snap();
  setCursor(end ? doc().items.length : 0);
}

/** Esc: a selection collapses to a caret at its end; a lone caret is dismissed. */
export function escape(): void {
  const s = ui();
  if (s.selection.length) {
    const i = caretIndex();
    setUi({ selection: [], anchor: null, multi: false });
    if (i !== null) setCursor(i, { quiet: true });
    announce('Selection cleared');
  } else if (s.cursor) {
    setUi({ cursor: null, multi: false });
    announce('Caret removed');
  } else setUi({ multi: false });
}

/** Shift+←/→: grow or shrink the selection like text, starting from the caret. */
export function extendSelection(dir: -1 | 1): void {
  const d = doc();
  const s = ui();
  const groups = (lo: number, hi: number) =>
    d.items
      .slice(lo, hi)
      .filter(E.isGroup)
      .map((x) => x.id);
  let idx = E.selectedIndices(d.items, s.selection);
  if (!idx.length) {
    const c = cursorIndex(d, s.cursor);
    if (c === null) return;
    // pick the group on that side of the caret, skipping the space
    let j = dir > 0 ? c : c - 1;
    while (d.items[j] && E.isSpace(d.items[j]!)) j += dir;
    const x = d.items[j];
    if (!x) return sfx.nope();
    sfx.snap();
    setUi({ selection: [x.id], anchor: x.id, cursor: null });
    return void announce(`Selected ${x.kind === 'rest' ? 'silence' : 'group'} of ${x.n}`);
  }
  if (!E.isContiguous(idx)) idx = [idx[0]!, idx[idx.length - 1]!];
  const anchorI = s.anchor ? E.indexOfId(d.items, s.anchor) : idx[0]!;
  let lo = idx[0]!;
  let hi = idx[idx.length - 1]!;
  // the moving end is the one away from the anchor
  const movingHi = anchorI <= lo;
  if (movingHi) hi += dir;
  else lo += dir;
  const step = (k: number) => (d.items[k] && E.isSpace(d.items[k]!) ? k + dir : k);
  if (movingHi) hi = step(hi);
  else lo = step(lo);
  if (lo < 0 || hi >= d.items.length) return sfx.nope();
  if (lo > hi) {
    // collapsed past the anchor: keep the anchor alone
    return setUi({ selection: [d.items[anchorI]!.id] });
  }
  const sel = groups(lo, hi + 1);
  sfx.snap();
  setUi({ selection: sel, anchor: d.items[anchorI]?.id ?? sel[0] ?? null, cursor: null });
  const n = sel.reduce((a, id) => a + (E.findItem(d, id)?.n ?? 0), 0);
  announce(`${sel.length} selected, ${plural(n, 'pulse')}`);
}

/* ------------------------------------------------------------------ typing */

const TYPE_WINDOW_MS = 900;
let lastTyped: { id: ItemId; digits: string; at: number; version: number; kind: GroupKind } | null =
  null;

/**
 * Type a size. With a selection, it replaces the selection; otherwise it inserts at the caret
 * (or at the Add-at side if there is no caret). A second digit typed quickly extends the number
 * (1 then 2 → 12) in the same undo step.
 */
export function typeDigit(digit: number, kind: GroupKind = 'sound'): void {
  const now = performance.now();
  const version = useDocStore.getState().version;
  const lt = lastTyped;
  if (
    lt &&
    now - lt.at < TYPE_WINDOW_MS &&
    lt.version === version &&
    lt.kind === kind &&
    lt.digits.length < 2
  ) {
    const digits = lt.digits + String(digit);
    const n = Number(digits);
    const r = E.resizeGroup(doc(), lt.id, n);
    if (r.report.ok) {
      useDocStore.getState().amend(r.doc, kind === 'rest' ? `(${n})` : `+${n}`);
      sfx.add(n);
      lastTyped = { ...lt, digits, at: now, version: useDocStore.getState().version };
      return void announce(`${n}, ${E.freePulses(r.doc)} open`);
    }
  }
  if (digit === 0) return sfx.nope();
  const groups: GroupSpec[] = [{ n: digit, kind }];
  const placed = insertOrReplace(groups, kind === 'rest' ? `(${digit})` : `+${digit}`);
  if (placed) {
    lastTyped = {
      id: placed[0]!,
      digits: String(digit),
      at: now,
      version: useDocStore.getState().version,
      kind,
    };
    announce(`${kind === 'rest' ? 'Silence of ' : ''}${digit} typed, ${E.freePulses(doc())} open`);
  }
}

/** Insert at the caret, or replace the selection. Returns the new ids, leaving the caret after them. */
function insertOrReplace(groups: GroupSpec[], label: string): ItemId[] | null {
  const d = doc();
  const s = ui();
  const sel = E.selectedIndices(d.items, s.selection);
  let r: E.OpResult;
  if (sel.length) {
    r = E.replaceGroups(d, s.selection, groups);
    if (r.report.reason === 'not-contiguous') {
      sfx.nope();
      toast('Select neighbouring groups to type or paste over them');
      return null;
    }
  } else {
    const c = cursorIndex(d, s.cursor);
    const si = E.spaceIndex(d.items);
    const at = c ?? (s.addAt === 'start' ? si : si + 1);
    r = E.insertGroups(d, at, groups);
  }
  const sound = () => (groups[0]?.kind === 'rest' ? sfx.remove() : sfx.add(groups[0]?.n ?? 3));
  if (!run(r, { label, select: 'none', sound })) return null;
  const created = r.report.created;
  const lastId = created[created.length - 1]!;
  setUi({ cursor: { after: lastId } as Cursor });
  return [...created];
}

/** Backspace / Delete: with a selection, remove it; otherwise remove the group beside the caret. */
export function deleteAtCursor(dir: -1 | 1): boolean {
  const d = doc();
  const s = ui();
  if (s.selection.length) return false; // the caller removes the selection
  const c = cursorIndex(d, s.cursor);
  if (c === null) return false;
  const j = dir < 0 ? c - 1 : c;
  const x = d.items[j];
  if (!x || E.isSpace(x)) {
    sfx.nope();
    announce(x ? 'The open space is next to the caret' : 'Nothing to delete');
    return true;
  }
  const r = E.remove(d, [x.id]);
  if (run(r, { label: `−${E.describeItem(x)}`, select: 'none', sound: sfx.remove })) {
    setCursor(j, { quiet: true });
    announce(`Deleted ${x.kind === 'rest' ? 'silence' : 'group'} of ${x.n}`);
  }
  return true;
}

/* ------------------------------------------------------------------ clipboard */

export function copySelection(cut = false): string | null {
  const d = doc();
  const sel = ui().selection;
  const groups = E.copyGroups(d, sel);
  if (!groups.length) return null;
  const text = E.formatGroups(groups);
  setUi({ clipboard: groups });
  if (cut) {
    const first = E.selectedIndices(d.items, sel)[0]!;
    const r = E.remove(d, sel);
    if (run(r, { label: `cut ${text}`, select: 'none', sound: sfx.remove })) {
      setCursor(first, { quiet: true });
      toast(`Cut ${text}`, { undo: true });
    }
  } else {
    sfx.snap();
    toast(`Copied ${text}`);
  }
  return text;
}

/** For buttons: also put the text on the system clipboard (allowed inside a user gesture). */
export function copyButton(cut = false): void {
  const text = copySelection(cut);
  if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function paste(groups: GroupSpec[] = ui().clipboard): void {
  if (!groups.length) {
    sfx.nope();
    return void toast('Nothing to paste. Select groups and copy them first.');
  }
  const need = groups.reduce((a, g) => a + g.n, 0);
  const text = E.formatGroups(groups);
  const before = doc();
  const ids = insertOrReplace(groups, `paste ${text}`);
  if (!ids) {
    if (E.selectedIndices(before.items, ui().selection).length === 0 && need > E.freePulses(before))
      toast(`Pasting ${text} needs ${plural(need, 'pulse')}; only ${E.freePulses(before)} open`);
    return;
  }
  announce(`Pasted ${text}`);
}

/* ------------------------------------------------------------------ shaping */

export function resizeSelection(delta: 1 | -1): void {
  const sel = ui().selection;
  if (!sel.length) return sfx.nope();
  const r = E.resizeGroups(doc(), sel, delta);
  if (r.report.reason === 'too-small')
    return void (sfx.nope(), toast('A group needs at least 1 pulse'));
  if (run(r, { label: delta > 0 ? 'grow' : 'shrink', select: 'keep' })) {
    const one = sel.length === 1 ? E.findItem(r.doc, sel[0]!) : null;
    announce(
      one
        ? `Now ${one.n}, ${E.freePulses(r.doc)} open`
        : `${delta > 0 ? 'Grew' : 'Shrank'} ${plural(sel.length, 'group')}`,
    );
  }
}

export function reverseSelection(): void {
  const sel = ui().selection;
  const r = E.reverseGroups(doc(), sel);
  if (r.report.reason === 'nothing-selected')
    return void (sfx.nope(), toast('Select two or more neighbouring groups to reverse'));
  if (r.report.reason === 'no-change')
    return void (sfx.nope(), toast('It reads the same backwards'));
  if (run(r, { label: 'reverse', select: 'keep' })) announce('Reversed');
}

/* ------------------------------------------------------------------ playback */

/** Shift+Space: play from the caret (or the selection's start). */
export function playFromCaret(): void {
  if (ui().playing) return stopPlayback();
  const d = doc();
  const sel = E.selectedIndices(d.items, ui().selection);
  const i = sel.length ? sel[0]! : (cursorIndex(d, ui().cursor) ?? 0);
  const k = E.startOf(d.items, i);
  const grid = E.buildGrid(d.meter);
  startPlayback(k >= grid.TS ? 0 : grid.times[k]!);
}
