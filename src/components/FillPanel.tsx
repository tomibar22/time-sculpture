import { useMemo, useState } from 'react';
import * as E from '../engine';
import type { FillOption } from '../engine';
import {
  closeFill,
  describeRegion,
  fillRandom,
  fillRegion,
  fillWith,
  previewFill,
} from '../state/fill';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const LIMIT = 400;

/** A small picture of a fill: one coloured bar per tile, widths in proportion. */
function Strip({ sizes }: { sizes: number[] }) {
  return (
    <span className="strip" aria-hidden="true">
      {sizes.map((n, i) => (
        <span
          key={i}
          style={{ flexGrow: n, background: sizeColor(n), color: inkFor(sizeColor(n)) }}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

/** Docked panel for filling the selected region (or the open space) randomly or by browsing. */
export function FillPanel() {
  const tab = useUiStore((s) => s.fillPanel);
  const sizes = useUiStore((s) => s.fillSizes);
  const sort = useUiStore((s) => s.fillSort);
  const shape = useUiStore((s) => s.fillShape);
  const set = useUiStore((s) => s.set);
  // re-read the region whenever the document or the selection changes
  useDocStore((s) => s.version);
  useUiStore((s) => s.range);
  useUiStore((s) => s.selection);
  const meter = useDocStore((s) => s.doc.meter);
  const region = fillRegion();
  const [picked, setPicked] = useState<string | null>(null);

  const R = region ? region.b - region.a : 0;
  const { options, total } = useMemo(
    () => (region ? E.fillOptions(meter, region.a, R, sizes, LIMIT) : { options: [], total: 0n }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meter, region?.a, R, sizes.join(',')],
  );
  const sorted = useMemo(() => {
    if (shape === 'any') return E.sortFills(options, sort);
    const shaped = options.filter(
      (o) => o.shape && (shape === 'shapes' || o.shape.family === shape),
    );
    return shaped.sort(
      (a, b) =>
        E.shapeRank(a.shape!.family) - E.shapeRank(b.shape!.family) ||
        a.tiles - b.tiles ||
        a.key.localeCompare(b.key),
    );
  }, [options, sort, shape]);
  const families = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of options) if (o.shape) n.set(o.shape.family, (n.get(o.shape.family) ?? 0) + 1);
    return n;
  }, [options]);
  if (!tab) return null;

  const toggle = (n: number) =>
    set({
      fillSizes: sizes.includes(n)
        ? sizes.filter((x) => x !== n)
        : [...sizes, n].sort((a, b) => a - b),
    });
  const where = region
    ? region.kind === 'space'
      ? `the open space (${describeRegion(region.a, region.b)})`
      : `${describeRegion(region.a, region.b)} · ${describePulse(region.a)}`
    : 'nothing selected';
  const count = total.toLocaleString('en-US');

  return (
    <section className="fillpanel" aria-label="Fill">
      <div className="fill-head">
        <div className="segs text" role="group" aria-label="Fill mode">
          <button
            type="button"
            aria-pressed={tab === 'random'}
            onClick={() => set({ fillPanel: 'random' })}
          >
            Random
          </button>
          <button
            type="button"
            aria-pressed={tab === 'browse'}
            onClick={() => set({ fillPanel: 'browse' })}
          >
            Browse
          </button>
        </div>
        <span className="fill-where">Fill {where}</span>
        <button
          type="button"
          className="ghost icon"
          aria-label="Close"
          title="Close"
          onClick={closeFill}
        >
          ✕
        </button>
      </div>
      <div className="fill-sizes" role="group" aria-label="Tile sizes to use">
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
      {!region || !sizes.length ? (
        <p className="lib-note">
          {!sizes.length ? 'Pick at least one size.' : 'Select a region to fill.'}
        </p>
      ) : total === 0n ? (
        <p className="lib-note">These sizes can&apos;t fill {R} pulses exactly.</p>
      ) : tab === 'random' ? (
        <div className="fill-random">
          <p className="lib-note">
            {count} possible fill{total === 1n ? '' : 's'}, each equally likely.
          </p>
          <button type="button" className="primary" onClick={fillRandom}>
            Fill
          </button>
        </div>
      ) : (
        <div className="fill-browse">
          <div className="fill-shapes" role="group" aria-label="Shapes">
            <button
              type="button"
              aria-pressed={shape === 'shapes'}
              onClick={() => set({ fillShape: 'shapes' })}
            >
              ✦ All shapes
            </button>
            {E.SHAPE_FAMILIES.filter((f) => families.get(f.id)).map((f) => (
              <button
                key={f.id}
                type="button"
                title={f.hint}
                aria-pressed={shape === f.id}
                onClick={() => set({ fillShape: f.id })}
              >
                {f.label} <span className="fill-count">{families.get(f.id)}</span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={shape === 'any'}
              onClick={() => set({ fillShape: 'any' })}
            >
              Anything
            </button>
          </div>
          <div className="fill-sort">
            {shape === 'any' ? (
              <>
                <label htmlFor="fill-sort">Sort</label>
                <select
                  id="fill-sort"
                  value={sort}
                  onChange={(e) => set({ fillSort: e.target.value as E.FillSort })}
                >
                  {E.FILL_SORTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="lib-note">
                  {total > BigInt(LIMIT)
                    ? `${LIMIT} of ${count}, picked at random`
                    : `all ${count}`}
                </span>
              </>
            ) : (
              <span className="lib-note">
                {sorted.length
                  ? (E.SHAPE_FAMILIES.find((f) => f.id === shape)?.hint ??
                    `${sorted.length} shaped fills`)
                  : 'No shapes fit these sizes; try more sizes or Anything.'}
              </span>
            )}
            <button
              type="button"
              className="fill-dice"
              disabled={!sorted.length}
              onClick={() => {
                const o = sorted[Math.floor(Math.random() * sorted.length)]!;
                setPicked(o.key);
                fillWith(o);
              }}
            >
              🎲 Surprise
            </button>
          </div>
          <ul
            className="fill-list"
            aria-label="Ways to fill"
            onMouseLeave={() => previewFill(null)}
          >
            {sorted.map((o: FillOption) => (
              <li key={o.key}>
                <button
                  type="button"
                  aria-pressed={picked === o.key}
                  onMouseEnter={() => previewFill(o)}
                  onFocus={() => previewFill(o)}
                  onBlur={() => previewFill(null)}
                  onClick={() => {
                    setPicked(o.key);
                    fillWith(o);
                  }}
                >
                  <Strip sizes={o.sizes} />
                  <span className="fill-meta">
                    {o.shape && shape !== 'any'
                      ? o.shape.label
                      : `${o.tiles} tiles · ${o.onBeat} on the beat`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
