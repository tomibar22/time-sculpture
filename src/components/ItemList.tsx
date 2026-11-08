import * as E from '../engine';
import { select } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

/**
 * A visually hidden, focusable list mirroring the items, so screen readers and keyboards can
 * select groups and act on them with the selection bar or the shortcut keys.
 */
export function ItemList() {
  const doc = useDocStore((s) => s.doc);
  const selection = useUiStore((s) => s.selection);
  const set = useUiStore((s) => s.set);
  const si = E.spaceIndex(doc.items);
  let a = 0;
  const grid = E.buildGrid(doc.meter);
  const where = (k: number) => {
    const bb = E.barBeat(doc.meter, E.beatOfPulse(grid, Math.min(k, grid.TS - 1)));
    return `bar ${bb.bar}, beat ${bb.beat}`;
  };
  return (
    <ul className="sr-only item-list" aria-label="Groups in order">
      {doc.items.map((x, i) => {
        const start = a;
        a += x.n;
        if (E.isSpace(x))
          return (
            <li key={x.id} tabIndex={-1}>
              Open space of {x.n} pulses
            </li>
          );
        const sel = selection.includes(x.id);
        return (
          <li key={x.id}>
            <button
              type="button"
              aria-pressed={sel}
              onFocus={() => set({ focusedId: x.id })}
              onBlur={() => set({ focusedId: null })}
              onClick={(e) => select(x.id, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey })}
            >
              {x.kind === 'rest' ? 'Silence' : 'Sound'} of {x.n} pulses,{' '}
              {i < si ? 'start' : 'ending'}, from {where(start)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
