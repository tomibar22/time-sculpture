import { useEffect, useRef, useState } from 'react';
import { ui as sfx } from '../audio/voices';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { useUiStore } from '../state/store';

const clampTempo = (v: number) => Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(v)));
/** Italian names, as a musician thinks of a tempo. */
const NAMES: [number, string][] = [
  [50, 'Largo'],
  [66, 'Adagio'],
  [80, 'Andante'],
  [108, 'Moderato'],
  [132, 'Allegro'],
  [168, 'Vivace'],
  [Infinity, 'Presto'],
];
export const tempoName = (bpm: number) => NAMES.find(([max]) => bpm < max)![1];

/**
 * The tempo, exactly: − and + by one or five, a slider, and Tap (tap the beat a few times; the
 * average of the last taps becomes the tempo). Opened from the tempo number in the transport.
 */
export function TempoDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useUiStore((s) => s.tempoDialog);
  const tempo = useUiStore((s) => s.tempo);
  const set = useUiStore((s) => s.set);
  const taps = useRef<number[]>([]);
  const [tapped, setTapped] = useState(0);

  useEffect(() => {
    if (!open) return dialog.current?.close();
    taps.current = [];
    setTapped(0);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  const close = () => set({ tempoDialog: false });
  const step = (d: number) => set({ tempo: clampTempo(useUiStore.getState().tempo + d) });
  const tap = () => {
    const now = performance.now();
    const t = taps.current;
    // a long pause starts a new count
    if (t.length && now - t[t.length - 1]! > 2500) t.length = 0;
    t.push(now);
    if (t.length > 6) t.shift();
    sfx.snap();
    setTapped(t.length);
    if (t.length >= 2) set({ tempo: clampTempo(60000 / ((now - t[0]!) / (t.length - 1))) });
  };

  return (
    <dialog
      ref={dialog}
      className="library tempo-dialog"
      aria-labelledby="tempo-h"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="lib-inner">
        <div className="lib-head">
          <h2 id="tempo-h">Tempo</h2>
          <button type="button" className="ghost" onClick={close}>
            Done
          </button>
        </div>
        <div className="tempo-big" aria-live="polite">
          <span className="tempo-note" aria-hidden="true">
            ♩ =
          </span>
          <output data-testid="tempo-value">{tempo}</output>
          <span className="tempo-name">{tempoName(tempo)}</span>
        </div>
        <div className="tempo-steps" role="group" aria-label="Change the tempo">
          <button type="button" aria-label="5 slower" onClick={() => step(-5)}>
            −5
          </button>
          <button type="button" aria-label="1 slower" onClick={() => step(-1)}>
            −1
          </button>
          <button type="button" aria-label="1 faster" onClick={() => step(1)}>
            +1
          </button>
          <button type="button" aria-label="5 faster" onClick={() => step(5)}>
            +5
          </button>
        </div>
        <label className="tempo-slide">
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
          className="primary tempo-tap"
          onPointerDown={tap}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!e.repeat) tap();
            }
          }}
        >
          Tap the beat
          <span className="tempo-tap-hint">
            {tapped < 2 ? 'a few taps set the tempo' : `${tapped} taps`}
          </span>
        </button>
      </div>
    </dialog>
  );
}
