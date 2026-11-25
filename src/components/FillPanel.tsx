import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as E from '../engine';
import type { FillOption } from '../engine';
import {
  closeFill,
  describeRegion,
  fillRegion,
  fillSizes,
  fillWith,
  previewFill,
  previewSizes,
  toggleMotif,
} from '../state/fill';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Contour, Heart, Strip, UseBar, useRegionBeats, type StripLine } from './fillParts';
import { FillMap } from './FillMap';
import { BreedIcon, ChevronIcon, CloseIcon, DiceIcon, HeartIcon, PinIcon } from './Icons';
import { VaryPanel } from './VaryPanel';
import { LandPanel } from './LandPanel';

export { Strip } from './fillParts';

const SIZES = Array.from({ length: 16 }, (_, i) => i + 1);
const LIMIT = 400;
/** Rows drawn at a time in a long list. */
const PAGE = 40;
/** Fills shown of each kind in "All shapes". */
const GROUP_SHOWN = 3;

/** A fill with a note on where it came from (a kept motif fitted here, a bred child). */
type Listed = FillOption & { note?: string };

/** Docked panel for filling the selected region (or the open space) randomly or by browsing. */
export function FillPanel() {
  const tab = useUiStore((s) => s.fillPanel);
  const sizes = useUiStore((s) => s.fillSizes);
  const set = useUiStore((s) => s.set);
  // re-read the region whenever the document or the selection changes
  useDocStore((s) => s.version);
  useUiStore((s) => s.range);
  useUiStore((s) => s.selection);
  const region = fillRegion();
  const shape = useUiStore((s) => s.fillShape);
  const wantedTiles = useUiStore((s) => s.fillTiles);
  const [fold, setFold] = useState<'sizes' | 'shapes' | null>(null);
  useEffect(() => setFold((f) => (f === 'shapes' ? null : f)), [shape]);
  if (!tab) return null;
  // every screen folds the sizes and the shapes while browsing: the fills get the room, and a
  // tap opens either row (on wider screens too, for one calm layout everywhere)
  const folded = tab !== 'vary';
  const shapeName =
    shape === 'shapes'
      ? 'All shapes'
      : shape === 'any'
        ? 'Anything'
        : shape === 'mine'
          ? 'Mine'
          : shape === 'echo'
            ? 'From the piece'
            : shape === 'bred'
              ? 'Bred'
              : (E.SHAPE_FAMILIES.find((f) => f.id === shape)?.label ?? 'Shapes');

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
      {tab === 'vary' && (
        <div className="fill-head">
          <span className="fill-where fill-title">
            <b>Vary</b> {where}
          </span>
          <button
            type="button"
            className="ghost icon"
            aria-label="Close"
            title="Close"
            onClick={closeFill}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      {tab === 'vary' ? (
        <VaryPanel />
      ) : tab === 'land' ? (
        <LandPanel />
      ) : (
        <>
          {folded && (
            <div className="fill-folds">
              <button
                type="button"
                aria-expanded={fold === 'sizes'}
                title="The tile sizes the fills are made of"
                onClick={() => setFold(fold === 'sizes' ? null : 'sizes')}
              >
                <span className="fold-lbl">Sizes</span>
                <span className="fold-sizes">
                  {sizes.length ? (
                    sizes.map((n) => (
                      <i key={n} style={{ background: sizeColor(n), color: inkFor(sizeColor(n)) }}>
                        {n}
                      </i>
                    ))
                  ) : (
                    <span className="dim">none</span>
                  )}
                </span>
                <ChevronIcon />
              </button>
              <button
                type="button"
                aria-expanded={fold === 'shapes'}
                title="The kind of shape to look through"
                onClick={() => setFold(fold === 'shapes' ? null : 'shapes')}
              >
                <span className="fold-lbl">Shape</span>
                <span className="fold-val">{shapeName}</span>
                <ChevronIcon />
              </button>
              {region && (
                <TilesFilter
                  counts={E.tileCounts(region.b - region.a, sizes)}
                  tiles={
                    wantedTiles !== null &&
                    E.tileCounts(region.b - region.a, sizes).includes(wantedTiles)
                      ? wantedTiles
                      : null
                  }
                />
              )}
            </div>
          )}
          <div
            className="fill-sizes"
            role="group"
            aria-label="Tile sizes to use"
            hidden={folded && fold !== 'sizes'}
          >
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
          ) : (
            <Browse shapesHidden={folded && fold !== 'shapes'} tilesInHead={folded} />
          )}
        </>
      )}
    </section>
  );
}

/** Only fills with a set number of tiles (any = every number that fits). */
function TilesFilter({ counts, tiles }: { counts: number[]; tiles: number | null }) {
  const set = useUiStore((s) => s.set);
  if (counts.length < 2) return null;
  return (
    <label className="fill-tiles" title="Only fills with this many tiles">
      <span className="fill-tiles-lbl">Tiles</span>
      <select
        aria-label="Number of tiles"
        data-testid="fill-tiles"
        value={tiles ?? ''}
        onChange={(e) => set({ fillTiles: e.target.value ? +e.target.value : null })}
      >
        <option value="">any</option>
        {counts.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function Browse({
  shapesHidden = false,
  tilesInHead = false,
}: {
  shapesHidden?: boolean;
  /** The tiles filter is shown beside Sizes and Shape (phones), not in the tools line. */
  tilesInHead?: boolean;
}) {
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
  /** The fill on trial: shown in the score and heard in the loop, not written yet. */
  const [trying, setTrying] = useState<Listed | null>(null);
  const tryingRef = useRef<Listed | null>(null);
  tryingRef.current = trying;
  /** A fill pinned for comparison. */
  const [pin, setPin] = useState<Listed | null>(null);
  const [brood, setBrood] = useState<{ gen: number; kids: Listed[] }>({ gen: 0, kids: [] });
  /**
   * "Vary" on the fill on trial: the list becomes that fill and its variations, right here,
   * nothing written. Varying one of those goes a step further; Back returns a step.
   */
  const [stack, setStack] = useState<Listed[]>([]);
  const around = stack[stack.length - 1] ?? null;
  const aroundRef = useRef<HTMLDivElement>(null);

  // how many tiles a fill may have here; one of them can be asked for
  const wanted = useUiStore((s) => s.fillTiles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const counts = useMemo(() => E.tileCounts(R, sizes), [R, sizes.join(',')]);
  const tiles = wanted !== null && counts.includes(wanted) ? wanted : null;
  const { options, total } = useMemo(
    () => E.fillOptions(meter, region.a, R, sizes, LIMIT, Math.random, tiles ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meter, region.a, R, sizes.join(','), tiles],
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
      if (t.join(' ') !== m.join(' ')) o.note = `${m.join(' ')}, fitted`;
      out.push(o);
    }
    return out;
  }, [motifs, R, meter, region.a]);
  // the piece's own material, said again here: what comes just before the region and the
  // opening of the piece, as they are and reordered (so a fill can grow out of what is written)
  const doc = useDocStore((s) => s.doc);
  const echo = useMemo(() => {
    const out: Listed[] = [];
    const seen = new Set<string>();
    const strokes = (a: number, b: number): number[] => {
      // a silence after a stroke reads as a longer stroke; one at the very start joins the next
      const t: number[] = [];
      let lead = 0;
      for (const g of E.sliceRange(doc, a, b)) {
        if (g.kind === 'sound') {
          t.push(g.n + lead);
          lead = 0;
        } else if (t.length) t[t.length - 1]! += g.n;
        else lead += g.n;
      }
      return t;
    };
    const add = (t: number[] | null, note: string) => {
      if (!t || t.length < 2 || seen.has(t.join(' '))) return;
      seen.add(t.join(' '));
      out.push({ ...E.optionOf(meter, region.a, t), note });
    };
    const from = (src: number[], name: string) => {
      const base = E.fitMotif(src, R);
      if (!base || base.length < 2) return;
      add(base, `${name}, again`);
      const vs = E.variations(
        base.map((n) => ({ n, kind: 'sound' as const })),
        40,
        () => 0.5,
      ).filter((v) => v.kind === 'order');
      for (const v of vs.slice(0, 7))
        add(
          v.groups.map((g) => g.n),
          `${name}, ${v.label.toLowerCase()}`,
        );
    };
    if (region.a > 0) from(strokes(Math.max(0, region.a - R), region.a), 'What came before');
    if (region.a >= R) from(strokes(0, R), 'The opening');
    return out;
  }, [doc, meter, region.a, R]);
  // a new region: start over
  useEffect(() => {
    setBrood({ gen: 0, kids: [] });
    setPin(null);
    setCand(null);
    setTrying(null);
    setStack([]);
  }, [region.a, R]);
  // choosing a kind of fill leaves the variations
  useEffect(() => setStack([]), [shape]);
  const nearby = useMemo(() => {
    if (!around) return [];
    const out: Listed[] = [{ ...around, note: 'As it is' }];
    const vs = E.variations(
      around.sizes.map((n) => ({ n, kind: 'sound' as const })),
      60,
    );
    for (const v of vs) {
      if (v.groups.some((g) => g.kind !== 'sound')) continue;
      out.push({
        ...E.optionOf(
          meter,
          region.a,
          v.groups.map((g) => g.n),
        ),
        note: v.label,
      });
    }
    return out;
  }, [around, meter, region.a]);
  const vary = (o: Listed) => {
    setStack((st) => (st[st.length - 1]?.key === o.key ? st : [...st, o]));
    setCand(o);
    setTrying(o);
    previewFill(o);
  };
  // the variations begin at the top of what is in sight
  useEffect(() => {
    const el = aroundRef.current;
    const panel = el?.closest('.fillpanel');
    if (!el || !panel) return;
    panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 6;
  }, [around]);
  useEffect(() => {
    if (shape === 'mine' && !mine.length) set({ fillShape: 'shapes' });
    if (shape === 'bred' && !brood.kids.length) set({ fillShape: 'shapes' });
    if (shape === 'echo' && !echo.length) set({ fillShape: 'shapes' });
  }, [shape, mine.length, brood.kids.length, echo.length, set]);

  const families = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of options) if (o.shape) n.set(o.shape.family, (n.get(o.shape.family) ?? 0) + 1);
    return n;
  }, [options]);
  const list: Listed[] = useMemo(() => {
    if (around) return nearby;
    const few = (xs: Listed[]) => (tiles ? xs.filter((o) => o.sizes.length === tiles) : xs);
    if (shape === 'mine') return few(mine);
    if (shape === 'echo') return few(echo);
    if (shape === 'bred') return brood.kids;
    if (shape === 'any') return E.sortFills(options, sort);
    return options
      .filter((o) => o.shape && (shape === 'shapes' || o.shape.family === shape))
      .sort(
        (a, b) =>
          E.shapeRank(a.shape!.family) - E.shapeRank(b.shape!.family) ||
          // within a family, the plain form before its variants (a tihai before a gap tihai)
          Number(a.shape!.label.includes('→')) - Number(b.shape!.label.includes('→')) ||
          // yatis whose seams fall on beats first (across the beat inside, aligned at the seams)
          (a.shape!.family === 'yati' ? b.seams - a.seams : 0) ||
          a.tiles - b.tiles ||
          a.key.localeCompare(b.key),
      );
  }, [options, sort, shape, mine, echo, brood, around, nearby, tiles]);

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

  const use = useCallback((o: Listed) => {
    setPicked(o.key);
    setCand(o);
    setTrying(null);
    fillWith(o);
  }, []);
  const tryIt = useCallback((o: Listed) => {
    setCand(o);
    setTrying(o);
    previewFill(o);
  }, []);
  // a tap tries; a second tap on the same fill (or "Use") writes it
  const choose = useCallback(
    (o: Listed) => (tryingRef.current?.key === o.key ? use(o) : tryIt(o)),
    [use, tryIt],
  );
  // after a hover, the score goes back to the fill on trial
  const settle = useCallback(() => previewFill(tryingRef.current), []);
  const kept = useMemo(() => new Set(motifs.map((m) => m.join(' '))), [motifs]);
  const named = shape !== 'any' || !!around;
  // a long list is drawn a screenful at a time: more rows arrive as the end comes into view
  const [shown, setShown] = useState(PAGE);
  const more = useRef<HTMLLIElement>(null);
  useEffect(() => setShown(PAGE), [list]);
  useEffect(() => {
    const el = more.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && setShown((n) => n + PAGE),
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, list, view]);
  // "All shapes" is a table of contents: a few of every family under its name, and the way to
  // the rest of it (a flat list of hundreds began with sixty of one kind)
  const groups = useMemo(() => {
    if (shape !== 'shapes' || around) return null;
    const out: { id: string; label: string; hint: string; items: Listed[] }[] = [];
    const said = tiles ? echo.filter((o) => o.sizes.length === tiles) : echo;
    if (said.length)
      out.push({
        id: 'echo',
        label: 'From the piece',
        hint: 'What is already written, said again here',
        items: said,
      });
    for (const f of E.SHAPE_FAMILIES) {
      const items = list.filter((o) => o.shape?.family === f.id);
      if (items.length) out.push({ id: f.id, label: f.label, hint: f.hint, items });
    }
    return out;
  }, [shape, list, echo, around, tiles]);
  const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('.fill-main')];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[Math.max(0, Math.min(rows.length - 1, i + step))]?.focus();
  };
  const hint =
    shape === 'mine'
      ? 'Fills you kept, fitted to this length.'
      : shape === 'echo'
        ? 'What is already written, said again here: as it is, backwards, turned.'
        : shape === 'shapes' && list.length
          ? `${list.length} shaped fills, by kind. ↑ ↓ walk the list.`
          : shape === 'bred'
            ? `Children of what you kept. Keep the ones you like, then breed again.`
            : shape === 'any'
              ? null
              : list.length
                ? (E.SHAPE_FAMILIES.find((f) => f.id === shape)?.hint ??
                  `${list.length} shaped fills`)
                : tiles
                  ? `No shapes with ${tiles} tiles here; try Anything, or another number.`
                  : 'No shapes fit these sizes; try more sizes or Anything.';

  return (
    <div className="fill-browse">
      <div className="fill-shapes" role="group" aria-label="Shapes" hidden={shapesHidden}>
        {mine.length > 0 && (
          <button
            type="button"
            className="fill-mine"
            aria-pressed={shape === 'mine'}
            onClick={() => set({ fillShape: 'mine' })}
          >
            <HeartIcon filled /> Mine <span className="fill-count">{mine.length}</span>
          </button>
        )}
        {echo.length > 0 && (
          <button
            type="button"
            title="What is already written, said again here: as it is, backwards, turned"
            aria-pressed={shape === 'echo'}
            onClick={() => set({ fillShape: 'echo' })}
          >
            From the piece <span className="fill-count">{echo.length}</span>
          </button>
        )}
        {brood.kids.length > 0 && (
          <button
            type="button"
            aria-pressed={shape === 'bred'}
            onClick={() => set({ fillShape: 'bred' })}
          >
            <BreedIcon /> Generation {brood.gen}
          </button>
        )}
        <button
          type="button"
          aria-pressed={shape === 'shapes'}
          onClick={() => set({ fillShape: 'shapes' })}
        >
          All shapes
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
        {!around && !tilesInHead && <TilesFilter counts={counts} tiles={tiles} />}
        {shape === 'any' && view === 'list' && !around && (
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
            aria-pressed={!!pin}
            disabled={!pin && !cand}
            title={
              pin
                ? 'Stop comparing'
                : 'Compare: hold on to the fill you tried last (A) and hear others against it'
            }
            onClick={() => {
              if (pin) previewSizes(null);
              setPin(pin ? null : cand);
            }}
          >
            <PinIcon />
            <span className="tool-lbl">Compare</span>
          </button>
          <button
            type="button"
            disabled={!parents.length}
            title={
              parents.length
                ? 'A new generation from the fills you kept and the one you compare with'
                : 'Keep fills you like (the heart) to breed a new generation from them'
            }
            onClick={breedNext}
          >
            <BreedIcon />
            <span className="tool-lbl">Breed</span>
          </button>
          <button
            type="button"
            disabled={!list.length}
            title="Fill with one of these, picked at random"
            onClick={() => use(list[Math.floor(Math.random() * list.length)]!)}
          >
            <DiceIcon />
            <span className="tool-lbl">Surprise</span>
          </button>
        </span>
        <button
          type="button"
          className="ghost icon fill-close"
          aria-label="Close"
          title="Close"
          onClick={closeFill}
        >
          <CloseIcon />
        </button>
      </div>
      {around && (
        <div className="fill-around" ref={aroundRef} role="group" aria-label="Variations">
          <button
            type="button"
            className="link-btn"
            title={stack.length > 1 ? 'Back to the fill before' : 'Back to all the fills'}
            onClick={() => setStack((st) => st.slice(0, -1))}
          >
            ‹ Back
          </button>
          <span className="fill-around-name">
            Variations of <b>{around.key}</b>
          </span>
          <span className="fill-count">{nearby.length - 1}</span>
        </div>
      )}
      <p className="lib-note fill-hint" hidden={!!around}>
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
            previewFill(trying);
          }}
          onTry={(t) => {
            const o = E.optionOf(meter, region.a, t);
            setTrying(o);
            previewFill(o);
          }}
        />
      )}
      {view === 'map' ? (
        <>
          <FillMap options={list} cand={cand} onCand={(o) => o && tryIt(o)} onUse={use} />
        </>
      ) : (
        <ul
          className="fill-list"
          aria-label="Ways to fill"
          onMouseLeave={settle}
          onKeyDown={onListKey}
        >
          {groups
            ? groups.map((g) => (
                <Fragment key={g.id}>
                  <li className="fill-group">
                    <span className="fill-group-name" title={g.hint}>
                      {g.label}
                    </span>
                    {g.items.length > GROUP_SHOWN && (
                      <button
                        type="button"
                        className="link-btn"
                        title={g.hint}
                        onClick={() => set({ fillShape: g.id as typeof shape })}
                      >
                        all {g.items.length}
                        <span className="sr-only"> of {g.label}</span>
                      </button>
                    )}
                  </li>
                  {g.items.slice(0, GROUP_SHOWN).map((o) => (
                    <Row
                      key={`${g.id} ${o.key}`}
                      o={o}
                      beats={beats}
                      written={picked === o.key}
                      trying={trying?.key === o.key}
                      kept={kept.has(o.key)}
                      named={named}
                      onChoose={choose}
                      item
                    />
                  ))}
                </Fragment>
              ))
            : list
                .slice(0, shown)
                .map((o) => (
                  <Row
                    key={o.key}
                    o={o}
                    beats={beats}
                    written={picked === o.key}
                    trying={trying?.key === o.key}
                    kept={kept.has(o.key)}
                    named={named}
                    onChoose={choose}
                    item
                  />
                ))}
          {!groups && shown < list.length && (
            <li ref={more} className="fill-more" aria-hidden="true" />
          )}
        </ul>
      )}
      <UseBar
        trying={trying}
        beats={beats}
        onUse={() => trying && use(trying)}
        onVary={trying && trying.sizes.length > 1 ? () => vary(trying) : undefined}
        varying={!!trying && around?.key === trying.key}
        onCancel={() => {
          setTrying(null);
          previewFill(null);
        }}
      />
    </div>
  );
}

/** One fill: its picture among the beat lines, its contour and name; the heart keeps it. */
const Row = memo(function Row({
  o,
  beats,
  written,
  trying,
  kept,
  named,
  onChoose,
  item,
}: {
  o: Listed;
  beats: StripLine[];
  /** It is what is written there now. */
  written: boolean;
  /** It is on trial (a second tap writes it). */
  trying: boolean;
  kept: boolean;
  /** Say the fill's shape (else its measures). */
  named: boolean;
  onChoose: (o: Listed) => void;
  item?: boolean;
}) {
  const meta =
    o.note ?? (o.shape && named ? o.shape.label : `${o.tiles} tiles · ${o.onBeat} on the beat`);
  const body = (
    <div className="fill-row">
      <button
        type="button"
        className="fill-main"
        aria-pressed={trying}
        data-written={written || undefined}
        title={trying ? 'Tap again to use it' : undefined}
        onMouseEnter={() => previewFill(o)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && previewFill(o)}
        onClick={() => onChoose(o)}
      >
        <Strip sizes={o.sizes} rests={o.rests} beats={beats} />
        <span className="sr-only">{o.key}. </span>
        <span className="fill-cap">
          <Contour sizes={o.sizes} />
          <span className="fill-meta">{meta}</span>
        </span>
      </button>
      <Heart on={kept} label={o.key} onClick={() => toggleMotif(o.sizes)} />
    </div>
  );
  return item ? <li>{body}</li> : body;
});

/**
 * A/B: the pinned fill against the one tried last, heard and seen in turn, with the way from
 * one to the other (the onsets that differ, moved one at a time).
 */
function Compare({
  pin,
  cand,
  beats,
  onUnpin,
  onTry,
}: {
  pin: Listed;
  cand: Listed | null;
  beats: StripLine[];
  onUnpin: () => void;
  onTry: (sizes: number[]) => void;
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
        <b className="fill-ab" aria-hidden="true">
          A
        </b>
        <Strip sizes={pin.sizes} beats={beats} />
        <button type="button" className="ghost icon" title="Stop comparing" onClick={onUnpin}>
          <CloseIcon />
          <span className="sr-only">Stop comparing</span>
        </button>
      </div>
      <div className="fill-compare-acts">
        <div className="segs text" role="group" aria-label="Show in the score">
          <button type="button" aria-pressed={showing === 'A'} onClick={() => hear('A')}>
            A
          </button>
          <button
            type="button"
            aria-pressed={showing === 'B'}
            disabled={!cand}
            title={cand ? `B: ${cand.key}` : 'Try another fill to compare it with A'}
            onClick={() => hear('B')}
          >
            B
          </button>
        </div>
        <span className="lib-note">
          {cand ? `B is ${cand.key}` : 'Try another fill: it becomes B.'}
        </span>
        <button type="button" className="fill-use" onClick={() => fillSizes(pin.sizes)}>
          Use A
        </button>
      </div>
      {steps.length > 0 && (
        <div className="fill-between" role="group" aria-label="From A to B">
          <span className="lib-note">From A to B</span>
          {steps.map((t) => (
            <button
              key={t.join(' ')}
              type="button"
              title={t.join(' ')}
              onMouseEnter={() => previewSizes(t)}
              onClick={() => onTry(t)}
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
