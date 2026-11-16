import { useEffect, useRef } from 'react';
import { stopPlayback } from '../audio/player';
import { useUiStore } from '../state/store';
import type { TilesMode } from '../state/store';
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
          <p className="practice-note">
            {tiles === 'on'
              ? 'The tiles sound every time round.'
              : tiles === 'off'
                ? 'Only the click sounds: the tiles are yours to play.'
                : `${times(turns.on)} round with the tiles, then ${times(turns.off).toLowerCase()} with the click alone.`}
          </p>
        </div>
      )}
    </span>
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
