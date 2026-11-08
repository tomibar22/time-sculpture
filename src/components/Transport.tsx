import { useEffect, useRef } from 'react';
import { barBeat } from '../engine';
import { togglePlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { useDocStore, useUiStore } from '../state/store';
import { PlayIcon, StopIcon } from './Icons';
import { Keypad } from './Keypad';
import { FillPanel } from './FillPanel';

function Readout() {
  const meter = useDocStore((s) => s.doc.meter);
  const label = useUiStore((s) => {
    if (s.playhead === null) return null;
    const bt = Math.floor(s.playhead + 1e-9);
    const bb = barBeat(meter, bt);
    return `${bb.bar}|${bb.beat}|${meter.subdivision[Math.min(bt, meter.subdivision.length - 1)]}`;
  });
  if (!label)
    return (
      <div className="now">
        <b>{meter.beatsPerCycle}</b> beats · {meter.cycles} bar{meter.cycles > 1 ? 's' : ''}
      </div>
    );
  const [cyc, beat, d] = label.split('|');
  return (
    <div className="now" aria-hidden="true">
      bar {cyc} · beat <b>{beat}</b> · {d}:1
    </div>
  );
}

/** The bottom dock: the number pad (when shown) above the transport. */
export function Dock() {
  const keypad = useUiStore((s) => s.keypad);
  const ref = useRef<HTMLDivElement>(null);
  // let the page and the toasts keep clear of the dock, whatever its height
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="dock" ref={ref}>
      <div className="dock-inner">
        <FillPanel />
        {keypad && <Keypad />}
        <Transport />
      </div>
    </div>
  );
}

function Transport() {
  const playing = useUiStore((s) => s.playing);
  const tempo = useUiStore((s) => s.tempo);
  const keypad = useUiStore((s) => s.keypad);
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
        <button
          type="button"
          className="icon ghost pad-toggle"
          aria-pressed={keypad}
          title="Show or hide the number pad"
          onClick={() => set({ keypad: !keypad })}
        >
          123<span className="sr-only"> number pad</span>
        </button>
      </div>
    </div>
  );
}
