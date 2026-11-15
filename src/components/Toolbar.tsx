import { MAX_BEATS, MAX_CYCLES, MIN_BEATS, MIN_CYCLES } from '../engine';
import { addBarAtEnd, addBarAtStart, announce, setMeter } from '../state/actions';
import { ui as sfx } from '../audio/voices';
import { useDocStore, useUiStore } from '../state/store';
import type { MoveMode } from '../state/store';
import { ChevronIcon } from './Icons';
import { ZoomControl } from './ZoomControl';
import { RowsControl } from './RowsControl';
import { Stepper } from './Stepper';

const MODES: { m: MoveMode; label: string }[] = [
  { m: 'pulse', label: 'Pulse' },
  { m: 'beat', label: 'Beat' },
  { m: 'place', label: 'Place' },
];

export function Toolbar() {
  const meter = useDocStore((s) => s.doc.meter);
  const mix = [...new Set(meter.subdivision)]
    .sort((a, b) => a - b)
    .map((d) => `${d}:1`)
    .join(' ');
  const moveMode = useUiStore((s) => s.moveMode);
  const open = useUiStore((s) => s.setupOpen);
  const set = useUiStore((s) => s.set);
  const shape = meter.sections?.length
    ? `${meter.cycles} bars · ${meter.sections.length + 1} tempi`
    : `${meter.beatsPerCycle} beats × ${meter.cycles} bar${meter.cycles === 1 ? '' : 's'}`;
  const short = meter.sections?.length
    ? `${meter.cycles} bars`
    : `${meter.beatsPerCycle}×${meter.cycles}`;

  return (
    <div className="toolbar-block">
      <div className="score-head">
        {/* phones and tablets: the settings fold into one line so the score is on the first screen */}
        <button
          type="button"
          className="setup-toggle"
          aria-expanded={open}
          aria-controls="setup-body"
          onClick={() => set({ setupOpen: !open })}
        >
          {/* a phone has room for the short form only; cut off, the long one said nothing */}
          <span className="setup-sum sum-long">
            <b>{shape}</b>
            <span className="dim">
              {' '}
              · {mix} · drag by {moveMode}
            </span>
          </span>
          <span className="setup-sum sum-short" aria-hidden="true">
            <b>{short}</b>
            <span className="dim">
              {' '}
              · {mix} · {moveMode}
            </span>
          </span>
          <ChevronIcon />
        </button>
        <ZoomControl />
      </div>
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
          <button
            type="button"
            className="ghost rows-btn"
            title="Add an empty bar before the beginning, for an opening"
            onClick={addBarAtStart}
          >
            + Bar at the start
          </button>
          <button
            type="button"
            className="ghost rows-btn"
            title="Add an empty bar after the end, to go on writing"
            onClick={addBarAtEnd}
          >
            + Bar at the end
          </button>
          <RowsControl />
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
