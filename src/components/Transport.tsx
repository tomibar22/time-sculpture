import { useEffect, useRef } from 'react';
import { barBeat } from '../engine';
import { togglePlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { useDocStore, useUiStore } from '../state/store';
import { redo, undo } from '../state/actions';
import { PlayIcon, RedoIcon, StopIcon, UndoIcon } from './Icons';
import { Keypad } from './Keypad';
import { FillPanel } from './FillPanel';
import { SelectionBar } from './SelectionBar';
import { SubdivPanel } from './SubdivPanel';
import { DOCKED, PHONE, useMedia } from './useMedia';

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
      <div className="now idle">
        <b>{meter.beatsPerCycle}</b> beats · {meter.cycles} bar{meter.cycles > 1 ? 's' : ''}
      </div>
    );
  const [cyc, beat, d] = label.split('|');
  return (
    <div className="now" aria-hidden="true">
      <span className="now-long">
        bar {cyc} · beat <b>{beat}</b> · {d}:1
      </span>
      <span className="now-short">
        {cyc}·<b>{beat}</b>
      </span>
    </div>
  );
}

/** The bottom dock: the number pad (when shown) above the transport. */
export function Dock() {
  const keypad = useUiStore((s) => s.keypad);
  // while the subdivision row is open it takes the number pad's place, so the score stays in view
  const subPanel = useUiStore((s) => s.subPanel);
  const docked = useMedia(DOCKED);
  // on a phone an open fill panel takes the place of the bar and the pad, so the score (and the
  // preview in it) stays in view
  const phone = useMedia(PHONE);
  const filling = useUiStore((s) => s.fillPanel !== null) && phone;
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
    <div className="dock" ref={ref} role="region" aria-label="Tools">
      <div className="dock-inner">
        <FillPanel />
        <SubdivPanel />
        {docked && !filling && <SelectionBar />}
        {keypad && !subPanel && !filling && <Keypad />}
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
  const canUndo = useDocStore((s) => s.past.length > 0);
  const canRedo = useDocStore((s) => s.future.length > 0);
  return (
    <div className="transport" role="region" aria-label="Transport">
      <div className="tinner">
        <button
          type="button"
          className="bigplay"
          aria-label={playing ? 'Stop' : 'Play'}
          title="Play / stop (Space). With a selection, only the selection plays."
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
        </label>
        <button
          type="button"
          className="ghost tempo-num mono"
          title="Tempo: tap it, or set it exactly"
          aria-haspopup="dialog"
          onClick={() => set({ tempoDialog: true })}
        >
          <span className="sr-only">Tempo </span>
          {tempo}
        </button>
        <div className="undo-redo">
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
