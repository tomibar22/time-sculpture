import { ui as sfx } from '../audio/voices';
import { removeSelection } from '../state/actions';
import { useState } from 'react';
import { caretHome, deleteAtCaret, moveCaret, typeDigit, typeSize } from '../state/editing';
import * as E from '../engine';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The number pad: the touch way to write. Each digit inserts a group of that many pulses at the
 * caret (or replaces the selection).
 */
export function Keypad() {
  // how many pulses a typed group may have right now: the range, or the selected tiles plus the
  // open space, or the open space; longer keys are dimmed (they still say why when tapped)
  const doc = useDocStore((s) => s.doc);
  const range = useUiStore((s) => s.range);
  const selection = useUiStore((s) => s.selection);
  const free = E.freePulses(doc);
  const room = range
    ? range.b - range.a
    : free + selection.reduce((a, id) => a + (E.findItem(doc, id)?.n ?? 0), 0);

  // two digits (user request): 10+ turns the keys into tens ("1_" … "9_"), a tens key turns
  // them into that ten's sizes (11 … 19, and 10+ itself becomes 10); one tap writes it
  const [tens, setTens] = useState<null | 0 | number>(null);

  const backspace = () => {
    if (tens !== null) return setTens(tens ? 0 : null); // step back out of the two digits
    if (useUiStore.getState().selection.length) removeSelection();
    else if (!deleteAtCaret(-1)) sfx.nope();
  };

  const write = (n: number) => {
    setTens(null);
    if (n < 10) typeDigit(n, 'sound');
    else typeSize(n, 'sound');
  };

  const digit = (d: number) => {
    // what this key gives now: d, a ten (first of two digits), or a size of two digits
    const n = tens === null ? d : tens === 0 ? d * 10 : tens * 10 + d;
    const col = sizeColor(n);
    const big = (tens === 0 ? d * 10 : n) > room;
    const label = tens === 0 ? `${d}_` : String(n);
    return (
      <button
        key={d}
        type="button"
        className={`key${big ? ' big' : ''}${n >= 10 ? ' two' : ''}`}
        data-testid={`key-${d}`}
        aria-label={tens === 0 ? `${d}0 to ${d}9` : undefined}
        title={
          tens === 0
            ? `Sizes ${d}0 to ${d}9`
            : big
              ? `${n} does not fit: ${room} pulse${room === 1 ? '' : 's'} of room`
              : `Sound of ${n} pulse${n === 1 ? '' : 's'}`
        }
        style={{ '--key': col, '--key-ink': inkFor(col) } as React.CSSProperties}
        onClick={() => (tens === 0 ? setTens(d) : write(n))}
      >
        {label}
      </button>
    );
  };

  // the 10+ key: starts two digits; with a ten chosen it is that ten itself (10, 20 …)
  const tensKey = (
    <button
      type="button"
      className={`key tens${tens !== null ? ' on' : ''}${tens && tens * 10 > room ? ' big' : ''}`}
      data-testid="key-tens"
      aria-pressed={tens !== null}
      title={
        tens === null
          ? 'Two digits: then choose the ten, then the size (10+ 1 2 = 12)'
          : tens === 0
            ? 'Choose the ten (or tap again to go back to 1–9)'
            : `Sound of ${tens * 10} pulses`
      }
      style={
        tens
          ? ({
              '--key': sizeColor(tens * 10),
              '--key-ink': inkFor(sizeColor(tens * 10)),
            } as React.CSSProperties)
          : undefined
      }
      onClick={() => (tens === null ? setTens(0) : tens === 0 ? setTens(null) : write(tens * 10))}
    >
      {tens ? String(tens * 10) : '10+'}
    </button>
  );

  return (
    <div className="keypad" role="group" aria-label="Number pad">
      <div className="keypad-keys">
        {/* a phone: the digits and delete in five columns, the caret keys a block of four beside
            them; wider screens put it all on one line (see the order in the stylesheet) */}
        {DIGITS.slice(0, 5).map(digit)}
        {tensKey}
        <button
          type="button"
          className="key nav nav-home"
          aria-label="Caret to the start"
          title="Caret to the very start (Home)"
          onClick={() => caretHome(false)}
        >
          ⇤
        </button>
        <button
          type="button"
          className="key nav nav-end"
          aria-label="Caret to the end"
          title="Caret to the very end (End)"
          onClick={() => caretHome(true)}
        >
          ⇥
        </button>
        {DIGITS.slice(5).map(digit)}
        <button
          type="button"
          className="key del"
          aria-label="Delete"
          title="Delete (⌫)"
          onClick={backspace}
        >
          ⌫
        </button>
        <button
          type="button"
          className="key nav nav-left"
          aria-label="Caret left"
          onClick={() => moveCaret(-1)}
        >
          ←
        </button>
        <button
          type="button"
          className="key nav nav-right"
          aria-label="Caret right"
          onClick={() => moveCaret(1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
