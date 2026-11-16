import * as E from '../engine';
import { barsOfPulses } from '../state/actions';
import { closeSubdivision, selectedRegion, setCaret } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { hit, itemAt, L, rowTop, slotAt, tileY, xOf } from './geometry';
import { view } from './view';

/**
 * The context menu's target (right-click, long press, ⇧F10). Like in any editor, pointing at
 * something that is not selected selects it first, so the menu always speaks about what is
 * marked in the score:
 *
 * - the beat numbers (the ruler)        → the bar there
 * - inside the selected range           → the range
 * - a group                             → the selected groups (that group alone if it was not)
 * - open space, a silence, the band     → a caret on the pulse there
 */
export function openMenuAt(clientX: number, clientY: number, touch: boolean): void {
  const { geo: g, canvas } = view;
  const ui = useUiStore.getState();
  if (!g || !canvas || ui.stage || ui.overview) return;
  const box = canvas.getBoundingClientRect();
  const x = clientX - box.left;
  const y = clientY - box.top;
  const doc = useDocStore.getState().doc;
  const h = hit(g, x, y);
  const k = E.clamp(slotAt(g, x, y), 0, g.grid.TS);
  const kf = E.clamp(E.floorPulse(g.grid, h.t), 0, g.grid.TS - 1);
  const inTiles = h.zone === 'tiles' && !h.outside;
  const item = doc.items[itemAt(g, doc.items, x, y)];
  let kind: 'tiles' | 'range' | 'caret' | 'bar';
  if (inTiles && y < rowTop(g, h.r) + L.numH) kind = 'bar';
  else if (inTiles && ui.range && !ui.selection.length && kf >= ui.range.a && kf < ui.range.b)
    kind = 'range';
  else if (item && item.kind === 'sound') {
    if (!ui.selection.includes(item.id))
      ui.set({
        selection: [item.id],
        anchor: item.id,
        caret: null,
        range: null,
        rangeAnchor: null,
        multi: false,
      });
    kind = 'tiles';
  } else {
    setCaret(k, { quiet: true });
    kind = 'caret';
  }
  if (ui.beatSel || ui.subPanel) closeSubdivision();
  ui.set({ menu: { x: clientX, y: clientY, kind, bar: barsOfPulses(kf).a, k, touch } });
}

/** The same menu from the keyboard (⇧F10, the Menu key): for what is selected, or the caret. */
export function openMenuAtSelection(): void {
  const { geo: g, canvas } = view;
  const ui = useUiStore.getState();
  if (!g || !canvas || ui.stage || ui.overview) return;
  const region = selectedRegion();
  const k = region ? region.a : (ui.caret ?? E.spaceRange(useDocStore.getState().doc).a);
  if (!region && ui.caret === null) setCaret(k, { quiet: true });
  const kf = E.clamp(k, 0, g.grid.TS - 1);
  const p = xOf(g, g.grid.times[kf]!);
  const box = canvas.getBoundingClientRect();
  ui.set({
    menu: {
      x: box.left + p.x + 8,
      y: box.top + tileY(g, p.r) + L.tileH + 6,
      kind: ui.selection.length ? 'tiles' : ui.range ? 'range' : 'caret',
      bar: barsOfPulses(kf).a,
      k,
      touch: false,
    },
  });
}
