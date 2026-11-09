import { useEffect, useRef, useState } from 'react';
import { barBeat, barMap } from '../engine';
import { togglePlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { enterStage, exitStage, setStagePrefs } from '../state/stage';
import { useDocStore, useUiStore } from '../state/store';
import type { StagePrefs, StageSound } from '../state/store';
import { Score } from '../score/Score';
import { CloseIcon, PlayIcon, StageIcon, StopIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { ZoomControl } from './ZoomControl';

/** How long the controls stay after a tap while playing. */
const SHOW_MS = 2600;

const COUNT_LABEL: Record<StagePrefs['countIn'], string> = { 0: 'off', 1: '1 bar', 2: '2 bars' };
const SOUND_ORDER: StageSound[] = ['all', 'click', 'off'];
const SOUND_LABEL: Record<StageSound, string> = { all: 'all', click: 'click only', off: 'silent' };

/** The way into the stage, in the header. */
export function StageButton() {
  return (
    <button
      type="button"
      className="ghost stage-open"
      title="Stage: a clean, full-screen score that follows the music, for filming a performance (F)"
      onClick={enterStage}
    >
      <StageIcon />
      <span>Stage</span>
    </button>
  );
}

/** Where the music is: "bar 3 / 8" (bar numbers count every bar, sections included). */
function BarCounter() {
  const meter = useDocStore((s) => s.doc.meter);
  const bar = useUiStore((s) =>
    s.playhead === null ? null : barBeat(meter, Math.floor(s.playhead + 1e-9)).bar,
  );
  const total = barMap(meter).barStarts.length;
  return (
    <span className="stage-bars mono" aria-hidden="true">
      {bar === null ? `${total} bar${total > 1 ? 's' : ''}` : `bar ${bar} / ${total}`}
    </span>
  );
}

/**
 * The stage: the score alone, for filming a performance so listeners can follow it. Nothing
 * edits; the score follows the playhead, the sounding group lights up and played ones fade back;
 * an optional count-in, sound choice and play-once (it stops when it lands on 1). The controls
 * fade away while playing; a tap brings them back.
 */
export function Stage() {
  const playing = useUiStore((s) => s.playing);
  const countdown = useUiStore((s) => s.countdown);
  const prefs = useUiStore((s) => s.stagePrefs);
  const tempo = useUiStore((s) => s.tempo);
  const name = useUiStore((s) => s.currentName);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const [shown, setShown] = useState(true);
  const timer = useRef(0);

  // stopped: the controls are there; playing: they fade (after the count-in has begun)
  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing) setShown(true);
    else timer.current = window.setTimeout(() => setShown(false), 500);
    return () => clearTimeout(timer.current);
  }, [playing]);

  const reveal = () => {
    setShown(true);
    clearTimeout(timer.current);
    if (useUiStore.getState().playing)
      timer.current = window.setTimeout(() => setShown(false), SHOW_MS);
  };

  const beats = meter.beatsPerCycle;
  return (
    <div className={`stage${shown ? '' : ' quiet'}`} onPointerDown={reveal}>
      <header className="stage-head">
        <h1>{name}</h1>
        <span className="stage-meta mono">
          ♩ = {tempo} · {beats} beats
        </span>
        <BarCounter />
      </header>

      <section className="stage-score" aria-label="Score">
        <Score />
      </section>

      {countdown && (
        <div className="countdown" key={countdown.beat} aria-hidden="true">
          {countdown.beat}
        </div>
      )}

      <div className="stage-bar" role="toolbar" aria-label="Stage controls">
        <div className="stage-bar-inner">
          <button
            type="button"
            className="icon ghost"
            title="Leave the stage (Esc)"
            onClick={exitStage}
          >
            <CloseIcon />
            <span className="sr-only">Leave the stage</span>
          </button>
          <button
            type="button"
            className="bigplay"
            aria-label={playing ? 'Stop' : 'Play'}
            title="Play / stop (Space)"
            onClick={togglePlayback}
          >
            {playing ? <StopIcon /> : <PlayIcon />}
          </button>
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
          <div className="stage-opts">
            <button
              type="button"
              className="ghost"
              title="Bars counted in before the piece starts"
              onClick={() =>
                setStagePrefs({ countIn: ((prefs.countIn + 1) % 3) as StagePrefs['countIn'] })
              }
            >
              Count-in <b>{COUNT_LABEL[prefs.countIn]}</b>
            </button>
            <button
              type="button"
              className="ghost"
              title="What is heard: the groups and the click, only the click, or nothing (the score just moves)"
              onClick={() =>
                setStagePrefs({
                  sound: SOUND_ORDER[(SOUND_ORDER.indexOf(prefs.sound) + 1) % SOUND_ORDER.length]!,
                })
              }
            >
              Sound <b>{SOUND_LABEL[prefs.sound]}</b>
            </button>
            <button
              type="button"
              className="ghost"
              aria-pressed={prefs.loop}
              title="Play again from the top, or stop when the piece lands on 1"
              onClick={() => setStagePrefs({ loop: !prefs.loop })}
            >
              Loop
            </button>
            <ZoomControl />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
