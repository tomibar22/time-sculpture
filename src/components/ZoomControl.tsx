import { useEffect, useState } from 'react';
import { zoomLabel, zoomLevels } from '../score/rows';
import { useDocStore, useUiStore } from '../state/store';
import { toggleOverview, zoomStep } from '../state/zoom';
import { FitIcon } from './Icons';

/** − level + and ⤢ (everything): how much a score row holds. Pinch and ⌥ − = 0 do the same. */
export function ZoomControl() {
  const per = useUiStore((s) => s.perRow);
  const overview = useUiStore((s) => s.overview);
  const meter = useDocStore((s) => s.doc.meter);
  const ls = zoomLevels(meter.beatsPerCycle, meter.cycles);
  const level = overview ? 'Everything' : `${zoomLabel(meter.beatsPerCycle, per)} per row`;
  return (
    <div className="zoom" role="group" aria-label="Zoom">
      <button
        type="button"
        className="icon ghost"
        aria-label="Zoom out"
        title="Zoom out: more in a row (⌥−, pinch)"
        disabled={overview || per >= ls[ls.length - 1]! - 1e-9}
        onClick={() => zoomStep(-1)}
      >
        −
      </button>
      <span className="zoom-level" data-testid="zoom-level">
        {level}
      </span>
      <button
        type="button"
        className="icon ghost"
        aria-label="Zoom in"
        title="Zoom in: less in a row, wider beats (⌥=, pinch)"
        disabled={!overview && per <= ls[0]! + 1e-9}
        onClick={() => zoomStep(1)}
      >
        +
      </button>
      <button
        type="button"
        className="icon ghost"
        aria-pressed={overview}
        aria-label="See everything"
        title="See the whole piece (⌥0). Tap a place in it to zoom in there."
        onClick={toggleOverview}
      >
        <FitIcon />
      </button>
    </div>
  );
}

/** A quiet label in the middle of the screen while zooming (the level is also announced). */
export function ZoomHud() {
  const hud = useUiStore((s) => s.zoomHud);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!hud) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), 1100);
    return () => clearTimeout(t);
  }, [hud]);
  if (!hud) return null;
  return (
    <div className={`zoom-hud ${shown ? 'on' : ''}`} aria-hidden="true">
      {hud.text}
    </div>
  );
}
