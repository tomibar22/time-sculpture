import { togglePlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { useDocStore, useUiStore } from '../state/store';
import { PlayIcon, StopIcon } from './Icons';

function Readout() {
  const meter = useDocStore((s) => s.doc.meter);
  const label = useUiStore((s) => {
    if (s.playhead === null) return null;
    const bt = Math.floor(s.playhead + 1e-9);
    return `${Math.floor(bt / meter.beatsPerCycle) + 1}|${(bt % meter.beatsPerCycle) + 1}|${meter.subdivision[Math.min(bt, meter.subdivision.length - 1)]}`;
  });
  if (!label)
    return (
      <div className="now">
        <b>{meter.beatsPerCycle}</b> beats · {meter.cycles} cycle{meter.cycles > 1 ? 's' : ''}
      </div>
    );
  const [cyc, beat, d] = label.split('|');
  return (
    <div className="now" aria-hidden="true">
      cycle {cyc} · beat <b>{beat}</b> · {d}:1
    </div>
  );
}

export function Transport() {
  const playing = useUiStore((s) => s.playing);
  const tempo = useUiStore((s) => s.tempo);
  const set = useUiStore((s) => s.set);
  return (
    <div className="transport" role="region" aria-label="Transport">
      <div className="tinner">
        <button
          type="button"
          className="bigplay"
          aria-label={playing ? 'Stop' : 'Play'}
          title="Play / stop (Space)"
          onClick={togglePlayback}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
        </button>
        <Readout />
        <label className="tempo">
          <span aria-hidden="true">♩</span>
          <span className="sr-only">Tempo, beats per minute</span>
          <input
            type="range"
            min={MIN_TEMPO}
            max={MAX_TEMPO}
            value={tempo}
            onChange={(e) => set({ tempo: +e.target.value })}
          />
          <span className="mono">{tempo}</span>
        </label>
      </div>
    </div>
  );
}
