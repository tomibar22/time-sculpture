import { ui as sfx } from '../audio/voices';
import { removeSelection } from '../state/actions';
import { deleteAtCaret, moveCaret, typeDigit } from '../state/editing';
import { useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The number pad: the touch way to write. Each digit inserts a group of that many pulses at the
 * caret (or replaces the selection); the switch above chooses sound or silence.
 */
export function Keypad() {
  const kind = useUiStore((s) => s.addKind);
  const set = useUiStore((s) => s.set);
  const rest = kind === 'rest';

  const backspace = () => {
    if (useUiStore.getState().selection.length) removeSelection();
    else if (!deleteAtCaret(-1)) sfx.nope();
  };

  return (
    <div className="keypad" role="group" aria-label="Number pad">
      <div className="keypad-head">
        <div className="segs text" role="group" aria-label="Write">
          <button type="button" aria-pressed={!rest} onClick={() => set({ addKind: 'sound' })}>
            Sound
          </button>
          <button type="button" aria-pressed={rest} onClick={() => set({ addKind: 'rest' })}>
            Silence
          </button>
        </div>
        <div className="keypad-caret">
          <button
            type="button"
            className="icon"
            aria-label="Caret left"
            onClick={() => moveCaret(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="icon"
            aria-label="Caret right"
            onClick={() => moveCaret(1)}
          >
            →
          </button>
        </div>
      </div>
      <div className="keypad-keys">
        {DIGITS.map((d) => {
          const col = sizeColor(d);
          return (
            <button
              key={d}
              type="button"
              className={`key ${rest ? 'rest' : ''}`}
              data-testid={`key-${d}`}
              title={`${rest ? 'Silence' : 'Sound'} of ${d} pulse${d === 1 ? '' : 's'}`}
              style={
                rest
                  ? undefined
                  : ({ '--key': col, '--key-ink': inkFor(col) } as React.CSSProperties)
              }
              onClick={() => typeDigit(d, kind)}
            >
              {d}
            </button>
          );
        })}
        <button
          type="button"
          className="key del"
          aria-label="Delete"
          title="Delete (⌫)"
          onClick={backspace}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
