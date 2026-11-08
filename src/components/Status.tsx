import * as E from '../engine';
import { useDocStore, useUiStore } from '../state/store';

const fmt = (n: bigint) => n.toLocaleString('en-US');

export function Status() {
  const doc = useDocStore((s) => s.doc);
  const tray = useUiStore((s) => s.tray);
  const R = E.freePulses(doc);
  const ways = E.countWays(R, tray);
  const { start, ending } = E.sequence(doc);
  const traySet = new Set(tray);
  const off = [
    ...new Set(
      doc.items
        .filter((x) => E.isGroup(x) && x.kind === 'sound' && !traySet.has(x.n))
        .map((x) => x.n),
    ),
  ];
  const mix = [...new Set(doc.meter.subdivision)].sort((a, b) => a - b);
  const TS = E.buildGrid(doc.meter).TS;

  return (
    <div className="status" data-testid="status">
      {R === 0 ? (
        <span className="ok">Complete · lands on 1</span>
      ) : ways > 0n ? (
        <span>
          <span className="warn">{R} open</span>{' '}
          <span className="meta">{`${fmt(ways)} way${ways === 1n ? '' : 's'} to fill it`}</span>
        </span>
      ) : (
        <span>
          <span className="warn">{R} open</span>{' '}
          <span className="meta">the tray can&apos;t fill it; stretch or use silence</span>
        </span>
      )}
      <span className="seq" data-testid="sequence">
        {start.join(' ') || '·'} │ {ending.join(' ') || '·'}
      </span>
      <span className="meta">
        {doc.meter.beatsPerCycle}×{doc.meter.cycles} · {mix.map((d) => `${d}:1`).join(' ')} · {TS}{' '}
        pulses
        {off.length ? ` · ${off.join(', ')} off-tray` : ''}
      </span>
    </div>
  );
}
