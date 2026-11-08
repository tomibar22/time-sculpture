import * as E from '../engine';
import type { Doc, ItemId, OpResult, Report } from '../engine';
import { startPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { blankDoc } from './defaults';
import { cursorAt, cursorIndex, nextToastId, useDocStore, useUiStore } from './store';
import type { Toast } from './store';

/* ------------------------------------------------------------------ feedback */

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const FLASH_MS = 1600;
const doc = () => useDocStore.getState().doc;
const uiState = () => useUiStore.getState();
const setUi = (p: Parameters<ReturnType<typeof useUiStore.getState>['set']>[0]) => uiState().set(p);

export function announce(message: string): void {
  // Re-set to retrigger aria-live even when the same message repeats.
  setUi({ announcement: '' });
  queueMicrotask(() => setUi({ announcement: message }));
}

export function toast(
  message: string,
  opts: { undo?: boolean; action?: Toast['action'] } = {},
): void {
  const t: Toast = { id: nextToastId(), message };
  if (opts.undo) t.undoVersion = useDocStore.getState().version;
  if (opts.action) t.action = opts.action;
  setUi({ toast: t });
}

export function flash(ids: readonly ItemId[]): void {
  if (ids.length) setUi({ flash: { ids: [...ids], until: performance.now() + FLASH_MS } });
}

function failMessage(r: Report, d: Doc): string | null {
  const free = E.freePulses(d);
  switch (r.reason) {
    case 'no-room':
      return free
        ? `Only ${plural(free, 'pulse')} of open space left`
        : 'No open space. Shrink something or remove a group.';
    case 'not-contiguous':
      return 'Select neighbouring groups for this';
    case 'too-small':
      return "A group of 1 can't split";
    case 'cannot-fill':
      return `Tray sizes can't fill ${free}. Stretch a group, or fill it with silence.`;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ committing */

interface RunOpts {
  label: string;
  select?: ItemId[] | 'keep' | 'none';
  sound?: () => void;
  quiet?: boolean;
}

/** Commit an operation result with feedback. Returns whether it applied. */
export function run(result: OpResult, opts: RunOpts): boolean {
  const before = doc();
  if (!result.report.ok) {
    if (!opts.quiet) {
      sfx.nope();
      const msg = failMessage(result.report, before);
      if (msg) toast(msg);
    }
    return false;
  }
  const wasComplete = E.freePulses(before) === 0;
  useDocStore.getState().commit(result.doc, opts.label);
  if (opts.select === 'none') setUi({ selection: [], anchor: null });
  else if (opts.select && opts.select !== 'keep')
    setUi({ selection: opts.select, anchor: opts.select[0] ?? null });
  pruneSelection();
  (opts.sound ?? sfx.snap)();
  if (!wasComplete && E.freePulses(result.doc) === 0 && !uiState().playing) {
    sfx.done();
    toast('Complete. It lands on 1.', {
      action: {
        label: 'Play',
        run: startPlayback,
      },
    });
  }
  return true;
}

function pruneSelection(): void {
  const ids = new Set(doc().items.map((x) => x.id));
  const sel = uiState().selection.filter((id) => ids.has(id));
  if (sel.length !== uiState().selection.length) setUi({ selection: sel, anchor: sel[0] ?? null });
}

export function undo(): void {
  if (useDocStore.getState().undo()) {
    sfx.remove();
    pruneSelection();
    announce('Undone');
  } else sfx.nope();
}

export function redo(): void {
  if (useDocStore.getState().redo()) {
    sfx.add(3);
    pruneSelection();
    announce('Redone');
  } else sfx.nope();
}

/* ------------------------------------------------------------------ selection */

export function selectedIds(): ItemId[] {
  return uiState().selection;
}

export function select(id: ItemId, mods: { shift?: boolean; toggle?: boolean } = {}): void {
  const s = uiState();
  const toggle = mods.toggle || s.multi;
  if (mods.shift && s.anchor && doc().items.some((x) => x.id === s.anchor)) {
    setUi({ selection: E.rangeIds(doc().items, s.anchor, id) });
  } else if (toggle) {
    const has = s.selection.includes(id);
    setUi({
      selection: has ? s.selection.filter((x) => x !== id) : [...s.selection, id],
      anchor: id,
    });
  } else if (s.selection.length === 1 && s.selection[0] === id) {
    setUi({ selection: [], anchor: null });
  } else {
    setUi({ selection: [id], anchor: id });
  }
  setUi({ cursor: null });
  sfx.snap();
  describeSelection();
}

export function selectAll(): void {
  setUi({
    selection: doc()
      .items.filter(E.isGroup)
      .map((x) => x.id),
  });
  describeSelection();
}

/** Clear the selection. It collapses to a caret just after it, like text. */
export function clearSelection(): void {
  const idx = E.selectedIndices(doc().items, uiState().selection);
  const cursor = idx.length ? cursorAt(doc(), idx[idx.length - 1]! + 1) : uiState().cursor;
  setUi({ selection: [], anchor: null, multi: false, cursor });
}

export function toggleMulti(on = !uiState().multi): void {
  setUi({ multi: on });
  sfx.snap();
  if (on) announce('Selecting several. Tap more groups.');
}

function describeSelection(): void {
  const sel = uiState().selection;
  const d = doc();
  if (!sel.length) return announce('Selection cleared');
  if (sel.length === 1) {
    const i = E.indexOfId(d.items, sel[0]!);
    const x = d.items[i];
    if (x)
      announce(
        `${x.kind === 'rest' ? 'Silence' : 'Group'} of ${x.n}, in the ${i < E.spaceIndex(d.items) ? 'start' : 'ending'}`,
      );
  } else {
    const n = sel.reduce((a, id) => a + (E.findItem(d, id)?.n ?? 0), 0);
    announce(`${sel.length} selected, ${plural(n, 'pulse')}`);
  }
}

/* ------------------------------------------------------------------ adding and fills */

/**
 * Add a tray piece. `index` = dropped at a place. Otherwise, if a caret is placed (and nothing is
 * selected) it is inserted at the caret and the caret moves after it, like typing; else it goes to
 * the Add-at side.
 */
export function addPiece(size: number, index?: number): void {
  const { addAt, addKind, cursor, selection } = uiState();
  const d = doc();
  const caret = index === undefined && !selection.length ? cursorIndex(d, cursor) : null;
  const at = index ?? caret;
  const r = E.add(d, size, addKind, at !== null ? { index: at } : addAt);
  const label = `${addAt === 'start' && at === null ? '⇤' : ''}${addKind === 'rest' ? `(${size})` : `+${size}`}${addAt === 'end' && at === null ? '⇥' : ''}`;
  const ok = run(r, {
    label,
    select: caret !== null ? 'none' : [...r.report.created],
    sound: () => (addKind === 'rest' ? sfx.remove() : sfx.add(size)),
  });
  if (!ok) return;
  if (caret !== null) setUi({ cursor: { after: r.report.created[0]! } });
  const free = E.freePulses(r.doc);
  announce(`${addKind === 'rest' ? 'Silence of ' : ''}${size} added, ${free} open`);
  if (free > 0 && E.countWays(free, uiState().tray) === 0n)
    toast(
      `${free} open can't be filled with tray sizes. Stretch a group, or fill it with silence.`,
    );
}

export function fillWithPieces(): void {
  const r = E.fillWithPieces(doc(), uiState().tray);
  if (r.report.reason === 'no-room') return toast('No open space left');
  if (
    run(r, {
      label: `fill ${r.report.created.map((id) => E.findItem(r.doc, id)?.n).join(' ')}`,
      select: [...r.report.created],
    })
  )
    announce(`Filled with ${plural(r.report.created.length, 'piece')}`);
}

export function fillWithSilence(): void {
  const r = E.fillWithSilence(doc());
  if (r.report.reason === 'no-room') return toast('No open space left');
  run(r, {
    label: `fill (${E.freePulses(doc())})`,
    select: [...r.report.created],
    sound: sfx.remove,
  });
}

export function clearAll(): void {
  if (run(E.clear(doc()), { label: 'clear', select: 'none', sound: sfx.remove, quiet: true }))
    toast('Cleared', { undo: true });
}

export function newComposition(): void {
  useDocStore.getState().load(blankDoc());
  setUi({ selection: [], anchor: null, multi: false, cursor: null });
}

/* ------------------------------------------------------------------ selection actions */

const desc = (d: Doc, ids: readonly ItemId[]) =>
  ids
    .map((id) => E.findItem(d, id))
    .filter((x): x is E.Item => !!x)
    .map(E.describeItem)
    .join(' ');

export function mergeSelection(): void {
  const sel = selectedIds();
  const r = E.merge(doc(), sel);
  if (r.report.reason === 'nothing-selected')
    return void toast('Select two or more neighbouring groups to merge');
  const n = r.report.ok
    ? E.findItem(
        r.doc,
        sel.find((id) => E.findItem(r.doc, id))!,
      )?.n
    : 0;
  if (
    run(r, {
      label: `merge→${n}`,
      select: sel.filter((id) => E.findItem(r.doc, id)),
      sound: () => sfx.add(n ?? 3),
    })
  )
    toast(`Merged into ${n}`);
}

export function splitSelection(): void {
  const before = doc();
  const sel = selectedIds();
  const r = E.split(before, sel);
  const splitIds = sel.filter((id) => (E.findItem(before, id)?.n ?? 0) >= 2);
  if (
    !run(r, {
      label: `split ${desc(before, splitIds)}`,
      select: [...splitIds, ...r.report.created],
      sound: () => sfx.add(2),
    })
  )
    return;
  const one = splitIds.length === 1 ? E.findItem(before, splitIds[0]!) : null;
  toast(
    one
      ? `Split ${one.n} into ${Math.ceil(one.n / 2)} + ${Math.floor(one.n / 2)}`
      : `Split ${plural(splitIds.length, 'group')}`,
  );
}

export function toggleSelectionKind(): void {
  const sel = selectedIds();
  if (!sel.length) return;
  const toRest = E.toggledKind(doc(), sel) === 'rest';
  run(E.toggleKind(doc(), sel), {
    label: toRest ? 'silence' : 'sound',
    select: 'keep',
    sound: () => (toRest ? sfx.remove() : sfx.add(E.findItem(doc(), sel[0]!)?.n ?? 3)),
  });
  announce(toRest ? 'Silenced' : 'Sounding');
}

export function duplicateSelection(): void {
  const before = doc();
  const sel = selectedIds();
  const r = E.duplicate(before, sel);
  if (r.report.reason === 'no-room') {
    sfx.nope();
    const need = sel.reduce((a, id) => a + (E.findItem(before, id)?.n ?? 0), 0);
    return void toast(`Duplicating needs ${need} pulses; only ${E.freePulses(before)} are open`);
  }
  run(r, {
    label: `dup ${desc(before, sel)}`,
    select: [...r.report.created],
    sound: () => sfx.add(3),
  });
}

export function removeSelection(): void {
  const before = doc();
  const sel = selectedIds();
  if (!sel.length) return;
  if (
    run(E.remove(before, sel), {
      label: `−${desc(before, sel)}`,
      select: 'none',
      sound: sfx.remove,
    })
  )
    toast(`Removed ${plural(sel.length, 'group')}`, { undo: true });
}

/* ------------------------------------------------------------------ moving */

/** Feedback after a slide (shared by keys, buttons and drags). */
export function reportSlide(r: Report, d: number): void {
  const parts: string[] = [];
  if (r.shortened.length) parts.push(`${plural(r.shortened.length, 'group')} shortened`);
  if (r.covered.length) parts.push(`${plural(r.covered.length, 'group')} covered`);
  if (r.created.length) parts.push('silence left behind');
  const msg = `Moved ${plural(Math.abs(d), 'pulse')} ${d > 0 ? 'later' : 'earlier'}.`;
  flash(r.shortened);
  if (r.shortened.length || r.covered.length) toast(`${msg} ${parts.join(', ')}.`, { undo: true });
  else announce(`${msg} ${parts.join(', ')}`);
}

export function moveSelection(dir: -1 | 1): void {
  const sel = selectedIds();
  if (!sel.length) return;
  const d0 = doc();
  const mode = uiState().moveMode;
  if (mode === 'place') {
    const r = E.reorderStep(d0, sel, dir);
    if (
      !run(r, {
        label: 'move',
        select: 'keep',
        quiet: r.report.reason === 'out-of-range' || r.report.reason === 'no-change',
      })
    )
      return sfx.nope();
    const si = E.spaceIndex(r.doc.items);
    const crossed =
      E.spaceIndex(d0.items) !== si &&
      E.indexOfId(d0.items, sel[0]!) < E.spaceIndex(d0.items) !==
        E.indexOfId(r.doc.items, sel[0]!) < si;
    announce(
      crossed
        ? `Moved across the open space, now in the ${E.indexOfId(r.doc.items, sel[0]!) > si ? 'ending' : 'start'}`
        : 'Moved',
    );
    return;
  }
  const idx = E.selectedIndices(d0.items, sel);
  if (!E.isContiguous(idx)) {
    sfx.nope();
    return void toast('Moving on the grid needs neighbouring groups');
  }
  const d = E.stepDelta(d0, sel, dir, mode);
  if (!d) return sfx.nope();
  const r = E.slide(d0, sel, d);
  if (run(r, { label: `slide ${d > 0 ? '+' : ''}${d}`, select: 'keep' })) reportSlide(r.report, d);
}

/* ------------------------------------------------------------------ meter */

export function setMeter(beats: number, cycles: number): void {
  const r = E.resizeMeter(doc(), beats, cycles, uiState().brush);
  if (!run(r, { label: `${beats} beats × ${cycles}`, select: 'keep', quiet: true })) return;
  if (r.report.removed.length)
    toast(
      `Shorter now: ${plural(r.report.removed.length, 'group')} next to the open space removed.`,
      { undo: true },
    );
  announce(`${beats} beats, ${plural(cycles, 'cycle')}`);
}

function beatRange(beats: number[], bpc: number, nb: number): string {
  const bs = [...beats].sort((a, b) => a - b);
  const lab = (b: number) => `${Math.floor(b / bpc) + 1}.${(b % bpc) + 1}`;
  if (bs.length === nb) return 'Every beat';
  return bs.length === 1
    ? `Beat ${lab(bs[0]!)}`
    : `Beats ${lab(bs[0]!)}–${lab(bs[bs.length - 1]!)}`;
}

export function paintSubdivision(beats: number[], d = uiState().brush): void {
  const before = doc();
  const todo = beats.filter((b) => before.meter.subdivision[b] !== d);
  if (!todo.length) return;
  const r = E.setSubdivision(before, todo, d);
  const range = beatRange(todo, before.meter.beatsPerCycle, before.meter.subdivision.length);
  if (!run(r, { label: `${range} → ${d}:1`, select: 'keep' })) return;
  flash(r.report.moved);
  const parts: string[] = [];
  if (r.report.startsMoved)
    parts.push(`${plural(r.report.startsMoved, 'start')} snapped to the nearest pulse`);
  if (r.report.absorbed) parts.push(`${plural(r.report.absorbed, 'group')} absorbed`);
  toast(
    `${range} now ${d}:1.${parts.length ? ` ${parts.join(', ')}.` : ' Everything still fits.'}`,
    { undo: true },
  );
}

export function applySubdivisionEverywhere(): void {
  paintSubdivision([...Array(doc().meter.subdivision.length).keys()]);
}

/* ------------------------------------------------------------------ settings */

export function toggleTraySize(n: number): void {
  const tray = uiState().tray;
  if (tray.includes(n)) {
    if (tray.length > 1) setUi({ tray: tray.filter((x) => x !== n) });
  } else setUi({ tray: [...tray, n].sort((a, b) => a - b) });
}
