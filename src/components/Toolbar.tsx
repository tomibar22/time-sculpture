import { MAX_BEATS, MAX_CYCLES, MAX_SUBDIVISION, MIN_BEATS, MIN_CYCLES } from '../engine';
import { announce, redo, setMeter, undo } from '../state/actions';
import { ui as sfx } from '../audio/voices';
import { useDocStore, useUiStore } from '../state/store';
import type { MoveMode } from '../state/store';
import { RedoIcon, UndoIcon } from './Icons';
import { RowsControl } from './RowsControl';
import { Stepper } from './Stepper';

const MODES: { m: MoveMode; label: string }[] = [
  { m: 'pulse', label: 'Pulse' },
  { m: 'beat', label: 'Beat' },
  { m: 'place', label: 'Place' },
];

export function Toolbar() {
  const meter = useDocStore((s) => s.doc.meter);
  const canUndo = useDocStore((s) => s.past.length > 0);
  const canRedo = useDocStore((s) => s.future.length > 0);
  const brush = useUiStore((s) => s.brush);
  const moveMode = useUiStore((s) => s.moveMode);
  const set = useUiStore((s) => s.set);

  return (
    <div className="toolbar-block">
      <div className="toolbar">
        <Stepper
          label="Beats"
          value={meter.beatsPerCycle}
          min={MIN_BEATS}
          max={MAX_BEATS}
          fewer="Fewer beats per cycle"
          more="More beats per cycle"
          onChange={(b) => setMeter(b, meter.cycles)}
        />
        <Stepper
          label="Cycles"
          value={meter.cycles}
          min={MIN_CYCLES}
          max={MAX_CYCLES}
          fewer="Fewer cycles"
          more="More cycles"
          onChange={(c) => setMeter(meter.beatsPerCycle, c)}
        />
        {meter.cycles > 1 && <RowsControl />}
        <div className="field push">
          <button
            type="button"
            className="icon ghost"
            aria-label="Undo"
            title="Undo (Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="icon ghost"
            aria-label="Redo"
            title="Redo (Y)"
            disabled={!canRedo}
            onClick={redo}
          >
            <RedoIcon />
          </button>
        </div>
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
  );
}
