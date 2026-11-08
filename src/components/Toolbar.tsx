import { MAX_BEATS, MAX_CYCLES, MAX_SUBDIVISION, MIN_BEATS, MIN_CYCLES } from '../engine';
import { announce, setMeter } from '../state/actions';
import { ui as sfx } from '../audio/voices';
import { useDocStore, useUiStore } from '../state/store';
import type { MoveMode } from '../state/store';
import { ChevronIcon } from './Icons';
import { RowsControl } from './RowsControl';
import { Stepper } from './Stepper';

const MODES: { m: MoveMode; label: string }[] = [
  { m: 'pulse', label: 'Pulse' },
  { m: 'beat', label: 'Beat' },
  { m: 'place', label: 'Place' },
];

export function Toolbar() {
  const meter = useDocStore((s) => s.doc.meter);
  const brush = useUiStore((s) => s.brush);
  const moveMode = useUiStore((s) => s.moveMode);
  const open = useUiStore((s) => s.setupOpen);
  const set = useUiStore((s) => s.set);
  const shape = meter.sections?.length
    ? `${meter.cycles} bars · ${meter.sections.length + 1} tempi`
    : `${meter.beatsPerCycle} beats × ${meter.cycles} bar${meter.cycles === 1 ? '' : 's'}`;

  return (
    <div className="toolbar-block">
      {/* phones: the settings fold into one line so the score is on the first screen */}
      <button
        type="button"
        className="setup-toggle"
        aria-expanded={open}
        aria-controls="setup-body"
        onClick={() => set({ setupOpen: !open })}
      >
        <span className="setup-sum">
          <b>{shape}</b>
          <span className="dim">
            {' '}
            · brush {brush}:1 · drag by {moveMode}
          </span>
        </span>
        <ChevronIcon />
      </button>
      <div id="setup-body" className={`setup-body ${open ? 'open' : ''}`}>
        <div className="toolbar">
          <Stepper
            label="Beats"
            value={meter.beatsPerCycle}
            min={MIN_BEATS}
            max={MAX_BEATS}
            fewer="Fewer beats per bar"
            more="More beats per bar"
            onChange={(b) => setMeter(b, meter.cycles)}
          />
          <Stepper
            label="Bars"
            value={meter.cycles}
            min={MIN_CYCLES}
            max={MAX_CYCLES}
            fewer="Fewer bars"
            more="More bars"
            onChange={(c) => setMeter(meter.beatsPerCycle, c)}
          />
          <RowsControl />
        </div>
        <div className="field wrap-field">
          <span id="lbl-sub">Subdivision</span>
          <div
            className="segs ratios"
            role="group"
            aria-label="Subdivision brush, pulses per beat"
            aria-describedby="sub-hint"
          >
            {Array.from({ length: MAX_SUBDIVISION }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={brush === d}
                title={`${d} pulses per beat`}
                onClick={() => {
                  set({ brush: d });
                  sfx.snap();
                  announce(`Brush ${d}:1. Paint the dotted band under the tiles.`);
                }}
              >
                {d}:1
              </button>
            ))}
          </div>
          <span id="sub-hint" className="sr-only">
            Pick a ratio, then tap or drag along the dotted band under the tiles. With groups
            selected, press B.
          </span>
        </div>
        <div className="field wrap-field">
          <span id="lbl-move">Dragging moves by</span>
          <div className="segs text" role="group" aria-labelledby="lbl-move">
            {MODES.map(({ m, label }) => (
              <button
                key={m}
                type="button"
                aria-pressed={moveMode === m}
                onClick={() => {
                  set({ moveMode: m });
                  sfx.snap();
                  announce(
                    m === 'place'
                      ? 'Dragging reorders groups'
                      : `Dragging moves groups one ${m} at a time`,
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
