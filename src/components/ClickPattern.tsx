import * as E from '../engine';
import { useDocStore, useUiStore } from '../state/store';

/** "2nd", "3rd": the place of a pulse in its beat, counted from the beat itself. */
const nth = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/**
 * The click as a rhythm of its own (in the practice popover): a switch, and under it three rows
 * of cells to tap. Beats: which beats of the bar click. In a beat of N (one row for every ratio
 * the piece has): which pulses inside a beat click; the first cell is the beat itself, set in the
 * row above. Bars: a cycle of bars, and which of them have the click. Off, the click is the plain
 * one and the pattern is kept.
 */
export function ClickPatternSection() {
  const pat = useUiStore((s) => s.clickPat);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const put = (next: Partial<E.ClickPattern>, more: { click?: boolean; ticks?: boolean } = {}) =>
    set({ clickPat: { ...pat, ...next }, ...more });

  // the longest bar of the piece, and the ratios it has (a beat of 1 has nothing inside)
  const map = E.barMap(meter);
  let beats = 1;
  for (let i = 0; i < map.barStarts.length; i++)
    beats = Math.max(beats, (map.barStarts[i + 1] ?? map.NB) - map.barStarts[i]!);
  beats = Math.round(beats);
  const ratios = [...new Set(meter.subdivision)].filter((d) => d >= 2).sort((a, b) => a - b);

  const toggleBeat = (b: number) =>
    put(
      { off: pat.off.includes(b) ? pat.off.filter((x) => x !== b) : [...pat.off, b].sort() },
      { click: true },
    );
  const inner = (d: number) => pat.sub[d] ?? Array.from({ length: d - 1 }, (_, i) => i + 1);
  const togglePulse = (d: number, j: number) => {
    const now = inner(d);
    const next = now.includes(j) ? now.filter((x) => x !== j) : [...now, j].sort();
    put({ sub: { ...pat.sub, [d]: next } }, { ticks: true });
  };
  const toggleBar = (b: number) => {
    const next = pat.bars.includes(b) ? pat.bars.filter((x) => x !== b) : [...pat.bars, b].sort();
    if (next.length) put({ bars: next });
  };
  const changed =
    pat.off.length > 0 || pat.every > 1 || ratios.some((d) => inner(d).length < d - 1);

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
          onClick={() => put({ on: !pat.on })}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
        </button>
      </div>
      {pat.on && (
        <>
          <div className="pat-row">
            <span className="pat-lbl" id="pat-beats">
              Beats
            </span>
            <div className="pat-cells" role="group" aria-labelledby="pat-beats">
              {Array.from({ length: beats }, (_, b) => (
                <button
                  key={b}
                  type="button"
                  className={`pat-cell${b === 0 ? ' one' : ''}`}
                  aria-pressed={!pat.off.includes(b)}
                  aria-label={`Beat ${b + 1}`}
                  onClick={() => toggleBeat(b)}
                >
                  {b + 1}
                </button>
              ))}
            </div>
          </div>
          {ratios.map((d) => (
            <div className="pat-row" key={d}>
              <span className="pat-lbl" id={`pat-in-${d}`}>
                In a beat of {d}
              </span>
              <div className="pat-cells" role="group" aria-labelledby={`pat-in-${d}`}>
                <span className="pat-cell beat" title="The beat itself: set in the row above">
                  <span className="sr-only">The beat itself</span>
                </span>
                {Array.from({ length: d - 1 }, (_, i) => i + 1).map((j) => (
                  <button
                    key={j}
                    type="button"
                    className="pat-cell dot"
                    aria-pressed={inner(d).includes(j)}
                    aria-label={`The ${nth(j + 1)} of ${d}`}
                    title={`The ${nth(j + 1)} pulse of a beat of ${d}`}
                    onClick={() => togglePulse(d, j)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="pat-row">
            <span className="pat-lbl" id="pat-bars">
              Bars
            </span>
            <div className="pat-cells" role="group" aria-labelledby="pat-bars">
              {Array.from({ length: pat.every }, (_, b) => (
                <button
                  key={b}
                  type="button"
                  className="pat-cell bar"
                  aria-pressed={pat.bars.includes(b)}
                  aria-label={`Bar ${b + 1} of ${pat.every}`}
                  onClick={() => toggleBar(b)}
                >
                  {b + 1}
                </button>
              ))}
            </div>
            <div className="pat-cycle" role="group" aria-label="Bars in the cycle">
              <button
                type="button"
                aria-label="One bar less in the cycle"
                disabled={pat.every <= 1}
                onClick={() => put(E.withClickBars(pat, pat.every - 1))}
              >
                −
              </button>
              <button
                type="button"
                aria-label="One bar more in the cycle"
                disabled={pat.every >= E.MAX_CLICK_BARS}
                onClick={() => put(E.withClickBars(pat, pat.every + 1))}
              >
                +
              </button>
            </div>
          </div>
          <p className="practice-note pat-note">
            <span data-testid="click-said">{said(pat, beats, ratios)}</span>
            {changed && (
              <button
                type="button"
                className="link-btn"
                onClick={() => put({ off: [], sub: {}, every: 1, bars: [0] })}
              >
                Every beat again
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}

/** The pattern in words, so what was tapped can be checked at a glance. */
function said(p: E.ClickPattern, beats: number, ratios: number[]): string {
  const list = (a: (number | string)[]) =>
    a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  const on = Array.from({ length: beats }, (_, b) => b).filter((b) => !p.off.includes(b));
  const parts = [
    on.length === beats
      ? 'Every beat'
      : on.length
        ? `Beat${on.length > 1 ? 's' : ''} ${list(on.map((b) => b + 1))}`
        : 'No beat',
  ];
  for (const d of ratios)
    if (E.pickedIn(p, d)) {
      const s = p.sub[d]!;
      parts.push(
        s.length ? `the ${list(s.map((j) => nth(j + 1)))} of ${d}` : `nothing inside ${d}`,
      );
    }
  if (p.every > 1)
    parts.push(
      p.bars.length === 1
        ? `bar ${p.bars[0]! + 1} of every ${p.every}`
        : `bars ${list(p.bars.map((b) => b + 1))} of every ${p.every}`,
    );
  return `${parts.join(' · ')}.`;
}
