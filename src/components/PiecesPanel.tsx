import { useRef } from 'react';
import * as E from '../engine';
import { ensureAudio } from '../audio/context';
import { ui as sfx } from '../audio/voices';
import { addPiece, clearAll, fillWithPieces, fillWithSilence } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { scoreRegistry } from '../score/registry';

const STATE_LABEL: Record<E.TrayState, string> = { fits: 'fits', dead: 'dead end', big: 'too big' };

function Piece({
  size,
  state,
  rest,
  anchor,
}: {
  size: number;
  state: E.TrayState;
  rest: boolean;
  anchor: 'start' | 'end';
}) {
  const drag = useRef<{
    x0: number;
    y0: number;
    moved: boolean;
    ghost: HTMLDivElement | null;
  } | null>(null);
  const bg = sizeColor(size);
  const style = rest
    ? { width: 42 + size * 7 }
    : { width: 42 + size * 7, background: bg, color: inkFor(bg) };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    ensureAudio();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) {
      d.moved = true;
      const g = document.createElement('div');
      g.className = `drag-ghost${rest ? ' rest' : ''}`;
      g.textContent = String(size);
      g.style.width = `${40 + size * 7}px`;
      if (!rest) {
        g.style.background = bg;
        g.style.color = inkFor(bg);
      }
      document.body.append(g);
      d.ghost = g;
    }
    if (!d.moved || !d.ghost) return;
    d.ghost.style.left = `${e.clientX}px`;
    d.ghost.style.top = `${e.clientY}px`;
    const slot = scoreRegistry.slotAt?.(e.clientX, e.clientY) ?? null;
    const caret = slot === null ? null : E.insertionIndex(useDocStore.getState().doc.items, slot);
    if (caret !== useUiStore.getState().caret) useUiStore.getState().set({ caret });
  };
  const finish = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.ghost?.remove();
    const caret = useUiStore.getState().caret;
    useUiStore.getState().set({ caret: null });
    if (!commit) return;
    if (!d.moved) addPiece(size);
    else if (caret !== null) addPiece(size, caret);
  };

  return (
    <button
      type="button"
      className={`piece ${state !== 'fits' ? state : ''} ${rest ? 'rest' : ''}`}
      style={style}
      aria-disabled={state === 'big'}
      data-testid={`piece-${size}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          addPiece(size);
        }
      }}
      onClick={(e) => {
        // pointer clicks are handled on pointerup; keyboard "clicks" come through onKeyDown
        e.preventDefault();
      }}
    >
      <span>{size}</span> <small>{STATE_LABEL[state]}</small>
      <span className="sr-only">
        : add {rest ? 'a silence of ' : ''}
        {size} pulses at the {anchor}
        {state === 'dead' ? '; the space could not be filled after this' : ''}
      </span>
    </button>
  );
}

export function PiecesPanel() {
  const doc = useDocStore((s) => s.doc);
  const tray = useUiStore((s) => s.tray);
  const addAt = useUiStore((s) => s.addAt);
  const addKind = useUiStore((s) => s.addKind);
  const set = useUiStore((s) => s.set);
  const R = E.freePulses(doc);
  const states = E.trayStates(R, tray);
  const seg = (patch: Parameters<typeof set>[0]) => {
    set(patch);
    sfx.snap();
  };

  return (
    <section className="panel" aria-labelledby="pieces-h">
      <h2 id="pieces-h">Pieces</h2>
      <div className="pieces-top">
        <div className="field">
          <span id="lbl-at">Add at</span>
          <div className="segs text" role="group" aria-labelledby="lbl-at">
            <button
              type="button"
              aria-pressed={addAt === 'start'}
              onClick={() => seg({ addAt: 'start' })}
            >
              ⇤ Start
            </button>
            <button
              type="button"
              aria-pressed={addAt === 'end'}
              onClick={() => seg({ addAt: 'end' })}
            >
              End ⇥
            </button>
          </div>
        </div>
        <div className="field">
          <span id="lbl-as">As</span>
          <div className="segs text" role="group" aria-labelledby="lbl-as">
            <button
              type="button"
              aria-pressed={addKind === 'sound'}
              onClick={() => seg({ addKind: 'sound' })}
            >
              Sound
            </button>
            <button
              type="button"
              aria-pressed={addKind === 'rest'}
              onClick={() => seg({ addKind: 'rest' })}
            >
              Silence
            </button>
          </div>
        </div>
      </div>
      <div
        className="tray"
        role="group"
        aria-label="Tray: tap a piece to add it, or drag it onto the score"
      >
        {tray.map((s) => (
          <Piece key={s} size={s} state={states.get(s)!} rest={addKind === 'rest'} anchor={addAt} />
        ))}
      </div>
      <div className="fills">
        <button type="button" className="primary" disabled={!R} onClick={fillWithPieces}>
          Fill the space with pieces
        </button>
        <button type="button" disabled={!R} onClick={fillWithSilence}>
          Fill it with silence
        </button>
        <button type="button" className="ghost" disabled={doc.items.length < 2} onClick={clearAll}>
          Clear all
        </button>
      </div>
    </section>
  );
}
