import { stopPlayback } from '../audio/player';
import { toast } from '../state/actions';
import { useUiStore } from '../state/store';
import { MetronomeIcon } from './Icons';

const WORD = { 0: 'off', 1: '1 bar', 2: '2 bars' } as const;

/**
 * The count-in switch in the transport, beside Play: one tap goes off → 1 bar → 2 bars → off.
 * Lit with a small number while it is on; it is remembered on this device.
 */
export function CountInButton() {
  const n = useUiStore((s) => s.countIn);
  const set = useUiStore((s) => s.set);
  return (
    <button
      type="button"
      className={`icon ghost count-btn${n ? ' on' : ''}`}
      aria-pressed={n > 0}
      title={`Count-in: ${WORD[n]} (tap: off, 1 bar, 2 bars)`}
      data-testid="count-in"
      onClick={() => {
        const next = ((n + 1) % 3) as 0 | 1 | 2;
        set({ countIn: next });
        toast(next ? `Count-in: ${WORD[next]}` : 'No count-in');
      }}
    >
      <MetronomeIcon />
      {n > 0 && (
        <span className="count-n" aria-hidden="true">
          {n}
        </span>
      )}
      <span className="sr-only">Count-in {WORD[n]}</span>
    </button>
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
