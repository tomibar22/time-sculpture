import { useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import type { FillOption } from '../engine';
import {
  closeFill,
  describeRegion,
  fillRandom,
  fillRegion,
  fillSizes,
  fillWith,
  previewFill,
  previewSizes,
  toggleListen,
  toggleMotif,
} from '../state/fill';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Contour, Heart, Strip, useRegionBeats } from './fillParts';
import { FillMap } from './FillMap';
import { VaryPanel } from './VaryPanel';

export { Strip } from './fillParts';

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const LIMIT = 400;

/** A fill with a note on where it came from (a kept motif fitted here, a bred child). */
type Listed = FillOption & { note?: string };

/** Docked panel for filling the selected region (or the open space) randomly or by browsing. */
export function FillPanel() {
  const tab = useUiStore((s) => s.fillPanel);
  const sizes = useUiStore((s) => s.fillSizes);
  const playing = useUiStore((s) => s.playing);
  const set = useUiStore((s) => s.set);
  // re-read the region whenever the document or the selection changes
  useDocStore((s) => s.version);
  useUiStore((s) => s.range);
  useUiStore((s) => s.selection);
  const region = fillRegion();
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
  const R = region ? region.b - region.a : 0;
  const total = region && sizes.length ? E.countWays(R, sizes) : 0n;

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
          {region?.kind === 'selection' && (
            <button
              type="button"
              aria-pressed={tab === 'vary'}
              title="The same passage said another way"
              onClick={() => set({ fillPanel: 'vary' })}
            >
              Vary
            </button>
          )}
        </div>
        <span className="fill-where">
          {tab === 'vary' ? 'Vary' : 'Fill'} {where}
        </span>
        {region && (
          <button
            type="button"
            className="ghost icon fill-listen"
            aria-pressed={playing}
            title={
              playing
                ? 'Stop listening'
                : 'Listen: loop this stretch, and hear every fill you try in it'
            }
            onClick={toggleListen}
          >
            <span aria-hidden="true">🎧</span>
            <span className="sr-only">Listen</span>
          </button>
        )}
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
      {tab === 'vary' ? (
        <VaryPanel />
      ) : (
        <>
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
                {total.toLocaleString('en-US')} possible fill{total === 1n ? '' : 's'}, each equally
                likely.
              </p>
              <button type="button" className="primary" onClick={fillRandom}>
                Fill
              </button>
            </div>
          ) : (
            <Browse />
          )}
        </>
      )}
    </section>
  );
}

function Browse() {
  const sizes = useUiStore((s) => s.fillSizes);
  const sort = useUiStore((s) => s.fillSort);
  const shape = useUiStore((s) => s.fillShape);
  const view = useUiStore((s) => s.fillView);
  const motifs = useUiStore((s) => s.motifs);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const region = fillRegion()!;
  const beats = useRegionBeats();
  const R = region.b - region.a;
  const [picked, setPicked] = useState<string | null>(null);
  /** The fill tried last (hovered, focused, touched on the map): B in an A/B comparison. */
  const [cand, setCand] = useState<Listed | null>(null);
  /** A fill pinned for comparison. */
  const [pin, setPin] = useState<Listed | null>(null);
  const [brood, setBrood] = useState<{ gen: number; kids: Listed[] }>({ gen: 0, kids: [] });

  const { options, total } = useMemo(
    () => E.fillOptions(meter, region.a, R, sizes, LIMIT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meter, region.a, R, sizes.join(',')],
  );
  // kept motifs, fitted to this region (as they are, or cycled until they land)
  const mine = useMemo(() => {
    const seen = new Set<string>();
    const out: Listed[] = [];
    for (const m of motifs) {
      const t = E.fitMotif(m, R);
      if (!t || seen.has(t.join(' '))) continue;
      seen.add(t.join(' '));
      const o: Listed = E.optionOf(meter, region.a, t);
      if (t.join(' ') !== m.join(' ')) o.note = `♥ ${m.join(' ')}, fitted`;
      out.push(o);
    }
    return out;
  }, [motifs, R, meter, region.a]);
  // a new region: start over
  useEffect(() => {
    setBrood({ gen: 0, kids: [] });
    setPin(null);
    setCand(null);
  }, [region.a, R]);
  useEffect(() => {
    if (shape === 'mine' && !mine.length) set({ fillShape: 'shapes' });
    if (shape === 'bred' && !brood.kids.length) set({ fillShape: 'shapes' });
  }, [shape, mine.length, brood.kids.length, set]);

  const families = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of options) if (o.shape) n.set(o.shape.family, (n.get(o.shape.family) ?? 0) + 1);
    return n;
  }, [options]);
  const list: Listed[] = useMemo(() => {
    if (shape === 'mine') return mine;
    if (shape === 'bred') return brood.kids;
    if (shape === 'any') return E.sortFills(options, sort);
    return options
      .filter((o) => o.shape && (shape === 'shapes' || o.shape.family === shape))
      .sort(
        (a, b) =>
          E.shapeRank(a.shape!.family) - E.shapeRank(b.shape!.family) ||
          // within a family, the plain form before its variants (a tihai before a gap tihai)
          Number(a.shape!.label.includes('→')) - Number(b.shape!.label.includes('→')) ||
          a.tiles - b.tiles ||
          a.key.localeCompare(b.key),
      );
  }, [options, sort, shape, mine, brood]);

  const parents = useMemo(() => {
    const ps = new Map<string, number[]>();
    for (const o of [...mine, ...(pin ? [pin] : [])]) ps.set(o.key, o.sizes);
    return [...ps.values()];
  }, [mine, pin]);
  const breedNext = () => {
    const kids = E.breed(parents, sizes, 30).map((k): Listed => ({
      ...E.optionOf(meter, region.a, k.sizes),
      note: k.how,
    }));
    setBrood({ gen: brood.gen + 1, kids });
    set({ fillShape: 'bred' });
  };

  const use = (o: Listed) => {
    setPicked(o.key);
    setCand(o);
    fillWith(o);
  };
  const tryIt = (o: Listed) => {
    setCand(o);
    previewFill(o);
  };
  const hint =
    shape === 'mine'
      ? 'Fills you kept (♥), fitted to this length.'
      : shape === 'bred'
        ? `Generation ${brood.gen}: children of what you kept. ♥ the ones you like, then breed again.`
        : shape === 'any'
          ? null
          : list.length
            ? (E.SHAPE_FAMILIES.find((f) => f.id === shape)?.hint ?? `${list.length} shaped fills`)
            : 'No shapes fit these sizes; try more sizes or Anything.';

  return (
    <div className="fill-browse">
      <div className="fill-shapes" role="group" aria-label="Shapes">
        {mine.length > 0 && (
          <button
            type="button"
            aria-pressed={shape === 'mine'}
            onClick={() => set({ fillShape: 'mine' })}
          >
            ♥ Mine <span className="fill-count">{mine.length}</span>
          </button>
        )}
        {brood.kids.length > 0 && (
          <button
            type="button"
            aria-pressed={shape === 'bred'}
            onClick={() => set({ fillShape: 'bred' })}
          >
            🧬 Generation {brood.gen}
          </button>
        )}
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
        <div className="segs text" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => set({ fillView: 'list' })}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === 'map'}
            onClick={() => set({ fillView: 'map' })}
          >
            Map
          </button>
        </div>
        {shape === 'any' && view === 'list' && (
          <>
            <label htmlFor="fill-sort" className="sr-only">
              Sort
            </label>
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
          </>
        )}
        <span className="fill-tools">
          <button
            type="button"
            className="fill-dice"
            disabled={!parents.length}
            title={
              parents.length
                ? 'A new generation from the fills you kept (♥) and the one pinned'
                : 'Keep (♥) or pin fills you like to breed from them'
            }
            onClick={breedNext}
          >
            🧬 Breed
          </button>
          <button
            type="button"
            className="fill-dice"
            disabled={!list.length}
            onClick={() => use(list[Math.floor(Math.random() * list.length)]!)}
          >
            🎲 Surprise
          </button>
        </span>
      </div>
      <p className="lib-note fill-hint">
        {hint ??
          (total > BigInt(LIMIT)
            ? `${LIMIT} of ${total.toLocaleString('en-US')}, picked at random`
            : `all ${total.toLocaleString('en-US')}`)}
      </p>
      {pin && (
        <Compare
          pin={pin}
          cand={cand && cand.key !== pin.key ? cand : null}
          beats={beats}
          onUnpin={() => {
            setPin(null);
            previewSizes(null);
          }}
        />
      )}
      {view === 'map' ? (
        <>
          <FillMap options={list} cand={cand} onCand={setCand} onUse={use} />
          {cand ? (
            <Row
              o={cand}
              beats={beats}
              picked={picked === cand.key}
              onUse={use}
              onTry={tryIt}
              onPin={setPin}
              pinned={pin?.key === cand.key}
            />
          ) : (
            <p className="lib-note">Run a finger over the map to hear and see each fill.</p>
          )}
        </>
      ) : (
        <ul className="fill-list" aria-label="Ways to fill" onMouseLeave={() => previewFill(null)}>
          {list.map((o) => (
            <Row
              key={o.key}
              o={o}
              beats={beats}
              picked={picked === o.key}
              onUse={use}
              onTry={tryIt}
              onPin={setPin}
              pinned={pin?.key === o.key}
              item
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One fill: its picture, contour and name; tap uses it, ♥ keeps it, 📌 pins it as A. */
function Row({
  o,
  beats,
  picked,
  pinned,
  onUse,
  onTry,
  onPin,
  item,
}: {
  o: Listed;
  beats: number[];
  picked: boolean;
  pinned: boolean;
  onUse: (o: Listed) => void;
  onTry: (o: Listed) => void;
  onPin: (o: Listed) => void;
  item?: boolean;
}) {
  const kept = useUiStore((s) => s.motifs.some((m) => m.join(' ') === o.key));
  const shape = useUiStore((s) => s.fillShape);
  const meta =
    o.note ??
    (o.shape && shape !== 'any' ? o.shape.label : `${o.tiles} tiles · ${o.onBeat} on the beat`);
  const body = (
    <div className="fill-row">
      <button
        type="button"
        className="fill-main"
        aria-pressed={picked}
        onMouseEnter={() => onTry(o)}
        onFocus={() => onTry(o)}
        onBlur={() => previewFill(null)}
        onClick={() => onUse(o)}
      >
        <Strip sizes={o.sizes} rests={o.rests} beats={beats} />
        <Contour sizes={o.sizes} />
        <span className="fill-meta">{meta}</span>
      </button>
      <button
        type="button"
        className="fill-pin"
        aria-pressed={pinned}
        title={`Pin ${o.key} as A, to compare`}
        onClick={() => onPin(o)}
      >
        <span aria-hidden="true">📌</span>
        <span className="sr-only">Pin {o.key}</span>
      </button>
      <Heart on={kept} label={o.key} onClick={() => toggleMotif(o.sizes)} />
    </div>
  );
  return item ? <li>{body}</li> : body;
}

/**
 * A/B: the pinned fill against the one tried last, heard and seen in turn, with the way from
 * one to the other (the onsets that differ, moved one at a time).
 */
function Compare({
  pin,
  cand,
  beats,
  onUnpin,
}: {
  pin: Listed;
  cand: Listed | null;
  beats: number[];
  onUnpin: () => void;
}) {
  const [showing, setShowing] = useState<'A' | 'B' | null>(null);
  const steps = useMemo(() => (cand ? E.between(pin.sizes, cand.sizes, 5) : []), [pin, cand]);
  const hear = (w: 'A' | 'B') => {
    setShowing(w);
    previewSizes(w === 'A' ? pin.sizes : (cand?.sizes ?? null));
  };
  return (
    <div className="fill-compare" role="group" aria-label="Compare">
      <div className="fill-compare-row">
        <b className="fill-ab">A</b>
        <Strip sizes={pin.sizes} beats={beats} />
        <button type="button" aria-pressed={showing === 'A'} onClick={() => hear('A')}>
          Hear A
        </button>
        <button
          type="button"
          aria-pressed={showing === 'B'}
          disabled={!cand}
          title={cand ? `B: ${cand.key}` : 'Try another fill to compare it with A'}
          onClick={() => hear('B')}
        >
          Hear B
        </button>
        <button type="button" onClick={() => fillSizes(pin.sizes)}>
          Use A
        </button>
        <button type="button" className="ghost icon" title="Unpin A" onClick={onUnpin}>
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Unpin A</span>
        </button>
      </div>
      {steps.length > 0 && (
        <div className="fill-between" role="group" aria-label="From A to B">
          <span className="lib-note">A → B</span>
          {steps.map((t) => (
            <button
              key={t.join(' ')}
              type="button"
              title={t.join(' ')}
              onMouseEnter={() => previewSizes(t)}
              onFocus={() => previewSizes(t)}
              onClick={() => fillSizes(t, 'Between A and B:')}
            >
              <Strip sizes={t} />
              <span className="sr-only">{t.join(' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
