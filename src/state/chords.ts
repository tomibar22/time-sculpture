import * as E from '../engine';
import type { ItemId } from '../engine';
import { ui as sfx } from '../audio/voices';
import { toast } from './actions';
import { useDocStore, useUiStore } from './store';

/* Chord symbols over the tiles (free text for now): which tile, writing one, going on to the
   next tile so a whole progression is typed in one go. */

const doc = () => useDocStore.getState().doc;
const ui = () => useUiStore.getState();

/** The sounding groups in order, with where each begins. */
function soundGroups(): { id: ItemId; at: number; n: number }[] {
  const out: { id: ItemId; at: number; n: number }[] = [];
  let at = 0;
  for (const x of doc().items) {
    if (x.kind === 'sound') out.push({ id: x.id, at, n: x.n });
    at += x.n;
  }
  return out;
}

/**
 * The group a chord goes on: the first selected sounding group, else the first one that begins
 * in the range, else the one that ends at the caret (just written), else the one the caret is in.
 */
export function chordTarget(): ItemId | null {
  const s = ui();
  const groups = soundGroups();
  const sel = groups.find((g) => s.selection.includes(g.id));
  if (sel) return sel.id;
  if (s.range) return groups.find((g) => g.at >= s.range!.a && g.at < s.range!.b)?.id ?? null;
  const k = s.caret ?? E.spaceRange(doc()).a;
  return (
    groups.find((g) => g.at + g.n === k)?.id ??
    groups.find((g) => g.at <= k && k < g.at + g.n)?.id ??
    null
  );
}

/** Open the chord dialog for the group here (C, "Chord", the menus). */
export function openChord(id: ItemId | null = chordTarget()): void {
  if (!id) {
    sfx.nope();
    return toast('Select a tile (or put the caret after one) to write a chord on it');
  }
  ui().set({ chordDialog: { id } });
}

/** Write the chord over a group (one undo step); '' removes it. */
export function writeChord(id: ItemId, text: string): void {
  const d = doc();
  const next = E.setChord(d, id, text);
  if (next === d) return;
  useDocStore.getState().commit(next, text.trim() ? `chord ${text.trim()}` : 'chord removed');
}

/** The sounding group before / after this one (for typing a progression), or null. */
export function neighbourGroup(id: ItemId, dir: -1 | 1): ItemId | null {
  const groups = soundGroups();
  const i = groups.findIndex((g) => g.id === id);
  return i < 0 ? null : (groups[i + dir]?.id ?? null);
}

/** "the 5 at bar 1, beat 2" for the dialog's head. */
export function groupWhere(id: ItemId): { n: number; at: number } | null {
  return soundGroups().find((g) => g.id === id) ?? null;
}
