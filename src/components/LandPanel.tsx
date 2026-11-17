import { Fragment, useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import { describePulse } from '../state/editing';
import { closeFill, fillRegion, previewLanding, writeLanding } from '../state/fill';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Strip, UseBar, useRegionBeats } from './fillParts';
import { CloseIcon } from './Icons';

const SIZES = Array.from({ length: 16 }, (_, i) => i + 1);
/** Where a way may begin: the name, and what phones show of it. */
const FROM: ['any' | 'beat' | 'one', string, string][] = [
  ['any', 'Anywhere', 'Any'],
  ['beat', 'On a beat', 'Beat'],
  ['one', 'On a 1', 'On 1'],
];
const HEADS: Record<E.LandingKind, [string, string]> = {
  repeat: ['Repeated', 'so many times'],
  tihai: ['Tihai', 'three times, a gap between'],
  gapped: ['With a gap', 'any number of times'],
  shape: ['Shaped', 'the pattern, transformed'],
  even: ['Even', 'one size for the longs, one for the shorts'],
  free: ['Free', 'longs (or shorts) of different sizes, once'],
};
const LS_WORD = { L: 'Long', S: 'Short' } as const;

/**
 * Land a pattern (third tab of the fill panel): build a pattern of tiles, and see every way it
 * ends exactly on the end of the region: how many times it is said and where it must begin; as a
 * tihai (three times, a gap tile between) or any number of times with a gap; and shaped (worn
 * away, built up, broad then as written, running through). "Last tile on the 1" lets the last
 * tile begin where the region ends, as a tihai's last stroke does (it is not written); "Begins"
 * keeps the ways that start on a beat or on a 1. A tap tries one in the score, Use writes it;
 * what is before its first tile stays as it is.
 */
export function LandPanel() {
  const sizesPattern = useUiStore((s) => s.landPattern);
  const lsPattern = useUiStore((s) => s.landLS);
  const mode = useUiStore((s) => s.landMode);
  const ls = mode === 'ls';
  const pattern = ls ? lsPattern : sizesPattern;
  const clip = useUiStore((s) => s.clipboard);
  const set = useUiStore((s) => s.set);
  const region = fillRegion();
  const beats = useRegionBeats();
  const [trying, setTrying] = useState<E.PatternLanding | null>(null);
  const on1 = useUiStore((s) => s.landOn1);
  const from = useUiStore((s) => s.landFrom);
  const version = useDocStore((s) => s.version);
  const R = region ? region.b - region.a : 0;
  const a = region?.a ?? 0;
  const p = ls ? 0 : sizesPattern.reduce((x, n) => x + n, 0);
  const all = useMemo(
    () => (ls ? E.lsLandings(R, lsPattern, { on1 }) : E.patternLandings(R, sizesPattern, { on1 })),
    [R, ls, lsPattern, sizesPattern, on1],
  );
  /** Where each way begins, and whether that is a strong place. */
  const places = useMemo(() => {
    const d = useDocStore.getState().doc;
    const grid = E.buildGrid(d.meter);
    return new Map(
      all.map((l) => {
        const k = a + l.lead;
        const b = E.beatOfPulse(grid, Math.min(k, grid.TS - 1));
        const onBeat = grid.pre[b] === k;
        const on = onBeat && E.barBeat(d.meter, b).beat === 1;
        return [
          l.key,
          {
            text: describePulse(k),
            beat: onBeat,
            one: on,
            mark: on ? 'on 1' : onBeat ? 'on the beat' : '',
          },
        ];
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, a, version]);
  const rows = useMemo(
    () =>
      all.filter((l) => {
        const w = places.get(l.key);
        return from === 'any' || (from === 'beat' ? w?.beat : w?.one);
      }),
    [all, places, from],
  );
  // another pattern or region: nothing is on trial any more
  useEffect(() => {
    setTrying(null);
    previewLanding(null);
  }, [R, a, pattern, on1, ls]);
  if (!region) return <p className="lib-note">Select a stretch, or leave open space, first.</p>;

  const put = (next: number[]) => set({ landPattern: next });
  const putLS = (next: E.LS[]) => set({ landLS: next });
  const copied = clip.filter((g) => g.kind === 'sound').map((g) => g.n);
  /** The strokes written just before the stretch (four at most): a pattern to go on with. */
  const before = (() => {
    const out: number[] = [];
    let at = 0;
    for (const x of useDocStore.getState().doc.items) {
      if (at >= region.a) break;
      if (!E.isSpace(x) && x.kind === 'sound' && at + x.n <= region.a) out.push(x.n);
      else out.length = 0;
      at += x.n;
    }
    return out.slice(-4);
  })();
  const offers: [string, number[]][] = [];
  if (before.length) offers.push(['Before it', before]);
  if (copied.length) offers.push(['Copied', copied]);
  /** The same, as long and short: the shape of what is written before, or of what was copied. */
  const lsOffers = offers.flatMap(([name, sizes]) => {
    const shape = E.longShortOf(sizes);
    return shape ? [[name, shape] as [string, E.LS[]]] : [];
  });
  const tryIt = (l: E.PatternLanding) => {
    if (trying?.key === l.key) return write(l);
    setTrying(l);
    previewLanding(l);
  };
  const write = (l: E.PatternLanding) => {
    setTrying(null);
    writeLanding(l);
  };
  const lastTile = ls ? null : sizesPattern[sizesPattern.length - 1];
  /** Where the stretch ends, which is where the last tile falls: the 1, a beat, or neither. */
  const end = (() => {
    const d = useDocStore.getState().doc;
    const grid = E.buildGrid(d.meter);
    if (region.b >= grid.TS) return 'on the 1';
    const b = E.beatOfPulse(grid, region.b);
    if (grid.pre[b] !== region.b) return 'after the stretch';
    const at = E.barBeat(d.meter, b);
    return at.beat === 1 ? 'on the 1' : `on beat ${at.beat}`;
  })();
  const shown = (l: E.PatternLanding) => ({
    sizes: l.lead ? [l.lead, ...l.sizes] : l.sizes,
    rests: l.lead ? [0] : undefined,
    gaps: l.gaps?.map((i) => i + (l.lead ? 1 : 0)),
  });
  const title = (l: E.PatternLanding) =>
    l.kind === 'tihai'
      ? `Tihai · gap ${l.gap}`
      : l.kind === 'gapped'
        ? `×${l.times} · gap ${l.gap}`
        : l.kind === 'shape' || l.kind === 'free'
          ? l.name
          : l.kind === 'even'
            ? `${l.name}${l.times > 1 ? ` ×${l.times}` : ''}`
            : `×${l.times}`;
  let heading: E.LandingKind | null = null;

  return (
    <div className="land">
      <div className="land-pattern">
        <div className="segs text land-mode" role="group" aria-label="Build the pattern of">
          <button
            type="button"
            aria-pressed={!ls}
            title="A pattern of sizes: 3 3 2"
            onClick={() => set({ landMode: 'sizes' })}
          >
            123<span className="sr-only"> Sizes</span>
          </button>
          <button
            type="button"
            aria-pressed={ls}
            title="A pattern of long and short tiles: L S S. Every way to give them sizes is shown."
            data-testid="land-mode-ls"
            onClick={() => set({ landMode: 'ls' })}
          >
            L·S<span className="sr-only"> Long and short</span>
          </button>
        </div>
        <span className="land-tiles" data-testid="land-pattern">
          {ls ? (
            lsPattern.length ? (
              lsPattern.map((x, i) => (
                <i key={i} className={x === 'L' ? 'ls-long' : 'ls-short'} title={LS_WORD[x]}>
                  {x}
                </i>
              ))
            ) : (
              <span className="dim">long, short…</span>
            )
          ) : sizesPattern.length ? (
            sizesPattern.map((n, i) => (
              <i key={i} style={{ background: sizeColor(n), color: inkFor(sizeColor(n)) }}>
                {n}
              </i>
            ))
          ) : (
            <span className="dim">tap sizes below</span>
          )}
        </span>
        {p > 0 && <span className="land-sum mono">= {p}</span>}
        {!pattern.length &&
          (ls ? lsOffers : offers).map(([name, shape]) => (
            <button
              key={name}
              type="button"
              className="link-btn"
              title={
                name === 'Copied'
                  ? 'Use what was copied last as the pattern'
                  : 'Use the strokes written just before this stretch as the pattern'
              }
              onClick={() => (ls ? putLS(shape as E.LS[]) : put(shape as number[]))}
            >
              {name} {shape.join(' ')}
            </button>
          ))}
        <button
          type="button"
          className="ghost icon"
          aria-label="Remove the last tile of the pattern"
          title="Remove the last tile"
          disabled={!pattern.length}
          onClick={() => (ls ? putLS(lsPattern.slice(0, -1)) : put(sizesPattern.slice(0, -1)))}
        >
          ⌫
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!pattern.length}
          onClick={() => (ls ? putLS([]) : put([]))}
        >
          Clear
        </button>
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
      {ls ? (
        <div className="fill-sizes land-ls" role="group" aria-label="Add a tile to the pattern">
          {(['L', 'S'] as const).map((x) => (
            <button
              key={x}
              type="button"
              data-testid={`land-${x}`}
              title={`Add a ${LS_WORD[x].toLowerCase()} tile (${x})`}
              disabled={lsPattern.length >= 12}
              onClick={() => putLS([...lsPattern, x])}
            >
              <i className={x === 'L' ? 'ls-long' : 'ls-short'} aria-hidden="true">
                {x}
              </i>
              {LS_WORD[x]}
            </button>
          ))}
        </div>
      ) : (
        <div className="fill-sizes" role="group" aria-label="Add a tile to the pattern">
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Add ${n}`}
              data-testid={`land-${n}`}
              disabled={p + n > R}
              style={{ boxShadow: `inset 0 -3px 0 ${sizeColor(n)}, inset 0 0 0 1.5px var(--line)` }}
              onClick={() => put([...sizesPattern, n])}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="land-opts">
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={on1}
          data-testid="land-on1"
          title={`Like a tihai: the pattern's last tile begins exactly where the stretch ends (${end}). It is not written.`}
          onClick={() => set({ landOn1: !on1 })}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
          Last tile {end}
        </button>
        <div className="land-from">
          <span id="land-from">Begins</span>
          <div className="segs text" role="group" aria-labelledby="land-from">
            {FROM.map(([id, label, short]) => (
              <button
                key={id}
                type="button"
                aria-pressed={from === id}
                title={`Begins: ${label.toLowerCase()}`}
                onClick={() => set({ landFrom: id })}
              >
                <span className="land-wide">{label}</span>
                <span className="land-narrow" aria-hidden="true">
                  {short}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="lib-note land-hint" role="status">
        {ls
          ? !pattern.length
            ? `Build a shape of long and short tiles: every way to give them sizes that lands on the end of these ${R} pulses is shown.`
            : !all.length
              ? `No sizes make ${E.lsText(lsPattern)} land in ${R} pulses (sizes go up to ${E.MAX_LS_SIZE}).`
              : `${E.lsText(lsPattern)}: every long longer than every short${on1 ? `; the last tile falls ${end}, not written` : ''}.`
          : !pattern.length
            ? `Build a pattern: every way it ends exactly on the end of these ${R} pulses is shown, with where it must begin.`
            : !all.length
              ? on1 && pattern.length === 1 && p <= R
                ? `One tile alone, ${end}: nothing is left to write. Add a tile.`
                : `The pattern (${p}) is longer than the stretch (${R}).`
              : on1
                ? `The last tile (${lastTile}) falls ${end}, right after these ${R} pulses, so it is not written.`
                : `${R} pulses to the end: ${p} goes in ${Math.floor(R / p)} times${
                    R % p ? `, with ${R % p} left before it` : ', exactly'
                  }.`}
        {all.length > 0 && !rows.length
          ? ` None of the ${all.length} ways begins ${from === 'beat' ? 'on a beat' : 'on a 1'}.`
          : ''}
      </p>
      <ul
        className="fill-list land-list"
        aria-label="Ways it lands"
        onMouseLeave={() => previewLanding(trying)}
      >
        {rows.map((l) => {
          const w = places.get(l.key)!;
          const head = l.kind !== heading ? (heading = l.kind) : null;
          return (
            <Fragment key={l.key}>
              {head && (
                <li className="fill-group">
                  <span className="fill-group-name">{HEADS[head][0]}</span>
                  <span className="land-group-note">{HEADS[head][1]}</span>
                </li>
              )}
              <li>
                <div className="fill-row">
                  <button
                    type="button"
                    className="fill-main"
                    aria-pressed={trying?.key === l.key}
                    title={trying?.key === l.key ? 'Tap again to use it' : undefined}
                    onMouseEnter={() => previewLanding(l)}
                    onClick={() => tryIt(l)}
                  >
                    <Strip {...shown(l)} beats={beats} />
                    <span className="fill-cap land-cap">
                      <span className="land-times">{title(l)}</span>
                      {l.kind === 'shape' && l.note && <span className="land-what">{l.note}</span>}
                      <span className="fill-meta land-where">
                        {l.lead ? `from ${w.text}` : 'fills it exactly'}
                        {w.mark && l.lead ? <b className="land-mark"> · {w.mark}</b> : null}
                        {l.on1 ? (
                          <span className="land-on1">
                            {' · then '}
                            <i
                              style={{
                                background: sizeColor(l.on1),
                                color: inkFor(sizeColor(l.on1)),
                              }}
                            >
                              {l.on1}
                            </i>
                            {` ${end === 'after the stretch' ? 'after it' : end}`}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
      <UseBar
        trying={trying ? shown(trying) : null}
        beats={beats}
        onUse={() => trying && write(trying)}
        onCancel={() => {
          setTrying(null);
          previewLanding(null);
        }}
      />
    </div>
  );
}
