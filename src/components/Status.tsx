import * as E from '../engine';
import { fillWithSilence } from '../state/actions';
import { openFill } from '../state/fill';
import { useDocStore } from '../state/store';

export function Status() {
  const doc = useDocStore((s) => s.doc);
  const R = E.freePulses(doc);
  const { start, ending } = E.sequence(doc);
  const mix = [...new Set(doc.meter.subdivision)].sort((a, b) => a - b);
  const TS = E.buildGrid(doc.meter).TS;

  return (
    <div className="status" data-testid="status">
      {R === 0 ? (
        <span className="ok">Complete · lands on 1</span>
      ) : (
        <span className="open-state">
          <span className="warn">{R} open</span>
          <button type="button" className="link-btn" onClick={fillWithSilence}>
            Fill with silence
          </button>
          <button type="button" className="link-btn" onClick={() => openFill('random')}>
            Fill randomly…
          </button>
          <button type="button" className="link-btn" onClick={() => openFill('browse')}>
            Browse fills…
          </button>
        </span>
      )}
      <span className="seq sr-only" data-testid="sequence">
        {start.join(' ') || '·'} │ {ending.join(' ') || '·'}
      </span>
      <span className="meta">
        {doc.meter.beatsPerCycle}×{doc.meter.cycles} · {mix.map((d) => `${d}:1`).join(' ')} · {TS}{' '}
        pulses
      </span>
    </div>
  );
}
