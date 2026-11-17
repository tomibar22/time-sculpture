import { useEffect, useRef, useState } from 'react';
import { stopPlayback } from '../audio/player';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { MIX_DEFAULT, SPEED_EVERY, SPEED_STEPS, useUiStore } from '../state/store';
import type { Mix, MixChannel, SpeedUp, TilesMode } from '../state/store';
import { ClickPatternSection } from './ClickPattern';
import { MetronomeIcon } from './Icons';
import { TempoField, useTapTempo } from './TempoDialog';

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
    // a press elsewhere puts it away; Play does not, so what is set here can be heard at once
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!wrap.current?.contains(t) && !t.closest?.('.bigplay')) set({ practiceOpen: false });
    };
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
  const pattern = useUiStore((s) => s.clickPat.on);
  const tab = useUiStore((s) => s.practiceTab);
  const mixed = useUiStore(mixChanged);
  const speeding = useUiStore((s) => s.speedUp.on);
  const on = countIn > 0 || tiles !== 'on' || pattern || speeding;
  const marked = {
    practice: countIn > 0 || tiles !== 'on' || speeding,
    click: pattern,
    mix: mixed,
  };
  const said = [
    countIn ? `count-in ${countIn === 1 ? '1 bar' : '2 bars'}` : '',
    tiles === 'off' ? 'tiles silent' : tiles === 'turns' ? 'tiles in turn' : '',
    pattern ? 'click pattern' : '',
    speeding ? 'speeding up' : '',
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
        title={`Practice: tempo, count-in, the tiles heard or silent, a click pattern and the mix${said ? ` (${said})` : ''}`}
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
          <div className="segs text practice-tabs" role="tablist" aria-label="Practice">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`pr-tab-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                aria-controls="pr-page"
                className={marked[id] ? 'marked' : undefined}
                onClick={() => set({ practiceTab: id })}
                onKeyDown={(e) => {
                  // ← → walk the pages, as tabs do
                  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                  if (!d) return;
                  e.preventDefault();
                  const i = TABS.findIndex(([t]) => t === id);
                  const next = TABS[(i + d + TABS.length) % TABS.length]![0];
                  set({ practiceTab: next });
                  document.getElementById(`pr-tab-${next}`)?.focus();
                }}
              >
                {label}
                {marked[id] && <span className="sr-only"> (in use)</span>}
              </button>
            ))}
          </div>
          <div
            className="practice-page"
            id="pr-page"
            role="tabpanel"
            aria-labelledby={`pr-tab-${tab}`}
          >
            {tab === 'practice' && (
              <>
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
                <SpeedUpRow />
              </>
            )}
            {tab === 'click' && <ClickPatternSection />}
            {tab === 'mix' && <Mixer />}
          </div>
        </div>
      )}
    </span>
  );
}

const TABS: ['practice' | 'click' | 'mix', string][] = [
  ['practice', 'Practice'],
  ['click', 'Click'],
  ['mix', 'Mix'],
];
/** Is the mix anything but the plain one? */
const mixChanged = (s: { mix: Mix; click: boolean; ticks: boolean }) =>
  !s.click ||
  !s.ticks ||
  (Object.keys(MIX_DEFAULT) as MixChannel[]).some((ch) => s.mix[ch] !== MIX_DEFAULT[ch]);

const clampTempo = (v: number) => Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(v)));

/** The tempo: a number that can be typed, between − and +, and Tap (tap the beat). */
function TempoRow() {
  const set = useUiStore((s) => s.set);
  const { tap, tapped } = useTapTempo();
  const step = (d: number) => set({ tempo: clampTempo(useUiStore.getState().tempo + d) });
  return (
    <div className="practice-row">
      <label htmlFor="pr-tempo">Tempo</label>
      <div className="practice-tempo">
        <button
          type="button"
          className="practice-tap"
          title="Tap the beat a few times: the taps set the tempo"
          onPointerDown={tap}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!e.repeat) tap();
            }
          }}
        >
          Tap{tapped >= 2 && <span className="sr-only"> ({tapped} taps)</span>}
        </button>
        <button type="button" aria-label="1 slower" onClick={() => step(-1)}>
          −
        </button>
        <span className="practice-bpm">
          <span aria-hidden="true">♩</span>
          <TempoField id="pr-tempo" testid="practice-tempo" />
        </span>
        <button type="button" aria-label="1 faster" onClick={() => step(1)}>
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Speed up: the tempo climbs by itself while it plays, a step every so many times round, up to a
 * tempo. Written as a sentence to fill in. The piece's tempo is not changed: Stop is the start
 * again.
 */
function SpeedUpRow() {
  const sp = useUiStore((s) => s.speedUp);
  const tempo = useUiStore((s) => s.tempo);
  const boost = useUiStore((s) => s.tempoBoost);
  const set = useUiStore((s) => s.set);
  const [draft, setDraft] = useState<string | null>(null);
  const put = (next: Partial<SpeedUp>) => set({ speedUp: { ...sp, ...next } });
  const commit = () => {
    if (draft === null) return;
    const v = parseInt(draft, 10);
    if (Number.isFinite(v)) put({ to: clampTempo(v) });
    setDraft(null);
  };
  const steps = Math.ceil((sp.to - tempo) / sp.step);
  return (
    <>
      <div className="practice-row">
        <span id="pr-speed">Speed up</span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={sp.on}
          aria-labelledby="pr-speed"
          data-testid="speed-up"
          onClick={() =>
            // switched on with a goal that is not ahead: aim a little above the tempo
            put({ on: !sp.on, to: !sp.on && sp.to <= tempo ? clampTempo(tempo + 20) : sp.to })
          }
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
        </button>
      </div>
      {sp.on && (
        <>
          <div className="practice-speed" role="group" aria-labelledby="pr-speed">
            <label>
              <span>
                Faster by<span className="sr-only"> (beats per minute)</span>
              </span>
              <select value={sp.step} onChange={(e) => put({ step: +e.target.value })}>
                {SPEED_STEPS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                every<span className="sr-only"> so many times round</span>
              </span>
              <select value={sp.every} onChange={(e) => put({ every: +e.target.value })}>
                {SPEED_EVERY.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'time round' : `${n} times round`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                up to<span className="sr-only"> this tempo</span>
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={3}
                data-testid="speed-to"
                value={draft ?? String(sp.to)}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setDraft(digits);
                  const v = parseInt(digits, 10);
                  if (v >= MIN_TEMPO && v <= MAX_TEMPO) put({ to: v });
                }}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  commit();
                }}
              />
            </label>
          </div>
          <p className="practice-note" data-testid="speed-said">
            {boost > 0
              ? `Now at ${tempo + boost}. Stop goes back to ${tempo}.`
              : sp.to <= tempo
                ? `The tempo is ${tempo} already: choose a faster one to go up to.`
                : `From ${tempo} to ${sp.to} in ${steps} ${steps === 1 ? 'step' : 'steps'}, while it plays. Stop goes back to ${tempo}.`}
          </p>
        </>
      )}
    </>
  );
}

const CHANNELS: [MixChannel, string, string][] = [
  ['drum', 'Drum', 'the tiles'],
  ['one', 'The 1', 'of every bar'],
  ['beat', 'Beats', 'the other beats'],
  ['sub', 'Subdivision', 'inside a beat'],
];

/**
 * The mixer: one fader for each voice, each on its own. Beats and Subdivision are also the two
 * "hear" options: a fader pulled to nothing turns its voice off, and moving it turns the voice
 * on again. A notch marks where a fader stands untouched.
 */
function Mixer() {
  const mix = useUiStore((s) => s.mix);
  const click = useUiStore((s) => s.click);
  const ticks = useUiStore((s) => s.ticks);
  const tiles = useUiStore((s) => s.tiles);
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
  const changed = mixChanged({ mix, click, ticks });
  return (
    <div className="mixer" role="group" aria-label="Mix">
      {CHANNELS.map(([ch, label, what]) => {
        const v = shown(ch);
        return (
          <label key={ch} className={`mixer-row${v === 0 ? ' off' : ''}`}>
            <span className="mixer-lbl">
              {label}
              <small>{what}</small>
            </span>
            <span className="mixer-fader" style={{ ['--at' as string]: `${MIX_DEFAULT[ch]}%` }}>
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
            </span>
            <output className="mono">{v === 0 ? 'off' : v}</output>
          </label>
        );
      })}
      <p className="practice-note mixer-foot">
        <span>
          {tiles === 'off'
            ? 'The tiles are set to silent in Practice, so the drum is not heard now.'
            : 'The notch is where a fader starts.'}
        </span>
        {changed && (
          <button
            type="button"
            className="link-btn"
            onClick={() => set({ mix: { ...MIX_DEFAULT }, click: true, ticks: true })}
          >
            Reset
          </button>
        )}
      </p>
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
