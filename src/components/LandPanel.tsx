import { useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import { describePulse } from '../state/editing';
import { closeFill, fillRegion, previewLanding, writeLanding } from '../state/fill';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Strip, UseBar, useRegionBeats } from './fillParts';
import { CloseIcon } from './Icons';

const SIZES = Array.from({ length: 16 }, (_, i) => i + 1);

/**
 * Land a pattern (third tab of the fill panel): build a pattern of tiles, and see every way it
 * ends exactly on the end of the region: how many times it is said and where it must begin (also
 * as a tihai, three times with a gap). A tap tries one in the score, Use writes it; what is
 * before its first tile stays as it is.
 */
export function LandPanel() {
  const pattern = useUiStore((s) => s.landPattern);
  const clip = useUiStore((s) => s.clipboard);
  const set = useUiStore((s) => s.set);
  useDocStore((s) => s.version);
  const region = fillRegion();
  const beats = useRegionBeats();
  const [trying, setTrying] = useState<E.PatternLanding | null>(null);
  const R = region ? region.b - region.a : 0;
  const a = region?.a ?? 0;
  const p = pattern.reduce((x, n) => x + n, 0);
  const rows = useMemo(() => E.patternLandings(R, pattern), [R, pattern]);
  // another pattern or region: nothing is on trial any more
  useEffect(() => {
    setTrying(null);
    previewLanding(null);
  }, [R, a, pattern]);
  if (!region) return <p className="lib-note">Select a stretch, or leave open space, first.</p>;

  const put = (next: number[]) => set({ landPattern: next });
  const copied = clip.filter((g) => g.kind === 'sound').map((g) => g.n);
  const tryIt = (l: E.PatternLanding) => {
    if (trying?.key === l.key) return write(l);
    setTrying(l);
    previewLanding(l);
  };
  const write = (l: E.PatternLanding) => {
    setTrying(null);
    writeLanding(l);
  };
  /** Where it begins, and whether that is a strong place. */
  const where = (l: E.PatternLanding) => {
    const k = a + l.lead;
    const d = useDocStore.getState().doc;
    const grid = E.buildGrid(d.meter);
    const b = E.beatOfPulse(grid, Math.min(k, grid.TS - 1));
    const onBeat = grid.pre[b] === k;
    const on1 = onBeat && E.barBeat(d.meter, b).beat === 1;
    return { text: describePulse(k), mark: on1 ? 'on 1' : onBeat ? 'on the beat' : '' };
  };

  return (
    <div className="land">
      <div className="land-pattern">
        <span className="land-lbl">Pattern</span>
        <span className="land-tiles" data-testid="land-pattern">
          {pattern.length ? (
            pattern.map((n, i) => (
              <i key={i} style={{ background: sizeColor(n), color: inkFor(sizeColor(n)) }}>
                {n}
              </i>
            ))
          ) : (
            <span className="dim">tap sizes below</span>
          )}
        </span>
        {p > 0 && <span className="land-sum mono">= {p}</span>}
        {copied.length > 0 && copied.join(' ') !== pattern.join(' ') && (
          <button
            type="button"
            className="link-btn"
            title="Use what was copied last as the pattern"
            onClick={() => put(copied)}
          >
            Copied {copied.join(' ')}
          </button>
        )}
        <button
          type="button"
          className="ghost icon"
          aria-label="Remove the last tile of the pattern"
          title="Remove the last tile"
          disabled={!pattern.length}
          onClick={() => put(pattern.slice(0, -1))}
        >
          ⌫
        </button>
        <button type="button" className="ghost" disabled={!pattern.length} onClick={() => put([])}>
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
      <div className="fill-sizes" role="group" aria-label="Add a tile to the pattern">
        {SIZES.map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Add ${n}`}
            data-testid={`land-${n}`}
            disabled={p + n > R}
            style={{ boxShadow: `inset 0 -3px 0 ${sizeColor(n)}, inset 0 0 0 1.5px var(--line)` }}
            onClick={() => put([...pattern, n])}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="lib-note land-hint" role="status">
        {!pattern.length
          ? `Build a pattern: every way it ends exactly on the end of these ${R} pulses is shown, with where it must begin.`
          : rows.length
            ? `${R} pulses to the end: ${p} goes in ${Math.floor(R / p)} times${
                R % p ? `, with ${R % p} left before it` : ', exactly'
              }.`
            : `The pattern (${p}) is longer than the stretch (${R}).`}
      </p>
      <ul
        className="fill-list land-list"
        aria-label="Ways it lands"
        onMouseLeave={() => previewLanding(trying)}
      >
        {rows.map((l) => {
          const w = where(l);
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
                  <Strip
                    sizes={l.lead ? [l.lead, ...l.sizes] : l.sizes}
                    rests={l.lead ? [0] : undefined}
                    beats={beats}
                  />
                  <span className="fill-cap">
                    <span className="land-times">
                      {l.gap ? `Tihai · gap ${l.gap}` : `×${l.times}`}
                    </span>
                    <span className="fill-meta">
                      {l.lead ? `from ${w.text}` : 'fills it exactly'}
                      {w.mark && l.lead ? <b className="land-mark"> · {w.mark}</b> : null}
                    </span>
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <UseBar
        trying={
          trying
            ? {
                sizes: trying.lead ? [trying.lead, ...trying.sizes] : trying.sizes,
                rests: trying.lead ? [0] : undefined,
              }
            : null
        }
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
