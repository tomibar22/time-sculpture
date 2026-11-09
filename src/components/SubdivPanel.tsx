import { useEffect } from 'react';
import * as E from '../engine';
import { beatsHere, subdivideBeats } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';

/**
 * Docked row of ratios for the beats under the selection, range or caret, so the subdivision can
 * change right where you are writing, without going back up to the settings.
 */
export function SubdivPanel() {
  const open = useUiStore((s) => s.subPanel);
  const set = useUiStore((s) => s.set);
  // follow the selection, range and caret, and the document
  useUiStore((s) => s.selection);
  useUiStore((s) => s.range);
  useUiStore((s) => s.caret);
  const meter = useDocStore((s) => s.doc.meter);
  const beats = open ? beatsHere() : [];
  // nothing to work on any more (the caret was removed): close, so it does not pop up later
  useEffect(() => {
    if (open && !beats.length) set({ subPanel: false });
  });
  if (!open || !beats.length) return null;
  const first = E.barBeat(meter, beats[0]!);
  const last = E.barBeat(meter, beats[beats.length - 1]!);
  const where =
    beats.length === 1
      ? `bar ${first.bar}, beat ${first.beat}`
      : `bar ${first.bar} beat ${first.beat} – bar ${last.bar} beat ${last.beat} (${beats.length} beats)`;
  const ds = new Set(beats.map((b) => meter.subdivision[b]));
  const current = ds.size === 1 ? [...ds][0] : null;

  return (
    <div className="fillpanel subpanel" role="group" aria-labelledby="subpanel-h">
      <div className="fill-head">
        <span id="subpanel-h" className="selname">
          Subdivision <span className="dim">· {where}</span>
        </span>
        <button type="button" className="ghost" onClick={() => set({ subPanel: false })}>
          Close
        </button>
      </div>
      <div className="segs ratios">
        {Array.from({ length: E.MAX_SUBDIVISION }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={current === d}
            title={`${d} pulses per beat`}
            onClick={() => subdivideBeats(beats, d)}
          >
            {d}:1
          </button>
        ))}
      </div>
    </div>
  );
}
