import { useState } from 'react';
import * as E from '../engine';
import { useDocStore, useUiStore } from '../state/store';

/** "2nd", "3rd": the place of a pulse in its beat, counted from the beat itself. */
const nth = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const list = (a: (number | string)[]) =>
  a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;

/** The bar as the piece has it: for every beat of the longest bar, the ratios found there. */
function barShape(meter: E.Meter): number[][] {
  const map = E.barMap(meter);
  const shape: Set<number>[] = [];
  meter.subdivision.forEach((d, i) => {
    const b = map.beatInBar[i] ?? 0;
    (shape[b] ??= new Set()).add(d);
  });
  return Array.from(shape, (s) => [...(s ?? [1])].sort((a, b) => a - b));
}

/**
 * The click as a rhythm of its own (in the practice popover): a switch, and under it a small
 * sequencer. The bar is drawn as it is in the piece: every beat a numbered cell (the beat's own
 * click) followed by a dot for each pulse inside it; tap any of them. "A tap sets" chooses
 * whether a dot is set in that beat alone or in every beat. Bars: + makes a cycle of bars, each
 * with a pattern of its own (new ones are silent); the numbered tabs choose the bar shown.
 * Switched off, the click is the plain one and the pattern is kept.
 */
export function ClickPatternSection() {
  const pat = useUiStore((s) => s.clickPat);
  const click = useUiStore((s) => s.click);
  const ticks = useUiStore((s) => s.ticks);
  const now = useUiStore((s) => s.clickBarNow);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  // while playing: the beat of the bar that sounds now (a moving mark, as in a sequencer)
  const beatNow = useUiStore((s) =>
    s.playhead === null || s.clickBarNow === null
      ? -1
      : (E.barMap(useDocStore.getState().doc.meter).beatInBar[Math.floor(s.playhead + 1e-6)] ?? -1),
  );
  const [shown, setShown] = useState(0);
  const [every, setEvery] = useState(false);
  const k = Math.min(shown, pat.bars.length - 1);
  const bar = pat.bars[k]!;
  const shape = barShape(meter);
  const mixed = shape.some((ds) => ds.length > 1);
  const inside = shape.some((ds) => ds.some((d) => d > 1));

  const putBar = (next: E.ClickBar, more: { click?: boolean; ticks?: boolean } = {}) =>
    set({ clickPat: { ...pat, bars: pat.bars.map((b, i) => (i === k ? next : b)) }, ...more });
  const cycle = (n: number) => {
    const next = E.withClickBars(pat, n);
    set({ clickPat: next });
    // a bar just added is the one to set
    setShown(n > pat.bars.length ? next.bars.length - 1 : Math.min(k, next.bars.length - 1));
  };
  const sameRatio = (d: number) => shape.flatMap((ds, b) => (ds.includes(d) ? [b] : []));

  return (
    <div className="clickpat" role="group" aria-labelledby="pr-pat">
      <div className="practice-row">
        <span id="pr-pat">Click pattern</span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={pat.on}
          aria-labelledby="pr-pat"
          data-testid="click-pattern"
          onClick={() => set({ clickPat: { ...pat, on: !pat.on } })}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
        </button>
      </div>
      {!pat.on && (
        <p className="practice-note">
          Off: the click is on every beat. Switch it on to choose which beats and which pulses
          inside them click, bar by bar: only 2 and 4, one sixteenth in the bar, the 1 once in four
          bars.
        </p>
      )}
      {pat.on && (
        <>
          <div className="pat-presets" role="group" aria-label="Start from a pattern">
            {E.CLICK_PRESETS.map((x) => (
              <button
                key={x.id}
                type="button"
                className="chip"
                onClick={() => {
                  set({ clickPat: { on: true, bars: x.bars(shape) }, click: true, ticks: true });
                  setShown(0);
                }}
              >
                {x.name(shape)}
              </button>
            ))}
          </div>
          <div className="pat-head">
            <span className="pat-lbl" id="pat-bars">
              {pat.bars.length === 1 ? 'Every bar the same' : `A cycle of ${pat.bars.length} bars`}
            </span>
            <div className="pat-cycle" role="group" aria-label="Bars in the cycle">
              <button
                type="button"
                aria-label="One bar less in the cycle"
                disabled={pat.bars.length <= 1}
                onClick={() => cycle(pat.bars.length - 1)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="One bar more in the cycle"
                disabled={pat.bars.length >= E.MAX_CLICK_BARS}
                onClick={() => cycle(pat.bars.length + 1)}
              >
                +
              </button>
            </div>
          </div>
          {pat.bars.length > 1 && (
            <div className="pat-tabs" role="group" aria-labelledby="pat-bars">
              {pat.bars.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className={`pat-tab${silent(b, shape) ? ' silent' : ''}${now === i ? ' pat-now' : ''}`}
                  aria-pressed={i === k}
                  aria-label={`Bar ${i + 1} of ${pat.bars.length}${silent(b, shape) ? ', silent' : ''}`}
                  onClick={() => setShown(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          <div
            className="pat-grid"
            role="group"
            aria-label={pat.bars.length > 1 ? `Bar ${k + 1} of the cycle` : 'The bar'}
          >
            {shape.map((ds, b) =>
              ds.map((d, i) => {
                const on = E.innerOn(bar, b, d);
                const picked = E.innerPicked(bar, b, d);
                return (
                  <div
                    className={`pat-beat${beatNow === b && (now === k || now === null) ? ' pat-now' : ''}`}
                    key={`${b}:${d}`}
                  >
                    {i === 0 ? (
                      <button
                        type="button"
                        className={`pat-cell${b === 0 ? ' one' : ''}`}
                        aria-pressed={E.beatOn(bar, b)}
                        aria-label={`Beat ${b + 1}`}
                        onClick={() => putBar(E.toggleClickBeat(bar, b), { click: true })}
                      >
                        {b + 1}
                      </button>
                    ) : (
                      <span className="pat-cell also" aria-hidden="true" />
                    )}
                    {Array.from({ length: d - 1 }, (_, x) => x + 1).map((j) => (
                      <button
                        key={j}
                        type="button"
                        className={`pat-cell dot${picked ? ' picked' : ''}`}
                        aria-pressed={on.includes(j)}
                        aria-label={`Beat ${b + 1}, the ${nth(j + 1)} of ${d}`}
                        title={`The ${nth(j + 1)} pulse of beat ${b + 1}${mixed ? ` (where it is ${d})` : ''}`}
                        onClick={() =>
                          putBar(E.toggleClickPulse(bar, b, d, j, every ? sameRatio(d) : [b]), {
                            ticks: true,
                          })
                        }
                      />
                    ))}
                    {mixed && d > 1 && (
                      <span className="pat-of" aria-hidden="true">
                        {d}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          {inside && (
            <div className="practice-row pat-scope">
              <span id="pat-scope">A tap on a dot sets</span>
              <div className="segs text" role="group" aria-labelledby="pat-scope">
                <button type="button" aria-pressed={!every} onClick={() => setEvery(false)}>
                  That beat
                </button>
                <button type="button" aria-pressed={every} onClick={() => setEvery(true)}>
                  Every beat
                </button>
              </div>
            </div>
          )}
          <p className="practice-note pat-note">
            <span data-testid="click-said">{said(bar, shape, pat.bars.length > 1 ? k : -1)}</span>
          </p>
          {(!click || !ticks) && (
            <p className="practice-note pat-warn" role="status">
              <span>
                {!click && !ticks
                  ? 'The beats and the subdivision are off in the Mix.'
                  : !click
                    ? 'The beats are off in the Mix: only the 1 of a bar clicks.'
                    : 'The subdivision is off in the Mix: the dots are silent.'}
              </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => set({ click: true, ticks: true })}
              >
                Turn on
              </button>
            </p>
          )}
          <div className="pat-acts">
            <button type="button" className="link-btn" onClick={() => putBar(E.clickBar(false))}>
              Clear the bar
            </button>
            <button type="button" className="link-btn" onClick={() => putBar(E.clickBar(true))}>
              Every click
            </button>
            {k > 0 && (
              <button
                type="button"
                className="link-btn"
                onClick={() => putBar({ ...pat.bars[0]!, sub: { ...pat.bars[0]!.sub } })}
              >
                Like bar 1
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Nothing clicks in this bar, as the piece is now. */
const silent = (bar: E.ClickBar, shape: number[][]) =>
  shape.every((ds, b) => !E.beatOn(bar, b) && ds.every((d) => E.innerOn(bar, b, d).length === 0));

/** A bar's pattern in words, so what was tapped can be checked at a glance. */
function said(bar: E.ClickBar, shape: number[][], k: number): string {
  const head = k >= 0 ? `Bar ${k + 1}: ` : '';
  if (silent(bar, shape)) return `${head}silent.`;
  const beats = shape.map((_, b) => b).filter((b) => E.beatOn(bar, b));
  const parts = [
    beats.length === shape.length
      ? k >= 0
        ? 'every beat'
        : 'Every beat'
      : beats.length
        ? `${k >= 0 ? 'beat' : 'Beat'}${beats.length > 1 ? 's' : ''} ${list(beats.map((b) => b + 1))}`
        : k >= 0
          ? 'no beat'
          : 'No beat',
  ];
  // the pulses inside: beats that share a choice are named together
  const groups = new Map<string, number[]>();
  shape.forEach((ds, b) =>
    ds.forEach((d) => {
      const on = E.innerOn(bar, b, d);
      if (d < 2 || !E.innerPicked(bar, b, d)) return;
      // an empty beat needs words only where the ticks would be expected
      if (!on.length && !bar.base) return;
      const what = on.length ? `the ${list(on.map((j) => nth(j + 1)))} of ${d}` : `nothing inside`;
      groups.set(what, [...(groups.get(what) ?? []), b + 1]);
    }),
  );
  const withInner = shape.filter((ds) => ds.some((d) => d > 1)).length;
  for (const [what, bs] of groups)
    parts.push(
      `${what} in ${bs.length === withInner && bs.length > 1 ? 'every beat' : `beat${bs.length > 1 ? 's' : ''} ${list([...new Set(bs)])}`}`,
    );
  return `${head}${parts.join(' · ')}.`;
}
