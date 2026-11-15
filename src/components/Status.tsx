import * as E from '../engine';
import { adjustEnd } from '../state/actions';
import { beatsLabel } from '../score/draw';
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
      {R === 0 ? <span className="ok">Complete · lands on 1</span> : null}
      {E.isFree(doc.meter) ? <Landing /> : null}
      <span className="seq sr-only" data-testid="sequence">
        {start.join(' ') || '·'} │ {ending.join(' ') || '·'}
      </span>
      <span className="meta">
        {E.meterSummary(doc.meter, !E.isFree(doc.meter))} · {mix.map((d) => `${d}:1`).join(' ')} ·{' '}
        {TS} pulses
      </span>
    </div>
  );
}

/** With modulations: does the whole piece end on beat 1 of the main tempo, and how to get there. */
function Landing() {
  const meter = useDocStore((s) => s.doc.meter);
  const l = E.landing(meter);
  const oneTempo = !E.hasTempoChange(meter);
  if (l.lands)
    return oneTempo ? null : <span className="ok landing">Ends on 1 of the main tempo</span>;
  if (oneTempo)
    return (
      <span className="landing" data-testid="landing">
        <span className="warn">
          The last bar has {l.late} beat{l.late === 1 ? '' : 's'}: it is not whole
        </span>
        {l.fixes.map((n) => (
          <button key={n} type="button" className="link-btn" onClick={() => adjustEnd(n)}>
            {n > 0 ? `Add ${n}` : `Cut ${-n}`} beat{Math.abs(n) === 1 ? '' : 's'} at the end
          </button>
        ))}
      </span>
    );
  const bar = meter.beatsPerCycle;
  const early = bar - l.late;
  return (
    <span className="landing" data-testid="landing">
      <span className="warn">
        Ends {beatsLabel(l.late)} main beat{l.late === 1 ? '' : 's'} after a main 1 (
        {beatsLabel(early)} short of the next)
      </span>
      {l.fixes.map((n) => (
        <button key={n} type="button" className="link-btn" onClick={() => adjustEnd(n)}>
          {n > 0 ? `Add ${n}` : `Cut ${-n}`} beat{Math.abs(n) === 1 ? '' : 's'} at the end
        </button>
      ))}
      {!l.fixes.length && (
        <span className="meta">
          No whole number of beats in the last tempo fixes it; try another equation or bar size
        </span>
      )}
    </span>
  );
}

/**
 * The state of the piece in a few words, at the top of the dock where it is always in sight:
 * how much is still open (and the way to fill it), or that it lands.
 */
export function PieceState() {
  const doc = useDocStore((s) => s.doc);
  const R = E.freePulses(doc);
  if (R === 0) {
    const lands = !E.isFree(doc.meter) || E.landing(doc.meter).lands;
    return (
      <span className="piece-state" data-testid="piece-state">
        <span className="ok">{lands ? 'On the 1' : 'Full'}</span>
      </span>
    );
  }
  return (
    <span className="piece-state" data-testid="piece-state">
      <span className="warn">{R} to go</span>
      <button
        type="button"
        className="link-btn"
        title="Fill the open space: shapes, every way, or at random"
        onClick={() => openFill('browse')}
      >
        Fill it…
      </button>
    </span>
  );
}
