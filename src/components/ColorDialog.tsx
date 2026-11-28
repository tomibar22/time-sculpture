import { useEffect, useRef } from 'react';
import { TILE_PALETTES, sizeColor } from '../score/colors';
import { useDocStore, useUiStore } from '../state/store';
import {
  colorTargets,
  hasOwnColor,
  paintColor,
  randomColor,
  resetColor,
  sharedColor,
} from '../state/tileColors';

/**
 * A tile's own colour, chosen (user request: not only a random one): the colours of the palette
 * in use, the other palettes folded, any colour at all (the system picker), Random, and back to
 * the size's colour. Every pick is applied at once (one undo step each), so it is seen in the
 * score; Done closes. Opened by "Colour…" (tile bar's More, the menus) or ⌥H.
 */
export function ColorDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useUiStore((s) => s.colorDialog);
  const palette = useUiStore((s) => s.palette);
  const set = useUiStore((s) => s.set);
  useDocStore((s) => s.doc); // re-render on every change, so the current colour is marked
  const current = open ? sharedColor() : null;
  const count = open ? colorTargets().length : 0;
  const own = open && hasOwnColor();

  useEffect(() => {
    if (!open) return dialog.current?.close();
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  const close = () => set({ colorDialog: false });
  const active = TILE_PALETTES.find((p) => p.id === palette) ?? TILE_PALETTES[0]!;
  const others = TILE_PALETTES.filter((p) => p !== active);
  const swatches = (colors: readonly string[], name: string) => (
    <div className="color-swatches" role="group" aria-label={name}>
      {Array.from({ length: 12 }, (_, i) => {
        const c = sizeColor(i + 1, colors).toLowerCase();
        return (
          <button
            key={i}
            type="button"
            className="color-swatch"
            style={{ background: c }}
            aria-pressed={current === c}
            title={c}
            onClick={() => paintColor(c)}
          >
            <span className="sr-only">
              {name} colour {i + 1} ({c})
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <dialog
      ref={dialog}
      className="library"
      aria-labelledby="color-h"
      // a close event comes a moment late: one from closing before must not shut it opened again
      onClose={() => !dialog.current?.open && useUiStore.getState().colorDialog && close()}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="lib-inner">
        <div className="lib-head">
          <h2 id="color-h">Colour</h2>
          <button type="button" className="ghost" onClick={close}>
            Done
          </button>
        </div>
        <p className="rows-hint">
          {count === 1 ? 'For the tile.' : `For ${count} tiles.`} A tap colours it.
        </p>
        {swatches(active.colors, active.name)}
        <details className="disclosure color-more">
          <summary>More colours</summary>
          <div className="dbody">
            {others.map((p) => (
              <div key={p.id} className="color-row">
                <span className="color-row-name">{p.name}</span>
                {swatches(p.colors, p.name)}
              </div>
            ))}
          </div>
        </details>
        <div className="lib-actions">
          <label className="color-any">
            <input
              type="color"
              data-testid="color-any"
              value={current ?? '#808080'}
              onChange={(e) => paintColor(e.target.value)}
            />
            <span>Any colour…</span>
          </label>
          <button type="button" onClick={randomColor}>
            Random
          </button>
          {own && (
            <button type="button" onClick={resetColor}>
              Size colour
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
