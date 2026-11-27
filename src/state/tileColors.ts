import * as E from '../engine';
import type { ItemId } from '../engine';
import { ui as sfx } from '../audio/voices';
import { randomTileColor } from '../score/colors';
import { toast } from './actions';
import { useDocStore, useUiStore } from './store';

/* A tile's own colour: a random one over its size's colour (user request), or back to it. */

const doc = () => useDocStore.getState().doc;
const ui = () => useUiStore.getState();

/** The sounding groups to colour: the selection, else those beginning in the range, else the
 * one ending at the caret (just written), else the one the caret is in. */
export function colorTargets(): ItemId[] {
  const s = ui();
  const d = doc();
  const out: ItemId[] = [];
  let at = 0;
  let ends: ItemId | null = null;
  let holds: ItemId | null = null;
  const k = s.caret ?? E.spaceRange(d).a;
  for (const x of d.items) {
    if (x.kind === 'sound') {
      if (
        s.selection.length
          ? s.selection.includes(x.id)
          : s.range && at >= s.range.a && at < s.range.b
      )
        out.push(x.id);
      if (at + x.n === k) ends = x.id;
      if (at <= k && k < at + x.n) holds = x.id;
    }
    at += x.n;
  }
  if (out.length || s.selection.length || s.range) return out;
  const one = ends ?? holds;
  return one ? [one] : [];
}

/** Does any tile here have a colour of its own? */
export function hasOwnColor(ids: readonly ItemId[] = colorTargets()): boolean {
  const c = doc().colors;
  return !!c && ids.some((id) => !!c[id]);
}

/** Give each tile here a new random colour (one undo step). */
export function randomColor(): void {
  const ids = colorTargets();
  if (!ids.length) {
    sfx.nope();
    return toast('Select a tile (or put the caret after one) to give it a new colour');
  }
  const d = doc();
  const next = E.setColors(d, ids, () => randomTileColor());
  if (next !== d) useDocStore.getState().commit(next, 'colour');
}

/** Back to the colour of the tile's size. */
export function resetColor(): void {
  const ids = colorTargets();
  const d = doc();
  const next = E.setColors(d, ids, () => null);
  if (next === d) return void toast('These tiles already have their size’s colour');
  useDocStore.getState().commit(next, 'colour reset');
}
