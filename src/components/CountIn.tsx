import { useEffect, useRef, useState } from 'react';
import { stopPlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { MIX_DEFAULT, useUiStore } from '../state/store';
import type { MixChannel, TilesMode } from '../state/store';
import { MetronomeIcon } from './Icons';

const COUNT = [
  [0, 'Off'],
  [1, '1 bar'],
  [2, '2 bars'],
] as const;
const TILES: [TilesMode, string][] = [
  ['on', 'Heard'],
  ['off', 'Silent'],
  ['turns', 'In turn'],
];

/**
 * Practice, beside Play: one button (a metronome) opens a small popover with the count-in (off,
 * 1 bar, 2 bars) and whether the tiles are heard, silent (the click alone), or heard and silent
 * in turn, so many times round each. The button is lit while any of it is on, with the count-in's
 * bars as a small number. Remembered on this device.
 */
export function PracticeButton() {
  const countIn = useUiStore((s) => s.countIn);
  const tiles = useUiStore((s) => s.tiles);
  const turns = useUiStore((s) => s.turns);
  const countSub = useUiStore((s) => s.countSub);
  const open = useUiStore((s) => s.practiceOpen);
  const set = useUiStore((s) => s.set);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) =>
      !wrap.current?.contains(e.target as Node) && set({ practiceOpen: false });
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      set({ practiceOpen: false });
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc, true);
    };
  }, [open, set]);
  const on = countIn > 0 || tiles !== 'on';
  const said = [
    countIn ? `count-in ${countIn === 1 ? '1 bar' : '2 bars'}` : '',
    tiles === 'off' ? 'tiles silent' : tiles === 'turns' ? 'tiles in turn' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const turn = (k: 'on' | 'off', d: number) =>
    set({ turns: { ...turns, [k]: Math.max(1, Math.min(8, turns[k] + d)) } });
  return (
    <span className="practice" ref={wrap}>
      <button
        type="button"
        className={`icon ghost count-btn${on ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Practice: count-in, and the tiles heard or silent${said ? ` (${said})` : ''}`}
        data-testid="practice"
        onClick={() => set({ practiceOpen: !open })}
      >
        <MetronomeIcon />
        {countIn > 0 && (
          <span className="count-n" aria-hidden="true">
            {countIn}
          </span>
        )}
        {tiles !== 'on' && <span className="count-mute" aria-hidden="true" />}
        <span className="sr-only">Practice{said ? `: ${said}` : ''}</span>
      </button>
      {open && (
        <div className="practice-pop" role="dialog" aria-label="Practice">
          <TempoRow />
          <div className="practice-row">
            <span id="pr-count">Count-in</span>
            <div className="segs text" role="group" aria-labelledby="pr-count">
              {COUNT.map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={countIn === n}
                  onClick={() => set({ countIn: n })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {countIn > 0 && (
            <div className="practice-row sub">
              <span id="pr-sub">Count the subdivision too</span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={countSub}
                aria-labelledby="pr-sub"
                data-testid="count-sub"
                onClick={() => set({ countSub: !countSub })}
              >
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-knob" />
                </span>
              </button>
            </div>
          )}
          <div className="practice-row">
            <span id="pr-tiles">Tiles</span>
            <div className="segs text" role="group" aria-labelledby="pr-tiles">
              {TILES.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tiles === id}
                  onClick={() => set({ tiles: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {tiles === 'turns' && (
            <div className="practice-turns">
              <Turns label="Heard" value={turns.on} onStep={(d) => turn('on', d)} />
              <Turns label="Silent" value={turns.off} onStep={(d) => turn('off', d)} />
            </div>
          )}
          {tiles !== 'on' && (
            <p className="practice-note">
              {tiles === 'off'
                ? 'Only the click sounds: the tiles are yours to play.'
                : `${times(turns.on)} round with the tiles, then ${times(turns.off).toLowerCase()} with the click alone.`}
            </p>
          )}
          <Mixer />
        </div>
      )}
    </span>
  );
}

const clampTempo = (v: number) => Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(v)));

/** The tempo, typed: a number field between − and +. Enter or leaving the field sets it. */
function TempoRow() {
  const tempo = useUiStore((s) => s.tempo);
  const set = useUiStore((s) => s.set);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = parseInt(draft, 10);
    if (Number.isFinite(v)) set({ tempo: clampTempo(v) });
    setDraft(null);
  };
  const step = (d: number) => {
    setDraft(null);
    set({ tempo: clampTempo(useUiStore.getState().tempo + d) });
  };
  return (
    <div className="practice-row">
      <label htmlFor="pr-tempo">Tempo</label>
      <div className="practice-tempo">
        <button type="button" aria-label="1 slower" onClick={() => step(-1)}>
          −
        </button>
        <span className="practice-bpm">
          <span aria-hidden="true">♩</span>
          <input
            id="pr-tempo"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={3}
            title={`Beats per minute, ${MIN_TEMPO} to ${MAX_TEMPO}`}
            data-testid="practice-tempo"
            value={draft ?? String(tempo)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
                (e.target as HTMLInputElement).select();
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                step(e.key === 'ArrowUp' ? 1 : -1);
              }
            }}
          />
        </span>
        <button type="button" aria-label="1 faster" onClick={() => step(1)}>
          +
        </button>
      </div>
    </div>
  );
}

const CHANNELS: [MixChannel, string, string][] = [
  ['drum', 'Drum', 'The tiles'],
  ['one', 'The 1', 'The first beat of every bar'],
  ['beat', 'Beats', 'The other beats'],
  ['sub', 'Subdivision', 'The ticks inside a beat'],
];

/**
 * The mixer: one fader for each voice. Beats and Subdivision are also the two "hear" options:
 * a fader pulled to nothing turns its voice off, and moving it turns the voice on again.
 */
function Mixer() {
  const mix = useUiStore((s) => s.mix);
  const click = useUiStore((s) => s.click);
  const ticks = useUiStore((s) => s.ticks);
  const set = useUiStore((s) => s.set);
  const shown = (ch: MixChannel) =>
    (ch === 'beat' && !click) || (ch === 'sub' && !ticks) ? 0 : mix[ch];
  const move = (ch: MixChannel, v: number) => {
    const next = v > 0 || (ch !== 'beat' && ch !== 'sub') ? { ...mix, [ch]: v } : mix;
    set({
      mix: next,
      ...(ch === 'beat' ? { click: v > 0 } : {}),
      ...(ch === 'sub' ? { ticks: v > 0 } : {}),
    });
  };
  const changed = !click || !ticks || CHANNELS.some(([ch]) => mix[ch] !== MIX_DEFAULT[ch]);
  return (
    <div className="mixer" role="group" aria-labelledby="pr-mix">
      <div className="mixer-head">
        <span id="pr-mix">Mix</span>
        {changed && (
          <button
            type="button"
            className="link-btn"
            onClick={() => set({ mix: { ...MIX_DEFAULT }, click: true, ticks: true })}
          >
            Reset
          </button>
        )}
      </div>
      {CHANNELS.map(([ch, label, what]) => {
        const v = shown(ch);
        return (
          <label key={ch} className={`mixer-row${v === 0 ? ' off' : ''}`} title={what}>
            <span className="mixer-lbl">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={v}
              data-testid={`mix-${ch}`}
              aria-valuetext={v === 0 ? 'off' : `${v}`}
              style={{ ['--v' as string]: `${v}%` }}
              onChange={(e) => move(ch, +e.target.value)}
            />
            <output className="mono">{v === 0 ? 'off' : v}</output>
          </label>
        );
      })}
    </div>
  );
}

const times = (n: number) => (n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`);

function Turns({
  label,
  value,
  onStep,
}: {
  label: string;
  value: number;
  onStep: (d: number) => void;
}) {
  return (
    <div className="stepper" role="group" aria-label={`${label}, times round`}>
      <span className="practice-turn-lbl">{label}</span>
      <button
        type="button"
        aria-label={`${label}: one time less`}
        disabled={value <= 1}
        onClick={() => onStep(-1)}
      >
        −
      </button>
      <output data-testid={`turns-${label.toLowerCase()}`}>×{value}</output>
      <button
        type="button"
        aria-label={`${label}: one time more`}
        disabled={value >= 8}
        onClick={() => onStep(1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * While counting in: the page behind goes soft and the beats are counted large in the middle,
 * with a dot for every beat of the bar (the bar before the last counted in outline). A tap stops.
 */
export function CountInOverlay() {
  const cd = useUiStore((s) => s.countdown);
  if (!cd) return null;
  const last = (cd.bar ?? 1) === (cd.bars ?? 1);
  return (
    <div
      className="count-in"
      role="presentation"
      data-testid="count-overlay"
      onPointerDown={() => stopPlayback()}
    >
      <div className="count-in-num" key={`${cd.bar}-${cd.beat}`} aria-hidden="true">
        {cd.beat}
      </div>
      <div className={`count-in-dots${last ? ' last' : ''}`} aria-hidden="true">
        {Array.from({ length: cd.of }, (_, i) => (
          <i key={i} className={i < cd.beat ? 'on' : ''} />
        ))}
      </div>
      <span className="sr-only" role="status">
        Counting in
      </span>
    </div>
  );
}
