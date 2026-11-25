import { Fragment, useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import { describePulse } from '../state/editing';
import { closeFill, fillRegion, previewLanding, writeLanding } from '../state/fill';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { GroupHead, Strip, UseBar, shownRows, useOpenGroups, useRegionBeats } from './fillParts';
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
  yati: ['Yati', 'three times, the main size changing, the landing kept'],
  speeds: ['Speeds', 'the same strokes faster and faster (or slower)'],
  korvai: ['Korvai', 'a yati of strokes drawn into a mora'],
  nested: ['Tihai of tihais', 'nine statements: the inner tihais land first'],
  chain: ['Chain of tihais', 'statements shrink as the gaps grow: one begins every so many pulses'],
  tail: ['Tail', 'abcd ×3, bcd ×2, cd, c: the phrases sized so it lands'],
  halving: ['Halving', 'kuraippu: the last half each time (8 → 4 → 2 → 1)'],
  gati: ['Gati', 'the same strokes at three speeds of the beat'],
  gapped: ['With a gap', 'any number of times'],
  shape: ['Shaped', 'the pattern, transformed'],
  even: ['Even', 'one size for the longs, one for the shorts'],
  free: ['Free', 'longs (or shorts) of different sizes, once'],
};
const LS_WORD = { L: 'Long', S: 'Short' } as const;
/** The order of the kinds in the list (gati ways are made here, not in the engine's list). */
const ORDER: E.LandingKind[] = [
  'repeat',
  'tihai',
  'yati',
  'speeds',
  'gati',
  'korvai',
  'nested',
  'chain',
  'tail',
  'halving',
  'gapped',
  'shape',
  'even',
  'free',
];
const rankOf = (k: E.LandingKind) => ORDER.indexOf(k);
/** The kinds whose note is shown under their name. */
const NOTED = new Set<E.LandingKind>([
  'shape',
  'yati',
  'speeds',
  'gati',
  'korvai',
  'nested',
  'chain',
  'tail',
  'halving',
]);

/**
 * Land a pattern (third tab of the fill panel): build a pattern of tiles, and see every way it
 * ends exactly on the end of the region: how many times it is said and where it must begin; as a
 * tihai (three times, a gap tile between); as a yati (three times, the cell's main size
 * changing around a mean, so it lands where the plain tihai would); any number of times with a gap; and shaped (worn
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
  /** The reason the last Long / Short press was refused, shown in the hint line. */
  const [why, setWhy] = useState<string | null>(null);
  const on1 = useUiStore((s) => s.landOn1);
  const from = useUiStore((s) => s.landFrom);
  const wantShift = useUiStore((s) => s.landShift);
  const R = region ? region.b - region.a : 0;
  const a = region?.a ?? 0;
  const version = useDocStore((s) => s.version);
  /** Pulses after the stretch, which a late landing may run on into. */
  const after = useMemo(
    () => (region ? Math.max(0, E.buildGrid(useDocStore.getState().doc.meter).TS - region.b) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region?.b, version],
  );
  /** Where it lands against the end of the stretch (pulses; < 0 early, > 0 late), as it fits. */
  const shift = Math.max(-(R - 1), Math.min(after, wantShift));
  const RL = R + shift;
  const p = ls ? 0 : sizesPattern.reduce((x, n) => x + n, 0);
  /** Pulses in a beat when every beat of the region has the same number (yati gaps of beats). */
  const beat = useMemo(() => {
    if (!region) return 0;
    const sub = useDocStore.getState().doc.meter.subdivision;
    const grid = E.buildGrid(useDocStore.getState().doc.meter);
    const b0 = E.beatOfPulse(grid, region.a);
    const b1 = E.beatOfPulse(grid, Math.max(region.a, region.b - 1));
    const d = sub[b0] ?? 0;
    for (let b = b0; b <= b1; b++) if (sub[b] !== d) return 0;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.a, region?.b, version]);
  /** The same strokes at three speeds of the beat: only for a stretch of whole beats. */
  const gati = useMemo((): E.PatternLanding[] => {
    if (ls || shift || !region || !sizesPattern.length) return [];
    const grid = E.buildGrid(useDocStore.getState().doc.meter);
    const b0 = E.beatOfPulse(grid, Math.min(region.a, grid.TS - 1));
    if (grid.pre[b0] !== region.a) return [];
    const b1 = region.b >= grid.TS ? grid.NB : E.beatOfPulse(grid, region.b);
    if (grid.pre[b1] !== region.b) return [];
    return E.gatiWays(b1 - b0, sizesPattern, on1).map((w) => ({
      kind: 'gati' as const,
      sizes: w.sizes,
      lead: grid.pre[b0 + w.leadBeats]! - region.a,
      times: 3,
      gaps: w.gaps.length ? w.gaps : undefined,
      name: w.name,
      note: w.note,
      on1: w.on1,
      key: w.key,
      gati: w,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.a, region?.b, version, ls, shift, sizesPattern, on1]);
  const all = useMemo(() => {
    const ways = ls
      ? E.lsLandings(RL, lsPattern, { on1 })
      : E.patternLandings(RL, sizesPattern, { on1, beat });
    return [...ways, ...gati].sort((x, y) => rankOf(x.kind) - rankOf(y.kind));
  }, [RL, ls, lsPattern, sizesPattern, on1, beat, gati]);
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
        const at = (x: number) => a + l.lead + x;
        const back = l.on1 ?? 0;
        return [
          l.key,
          {
            text: describePulse(k),
            beat: onBeat,
            one: on,
            mark: on ? 'on 1' : onBeat ? 'on the beat' : '',
            lands: l.landings?.map((x) => E.whereWords(d.meter, at(x), grid)).join(' · '),
            // farmaishi: inner tihai j has its statement j on a 1 (its start, or where it lands)
            farmaishi:
              !!l.inner &&
              l.inner.every(
                (st, j) => E.isOnOne(d.meter, grid, at(st[j]![0])) || E.isOnOne(d.meter, grid, at(st[j]![1] - back)),
              ),
          },
        ];
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, a, version]);
  const rows = useMemo(
    () =>
      all
        .filter((l) => {
          const w = places.get(l.key);
          return from === 'any' || (from === 'beat' ? w?.beat : w?.one);
        })
        // within a kind, the farmaishi ways (landing on the 1 along the diagonal) first
        .map((l, i) => ({ l, i, f: places.get(l.key)?.farmaishi ? 0 : 1 }))
        .sort((x, y) => rankOf(x.l.kind) - rankOf(y.l.kind) || x.f - y.f || x.i - y.i)
        .map((x) => x.l),
    [all, places, from],
  );
  // the ways under their kind's heading, a few of each ("all N" opens a kind in full)
  const kinds = useMemo(() => {
    const out: { kind: E.LandingKind; rows: E.PatternLanding[] }[] = [];
    for (const l of rows) {
      const last = out[out.length - 1];
      if (last?.kind === l.kind) last.rows.push(l);
      else out.push({ kind: l.kind, rows: [l] });
    }
    return out;
  }, [rows]);
  const groups = useOpenGroups(`${R} ${a} ${pattern.join(' ')} ${on1} ${from} ${shift}`);
  // another pattern or region: nothing is on trial any more
  useEffect(() => {
    setTrying(null);
    setWhy(null);
    previewLanding(null);
  }, [R, a, pattern, on1, ls, shift]);
  if (!region) return <p className="lib-note">Select a stretch, or leave open space, first.</p>;

  const put = (next: number[]) => set({ landPattern: next });
  const putLS = (next: E.LS[]) => {
    setWhy(null);
    set({ landLS: next });
  };
  /** Why another tile of this kind does not fit: the shape would need more than the stretch. */
  const full = (x: E.LS) =>
    `No room for another ${LS_WORD[x].toLowerCase()} tile: ${E.lsText([...lsPattern, x])} needs at least ${E.lsMinLength([...lsPattern, x], on1)} pulses (a long is at least 2, a short at least 1)${on1 ? ', the last one not written' : ''}, and the stretch has ${R}.`;
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
    const k = region.b + shift;
    if (k >= grid.TS) return 'on the 1';
    const b = E.beatOfPulse(grid, k);
    if (grid.pre[b] !== k)
      return shift ? `${Math.abs(shift)} ${shift < 0 ? 'early' : 'late'}` : 'after the stretch';
    const at = E.barBeat(d.meter, b);
    return at.beat === 1 ? 'on the 1' : `on beat ${at.beat}`;
  })();
  /** "2 beats early", "3 late", "on the end". */
  const shiftWords =
    shift === 0
      ? 'on the end'
      : `${beat && shift % beat === 0 ? `${Math.abs(shift / beat)} beat${Math.abs(shift / beat) > 1 ? 's' : ''}` : `${Math.abs(shift)}`} ${shift < 0 ? 'early' : 'late'}`;
  const setShift = (v: number) => set({ landShift: Math.max(-(R - 1), Math.min(after, v)) });
  const shown = (l: E.PatternLanding) =>
    l.gati
      ? {
          sizes: l.gati.strip,
          rests: l.gati.leadBeats ? [0] : undefined,
          gaps: l.gati.stripGaps,
        }
      : {
          sizes: l.lead ? [l.lead, ...l.sizes] : l.sizes,
          rests: l.lead ? [0] : undefined,
          gaps: l.gaps?.map((i) => i + (l.lead ? 1 : 0)),
        };
  const title = (l: E.PatternLanding) =>
    l.kind === 'tihai'
      ? `Tihai · gap ${l.gap}`
      : l.kind === 'gapped'
        ? `×${l.times} · gap ${l.gap}`
        : l.name && l.kind !== 'even'
          ? l.name
          : l.kind === 'even'
            ? `${l.name}${l.times > 1 ? ` ×${l.times}` : ''}`
            : `×${l.times}`;

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
              title={
                E.lsRoomFor(lsPattern, x, R, on1)
                  ? `Add a ${LS_WORD[x].toLowerCase()} tile (${x})`
                  : full(x)
              }
              aria-disabled={!E.lsRoomFor(lsPattern, x, R, on1)}
              className={E.lsRoomFor(lsPattern, x, R, on1) ? undefined : 'no-room'}
              onClick={() =>
                E.lsRoomFor(lsPattern, x, R, on1) ? putLS([...lsPattern, x]) : setWhy(full(x))
              }
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
        <div className="land-shift">
          <span id="land-shift">Lands</span>
          <div className="segs text" role="group" aria-labelledby="land-shift">
            {beat > 1 && (
              <button
                type="button"
                title="A beat earlier"
                aria-label="A beat earlier"
                disabled={shift - beat < -(R - 1)}
                onClick={() => setShift(shift - beat)}
              >
                «
              </button>
            )}
            <button
              type="button"
              title="A pulse earlier (anagat: it lands before the end, air after it)"
              aria-label="A pulse earlier"
              disabled={shift <= -(R - 1)}
              onClick={() => setShift(shift - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="land-shift-now"
              data-testid="land-shift"
              aria-pressed={shift !== 0}
              title={
                shift
                  ? 'Back to landing on the end'
                  : 'Where it lands: early (anagat: before the 1, or on the 1 of an imagined bar) or late (atit: after the 1). ‹ › move it by a pulse, « » by a beat.'
              }
              onClick={() => setShift(0)}
            >
              {shiftWords}
            </button>
            <button
              type="button"
              title="A pulse later (atit: it runs on past the end)"
              aria-label="A pulse later"
              disabled={shift >= after}
              onClick={() => setShift(shift + 1)}
            >
              ›
            </button>
            {beat > 1 && (
              <button
                type="button"
                title="A beat later"
                aria-label="A beat later"
                disabled={shift + beat > after}
                onClick={() => setShift(shift + beat)}
              >
                »
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="lib-note land-hint" role="status">
        {shift && !(ls && why)
          ? shift < 0
            ? `Lands ${shiftWords}: ${-shift} pulse${shift < -1 ? 's' : ''} of air after it${on1 ? ' (the last tile rings on into them)' : ''}. `
            : `Lands ${shiftWords}: it runs ${shift} pulse${shift > 1 ? 's' : ''} past the end. `
          : ''}
        {ls && why
          ? why
          : ls
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
        {kinds.map(({ kind, rows: ways }) => {
          const isOpen = groups.open.has(kind);
          return (
            <Fragment key={kind}>
              <GroupHead
                label={HEADS[kind][0]}
                note={HEADS[kind][1]}
                count={ways.length}
                open={isOpen}
                onToggle={() => groups.toggle(kind)}
              />
              {shownRows(ways, isOpen, (l) => l.key === trying?.key).map((l) => {
                const w = places.get(l.key)!;
                return (
                  <li key={l.key}>
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
                          {NOTED.has(l.kind) && l.note && (
                            <span className="land-what">
                              {w.farmaishi ? <b className="land-mark">Farmaishi · </b> : null}
                              {l.note}
                            </span>
                          )}
                          {w.lands ? (
                            <span className="land-what land-lands">lands {w.lands}</span>
                          ) : null}
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
                );
              })}
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

