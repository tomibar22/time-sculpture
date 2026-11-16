import * as E from '../engine';
import type { Doc, ItemId, OpResult, Report } from '../engine';
import { startPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { blankDoc } from './defaults';
import { nextToastId, useDocStore, useUiStore } from './store';
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
  if (uiState().stage) return; // nothing pops up in a recording
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
  // silences side by side become one stretch of empty time
  useDocStore.getState().commit(E.joinRests(result.doc), opts.label);
  if (opts.select === 'none') setUi({ selection: [], anchor: null });
  else if (opts.select && opts.select !== 'keep')
    setUi({ selection: opts.select, anchor: opts.select[0] ?? null });
  pruneSelection();
  (opts.sound ?? sfx.snap)();
  if (!wasComplete && E.freePulses(result.doc) === 0 && !uiState().playing) {
    sfx.done();
    setUi({ completedAt: performance.now() });
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

/**
 * Whatever changed the document (an edit, undo, a shorter meter, another subdivision, opening a
 * piece): the caret and the range stay inside the piece, and ids that are gone leave the selection.
 */
useDocStore.subscribe((s, prev) => {
  if (s.doc === prev.doc) return;
  pruneSelection();
  const TS = E.buildGrid(s.doc.meter).TS;
  const u = uiState();
  if (u.playStart !== null && u.playStart >= s.doc.meter.subdivision.length - E.EPS)
    setUi({ playStart: null });
  if (u.range && u.range.b > TS) {
    const a = Math.min(u.range.a, TS);
    setUi(
      a < TS
        ? { range: { a, b: TS }, rangeAnchor: Math.min(u.rangeAnchor ?? a, TS), caret: TS }
        : { range: null, rangeAnchor: null, caret: TS },
    );
  } else if (u.caret !== null && u.caret > TS) setUi({ caret: TS });
});

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
  setUi({ caret: null, range: null, rangeAnchor: null });
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
  const span = E.spanOf(doc(), uiState().selection);
  const caret = span ? span.b : uiState().caret;
  setUi({ selection: [], anchor: null, multi: false, caret, range: null, rangeAnchor: null });
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
  setUi({ selection: [], anchor: null, multi: false, caret: null, range: null });
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

/**
 * Bars to add at the end so that `need` more pulses fit (0 when they fit already), and the piece
 * with them. Null when the piece cannot get that long.
 */
function roomFor(d: Doc, need: number): { bars: number; doc: Doc } | null {
  if (need <= E.freePulses(d)) return { bars: 0, doc: d };
  for (let n = 1; n <= E.MAX_CYCLES * 2; n++) {
    const grown = E.appendBars(d, n);
    if (!grown.report.ok) return null;
    // open space that ended up beside the new bars is open again
    const joined = E.joinRests(grown.doc);
    if (E.freePulses(joined) >= need) return { bars: n, doc: joined };
  }
  return null;
}

/**
 * A copy right after the selection. When the piece has no room for it, the bars it needs are
 * added at the end first (one step to undo), so duplicating never asks for bars to be made.
 */
export function duplicateSelection(): void {
  const before = doc();
  const sel = selectedIds();
  if (!sel.length) return;
  const need = sel.reduce((a, id) => a + (E.findItem(before, id)?.n ?? 0), 0);
  const room = roomFor(before, need);
  if (!room) {
    sfx.nope();
    return void toast(`Duplicating needs ${need} pulses, and the piece cannot get longer`);
  }
  const { bars, doc: base } = room;
  const r = E.duplicate(base, sel);
  if (
    run(r, {
      label: `dup ${desc(before, sel)}`,
      select: [...r.report.created],
      sound: () => sfx.add(3),
    }) &&
    bars
  )
    toast(`Duplicated. ${plural(bars, 'bar')} added at the end to make room.`, { undo: true });
}

/** The same for a selected range: its groups again, right after it. */
export function duplicateRange(): void {
  const before = doc();
  const range = uiState().range;
  if (!range) return;
  const groups = E.sliceRange(before, range.a, range.b);
  const need = range.b - range.a;
  const room = roomFor(before, need);
  if (!room) {
    sfx.nope();
    return void toast(`Duplicating needs ${need} pulses, and the piece cannot get longer`);
  }
  const { bars, doc: base } = room;
  const r = E.insertAtPulse(base, range.b, groups);
  if (!run(r, { label: `dup ${E.formatGroups(groups)}`, select: 'none', sound: () => sfx.add(3) }))
    return;
  setUi({ range: { a: range.b, b: range.b + need }, rangeAnchor: range.b, caret: range.b + need });
  toast(bars ? `Duplicated. ${plural(bars, 'bar')} added at the end to make room.` : 'Duplicated', {
    undo: true,
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
  // groups that are not neighbours move together, by the step of the one in front
  const idx = E.selectedIndices(d0.items, sel);
  const lead = dir > 0 ? idx[idx.length - 1]! : idx[0]!;
  let run0 = [lead];
  while (idx.includes(run0[0]! - 1)) run0 = [run0[0]! - 1, ...run0];
  while (idx.includes(run0[run0.length - 1]! + 1)) run0.push(run0[run0.length - 1]! + 1);
  const d = E.stepDelta(
    d0,
    run0.map((i) => d0.items[i]!.id),
    dir,
    mode,
  );
  if (!d) return sfx.nope();
  const r = E.slideRuns(d0, sel, d);
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
  announce(`${beats} beats, ${plural(cycles, 'bar')}`);
}

function beatRange(beats: number[], meter: E.Meter): string {
  const bs = [...beats].sort((a, b) => a - b);
  const lab = (b: number) => {
    const bb = E.barBeat(meter, b);
    return `${bb.bar}.${bb.beat}`;
  };
  if (bs.length === meter.subdivision.length) return 'Every beat';
  return bs.length === 1
    ? `Beat ${lab(bs[0]!)}`
    : `Beats ${lab(bs[0]!)}–${lab(bs[bs.length - 1]!)}`;
}

export function paintSubdivision(beats: number[], d = uiState().brush): void {
  const before = doc();
  const todo = beats.filter((b) => before.meter.subdivision[b] !== d);
  if (!todo.length) return;
  const r = E.setSubdivision(before, todo, d);
  const range = beatRange(todo, before.meter);
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

/* ------------------------------------------------------------------ line breaks */

/** Enter: start a new score row at pulse k, or join the rows if there is a break there. */
export function toggleLineBreak(k: number): void {
  const had = E.hasBreakAt(doc(), k);
  const r = E.toggleBreak(doc(), k);
  if (!r.report.ok) {
    sfx.nope();
    return void toast('A line break needs to be inside the piece');
  }
  run(r, { label: had ? 'join rows' : 'line break', select: 'keep' });
  announce(had ? 'Rows joined' : 'New row starts here');
}

export function clearBreaks(): void {
  const d = doc();
  if (!d.meter.breaks?.length) return;
  const { breaks: _b, ...meter } = d.meter;
  void _b;
  if (run({ doc: { ...d, meter }, report: E.report() }, { label: 'join rows', select: 'keep' }))
    toast('All line breaks removed', { undo: true });
}

/** P: mark (or unmark) the start of a phrase at pulse k. */
export function togglePhraseMark(k: number): void {
  const had = E.hasMarkAt(doc(), k);
  const r = E.toggleMark(doc(), k);
  if (!r.report.ok) {
    sfx.nope();
    return void toast('A phrase mark needs to be inside the piece');
  }
  run(r, { label: had ? 'unmark phrase' : 'phrase mark', select: 'keep' });
  announce(had ? 'Phrase mark removed' : 'Phrase starts here');
}

/** Name the phrase mark at pulse k ('' = no name), adding the mark if there is none. */
export function nameMarkAt(k: number, name: string): boolean {
  const r = E.nameMark(doc(), k, name);
  if (!r.report.ok) return r.report.reason === 'no-change';
  run(r, { label: name.trim() ? `name phrase "${name.trim()}"` : 'unname phrase', select: 'keep' });
  announce(name.trim() ? `Phrase mark: ${name.trim()}` : 'Phrase mark without a name');
  return true;
}

/**
 * G: show the total number of pulses of a region (the selected groups or a range) as a bracket
 * under the score, or remove the one over exactly that region.
 */
export function toggleTotalOver(region: { a: number; b: number } | null): void {
  if (!region || region.b <= region.a) {
    sfx.nope();
    return void toast('Select the groups (or a range) to show their total');
  }
  const had = E.totalIndex(doc(), region.a, region.b) >= 0;
  const r = E.toggleTotal(doc(), region.a, region.b);
  if (!r.report.ok) return void sfx.nope();
  run(r, { label: had ? 'remove total' : `total ${region.b - region.a}`, select: 'keep' });
  announce(had ? 'Total removed' : `Total: ${region.b - region.a} pulses`);
}

/* ------------------------------------------------------------------ bars before the beginning */

/** Add a bar before the beginning, as open space to write an opening in; the caret goes there. */
export function addBarAtStart(): void {
  const r = E.prependBars(doc(), 1);
  if (!r.report.ok) {
    sfx.nope();
    return void toast(`A piece can have at most ${E.MAX_CYCLES} bars`);
  }
  if (!run(r, { label: 'bar at the start', select: 'none' })) return;
  setUi({ caret: 0, range: null, rangeAnchor: null });
  const silenced = r.report.created.length > 0;
  toast(
    `A bar was added at the start, open to write in.${
      silenced ? ' The open space that was left became silence.' : ''
    }`,
    { undo: true },
  );
  announce('Bar added at the start. The caret is at the very beginning.');
}

/** Add a bar after the end, as open space to go on writing; the caret goes to its start. */
export function addBarAtEnd(): void {
  const before = doc();
  const r = E.appendBars(before, 1);
  if (!r.report.ok) {
    sfx.nope();
    return void toast(`A piece can have at most ${E.MAX_CYCLES} bars`);
  }
  if (!run(r, { label: 'bar at the end', select: 'none' })) return;
  setUi({ caret: E.buildGrid(before.meter).TS, range: null, rangeAnchor: null });
  const silenced = r.report.created.length > 0;
  toast(
    `A bar was added at the end, open to write in.${
      silenced ? ' The open space that was left became silence.' : ''
    }`,
    { undo: true },
  );
  announce('Bar added at the end. The caret is where it begins.');
}

/* ------------------------------------------------------------------ repeats and endings */

/** [ : a start-repeat sign |: at pulse k, or remove it. */
export function toggleRepeatStartAt(k: number): void {
  const had = E.repeatStartAt(doc(), k);
  const r = E.toggleRepeatStart(doc(), k);
  if (!r.report.ok) {
    sfx.nope();
    return void toast('A start repeat needs music after it: not at the very end');
  }
  run(r, { label: had ? 'remove |:' : 'start repeat |:', select: 'keep' });
  announce(had ? 'Start repeat removed' : 'Start repeat here');
}

/** ] : an end-repeat sign :| at pulse k (played twice), or remove it. */
export function toggleRepeatEndAt(k: number): void {
  const had = E.repeatEndAt(doc(), k);
  const r = E.toggleRepeatEnd(doc(), k);
  if (!r.report.ok) {
    sfx.nope();
    return void toast('An end repeat needs music before it: not at the very start');
  }
  run(r, { label: had ? 'remove :|' : 'end repeat :|', select: 'keep' });
  announce(had ? 'End repeat removed' : 'End repeat here: the passage plays twice');
}

/** Play the passage that ends at pulse k one time more or less (2…12 times in all). */
export function changeRepeatTimes(k: number, delta: number): void {
  const cur = E.repeatEndAt(doc(), k);
  if (!cur) return void sfx.nope();
  const times = cur.times + delta;
  if (times < E.MIN_REPEAT || times > E.MAX_REPEAT) return void sfx.nope();
  if (run(E.setRepeatTimes(doc(), k, times), { label: `×${times}`, select: 'keep' }))
    announce(`The passage plays ${times} times`);
}

/** V / "Ending…": open the endings dialog for a pulse region, or for an existing ending. */
export function openVolta(region: { a: number; b: number } | null): void {
  if (!region || region.b <= region.a) {
    sfx.nope();
    return void toast('Select the bars of the ending first: tiles, or a range (⇧ arrows)');
  }
  const grid = E.buildGrid(doc().meter);
  const a = grid.times[region.a]!;
  const b = grid.times[region.b]!;
  // an ending that covers the same stretch opens for editing
  const index = (doc().meter.voltas ?? []).findIndex(
    (v) => Math.abs(v.a - a) < E.EPS && Math.abs(v.b - b) < E.EPS,
  );
  setUi({ voltaDialog: index >= 0 ? { index } : { ka: region.a, kb: region.b } });
}

export function saveVolta(ka: number, kb: number, passes: readonly number[]): boolean {
  const label = E.passesLabel(passes);
  const r = E.setVolta(doc(), ka, kb, passes);
  if (!run(r, { label: `ending ${label}`, select: 'keep' })) return false;
  announce(`Ending ${label}`);
  return true;
}

export function removeVoltaAt(index: number): void {
  if (run(E.removeVolta(doc(), index), { label: 'remove ending', select: 'keep' }))
    announce('Ending removed');
}

/* ------------------------------------------------------------------ metric modulation */

export function modulate(at: number, spec: E.SectionSpec): boolean {
  const r = E.addSection(doc(), at, spec);
  if (!r.report.ok) {
    sfx.nope();
    toast('A modulation needs a beat line inside the piece, where none starts yet');
    return false;
  }
  if (!run(r, { label: `${spec.from}:1 = ${spec.to}:1`, select: 'keep' })) return false;
  announce(
    `Modulation ${spec.from} to 1 equals ${spec.to} to 1, ${spec.beatsPerBar} beats per bar`,
  );
  return true;
}

export function editModulation(index: number, spec: E.SectionSpec): boolean {
  const r = E.updateSection(doc(), index, spec);
  if (r.report.reason === 'no-change') return true;
  return run(r, { label: `${spec.from}:1 = ${spec.to}:1`, select: 'keep' });
}

export function removeModulation(index: number): void {
  if (run(E.removeSection(doc(), index), { label: 'remove modulation', select: 'keep' }))
    toast('Modulation removed', { undo: true });
}

/** Add (n > 0) or cut whole beats at the end of the last section, e.g. to land on a main 1. */
export function adjustEnd(n: number): void {
  const r = E.resizeBeats(doc(), n, uiState().brush);
  if (run(r, { label: `${n > 0 ? '+' : ''}${n} beats`, select: 'keep' }))
    announce(E.landing(r.doc.meter).lands ? 'Lands on 1 of the main tempo' : `${n} beats`);
}

/** Open the modulation dialog for pulse k: edit the modulation that starts there, or add one on
 * that beat line. */
export function openModulation(k: number): void {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  const b = E.beatOfPulse(grid, Math.min(k, grid.TS - 1));
  if (grid.pre[b] !== k || b === 0) {
    sfx.nope();
    return void toast('Put the caret on a beat line (not the very start) to modulate there');
  }
  const index = (d.meter.sections ?? []).findIndex((s) => s.at === b);
  setUi({ modDialog: index >= 0 ? { index } : { at: b } });
}

/* ------------------------------------------------------------------ bars, metre, rows, start */

/** Add `n` empty bars before bar `atBar` (0-based; the bar count = after the last). */
export function addBars(atBar: number, n: number): boolean {
  const before = doc();
  const nBars = E.barMap(before.meter).barStarts.length;
  // at the very start or end the new bars are the open space, ready to write in
  const r =
    atBar <= 0
      ? E.prependBars(before, n)
      : atBar >= nBars
        ? E.appendBars(before, n)
        : E.insertBars(before, atBar, n);
  if (!r.report.ok) {
    sfx.nope();
    toast('The piece cannot have that many bars');
    return false;
  }
  if (!run(r, { label: `+${plural(n, 'bar')}`, select: 'none' })) return false;
  const map = E.barMap(before.meter);
  const at = map.barStarts[atBar] ?? map.NB;
  setUi({ caret: E.buildGrid(before.meter).pre[at] ?? 0, range: null, rangeAnchor: null });
  toast(`${plural(n, 'bar')} added`, { undo: true });
  return true;
}

/** The bars (0-based, first to last) that hold pulses [ka, kb) (or the pulse ka). */
export function barsOfPulses(ka: number, kb = ka + 1): { a: number; b: number } {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  const map = E.barMap(d.meter);
  const bar = (k: number) =>
    map.barOf[E.beatOfPulse(grid, E.clamp(k, 0, grid.TS - 1))] ?? map.barStarts.length - 1;
  return { a: bar(ka), b: bar(Math.max(ka, kb - 1)) };
}

/** The bars under the selected groups, the range or the caret; null = nothing is pointed at. */
export function barsHere(): { a: number; b: number } | null {
  const s = uiState();
  const region = s.range ?? E.spanOf(doc(), s.selection);
  if (region) return barsOfPulses(region.a, region.b);
  return s.caret === null ? null : barsOfPulses(s.caret);
}

/** The pulses [a, b) of bars `a`..`b` (0-based, both included). */
export function pulsesOfBars(a: number, b = a): { a: number; b: number } {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  const map = E.barMap(d.meter);
  return {
    a: grid.pre[map.barStarts[a] ?? 0] ?? 0,
    b: grid.pre[map.barStarts[b + 1] ?? map.NB] ?? grid.TS,
  };
}

/** The selected range, when it is exactly whole bars: those bars. */
export function wholeBars(): { a: number; b: number } | null {
  const r = uiState().range;
  if (!r) return null;
  const bars = barsOfPulses(r.a, r.b);
  const p = pulsesOfBars(bars.a, bars.b);
  return p.a === r.a && p.b === r.b ? bars : null;
}

export const barsLabel = (a: number, b: number) =>
  a === b ? `bar ${a + 1}` : `bars ${a + 1}–${b + 1}`;

/** Select bars `a`..`b` (0-based) as a range: what Delete bars, Copy, Fill… then work on. */
export function selectBars(a: number, b = a): void {
  const p = pulsesOfBars(a, b);
  setUi({
    range: p,
    rangeAnchor: p.a,
    caret: p.b,
    selection: [],
    anchor: null,
    multi: false,
  });
  announce(`Selected ${barsLabel(a, b)}`);
}

/**
 * Remove the bars under the selection, the range or the caret, with what is in them (⇧⌫):
 * the time itself goes, and what comes after moves up.
 */
export function deleteBarsHere(): boolean {
  const bars = barsHere();
  if (!bars) {
    sfx.nope();
    toast('Put the caret in a bar, or select bars, to remove them');
    return false;
  }
  return cutBars(bars.a, bars.b - bars.a + 1);
}

/** Remove `count` bars from bar `fromBar` (0-based), with what is in them. */
export function cutBars(fromBar: number, count: number): boolean {
  const r = E.removeBars(doc(), fromBar, count);
  if (!r.report.ok) {
    sfx.nope();
    toast(r.report.reason === 'too-small' ? 'A piece keeps at least one bar' : 'No such bars');
    return false;
  }
  if (!run(r, { label: `−${plural(count, 'bar')}`, select: 'none', sound: sfx.remove }))
    return false;
  const gone = r.report.removed.length;
  // the caret stands where the bars were, so "what now" is in sight
  const after = E.barMap(r.doc.meter);
  const grid = E.buildGrid(r.doc.meter);
  setUi({
    caret: grid.pre[after.barStarts[fromBar] ?? after.NB] ?? grid.TS,
    range: null,
    rangeAnchor: null,
    doomed: null,
  });
  const name = count === 1 ? `Bar ${fromBar + 1}` : `Bars ${fromBar + 1}–${fromBar + count}`;
  toast(`${name} removed${gone ? `, with ${plural(gone, 'group')}` : ''}`, {
    undo: true,
  });
  return true;
}

/** The bars from beat `at` on (0 = the whole piece) follow this pattern; the tempo stays. */
export function changeMetre(at: number, pattern: readonly number[]): boolean {
  const r = E.setBars(doc(), at, pattern);
  if (r.report.reason === 'no-change') return true;
  if (!r.report.ok) {
    sfx.nope();
    toast('That would make more bars than a piece can have');
    return false;
  }
  if (!run(r, { label: `bars of ${E.patternLabel(pattern)}`, select: 'keep' })) return false;
  announce(`Bars of ${pattern.join(', ')} from here`);
  return true;
}

/** How many bars the row that starts at beat-time `a` holds: this row only (up to `b`), or on. */
export function setRowBars(a: number, per: number, b: number | null): boolean {
  const r = E.setRowSize(doc(), a, per, b);
  if (r.report.reason === 'no-change') return true;
  if (!run(r, { label: per ? `row of ${per}` : 'row by the zoom', select: 'keep' })) return false;
  announce(per ? `${plural(per, 'bar')} in this row` : 'This row follows the zoom');
  return true;
}

export function clearRowBars(): void {
  if (run(E.clearRowSizes(doc()), { label: 'rows by the zoom', select: 'keep', quiet: true }))
    toast('Every row follows the zoom again', { undo: true });
}

/** Play starts at pulse k (null or 0 = from the top). */
export function setPlayStart(k: number | null): void {
  const grid = E.buildGrid(doc().meter);
  const t = k === null || k <= 0 || k >= grid.TS ? null : grid.times[k]!;
  setUi({ playStart: t });
  announce(t === null ? 'Play starts from the top' : `Play starts at ${barLabel(t)}`);
}

/** Play starts at the first beat of bar `bar` (0-based). */
export function setPlayStartBar(bar: number): void {
  const map = E.barMap(doc().meter);
  const t = map.barStarts[bar];
  setUi({ playStart: !t ? null : t });
  announce(!t ? 'Play starts from the top' : `Play starts at bar ${bar + 1}`);
}

const barLabel = (t: number) => {
  const bb = E.barBeat(doc().meter, Math.floor(t + E.EPS));
  return `bar ${bb.bar}, beat ${bb.beat}`;
};
