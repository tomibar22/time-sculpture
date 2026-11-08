import { useRef } from 'react';
import * as E from '../engine';
import { fillRandomly } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** "Fill randomly…": choose which tile sizes may be used, then fill the open space with them. */
export function FillDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const sizes = useUiStore((s) => s.fillSizes);
  const set = useUiStore((s) => s.set);
  const open = useDocStore((s) => E.freePulses(s.doc));
  const ways = sizes.length ? E.countWays(open, sizes) : 0n;
  const toggle = (n: number) =>
    set({
      fillSizes: sizes.includes(n)
        ? sizes.filter((x) => x !== n)
        : [...sizes, n].sort((a, b) => a - b),
    });

  return (
    <>
      <button type="button" className="link-btn" onClick={() => dialog.current?.showModal()}>
        Fill randomly…
      </button>
      <dialog
        ref={dialog}
        className="library"
        aria-labelledby="fill-h"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="lib-inner">
          <div className="lib-head">
            <h2 id="fill-h">Fill randomly</h2>
            <button type="button" className="ghost" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <p className="rows-hint">
            Choose the tile sizes that may be used. The {open} open pulses are filled with a random
            mix of them, every possible combination equally likely.
          </p>
          <div className="fill-sizes" role="group" aria-label="Tile sizes">
            {SIZES.map((n) => {
              const on = sizes.includes(n);
              const col = sizeColor(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  data-testid={`fill-${n}`}
                  style={on ? { background: col, color: inkFor(col) } : undefined}
                  onClick={() => toggle(n)}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="lib-note" aria-live="polite">
            {!sizes.length
              ? 'Pick at least one size.'
              : ways === 0n
                ? `These sizes can't fill ${open} exactly.`
                : `${ways.toLocaleString('en-US')} possible fill${ways === 1n ? '' : 's'}.`}
          </p>
          <div className="lib-actions">
            <button
              type="button"
              className="primary"
              disabled={!open || ways === 0n}
              onClick={() => {
                if (fillRandomly(sizes)) dialog.current?.close();
              }}
            >
              Fill
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
