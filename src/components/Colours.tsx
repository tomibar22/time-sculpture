import { TILE_PALETTES, sizeColor } from '../score/colors';
import { useUiStore } from '../state/store';

/** The tile palette (a device preference); one tile's own colour is H / "Random colour". */
export function Colours() {
  const palette = useUiStore((s) => s.palette);
  const set = useUiStore((s) => s.set);
  return (
    <details className="disclosure">
      <summary>Colours</summary>
      <div className="dbody">
        <fieldset className="palettes">
          <legend className="sr-only">Tile colours</legend>
          {TILE_PALETTES.map((p) => (
            <label key={p.id} className="opt palette">
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={palette === p.id}
                onChange={() => set({ palette: p.id })}
              />
              <span className="palette-name">{p.name}</span>
              <span className="palette-swatches" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} style={{ background: sizeColor(i + 1, p.colors) }} />
                ))}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="hist">
          One tile its own colour: select it, then H or “Random colour” (⇧H gives back its size’s
          colour).
        </p>
      </div>
    </details>
  );
}
