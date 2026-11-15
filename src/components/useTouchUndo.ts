import { useEffect } from 'react';
import { redo, toast, undo } from '../state/actions';
import { useUiStore } from '../state/store';

/** Longest a tap may last, the most its fingers may move, and the longest gap between two taps. */
const TAP_MS = 320;
const TAP_MOVE = 24;
const PAIR_MS = 480;

/**
 * Undo and redo by touch, as in drawing and notation apps: a double tap with two fingers undoes,
 * a double tap with three fingers redoes. Works anywhere on the page except in dialogs and
 * fields; a pinch or a scroll with two fingers is not a tap (the fingers move, or stay down).
 */
export function useTouchUndo(): void {
  useEffect(() => {
    let t0 = 0;
    let most = 0;
    let moved = 0;
    let ignore = false;
    const start = new Map<number, { x: number; y: number }>();
    let last = { n: 0, at: 0 };

    const onStart = (e: TouchEvent) => {
      if (start.size === 0 || e.touches.length === e.changedTouches.length) {
        start.clear();
        t0 = e.timeStamp;
        most = 0;
        moved = 0;
        const el = e.target as Element | null;
        ignore = !!el?.closest?.('dialog, input, textarea, select') || useUiStore.getState().stage;
      }
      for (const t of Array.from(e.changedTouches))
        start.set(t.identifier, { x: t.clientX, y: t.clientY });
      most = Math.max(most, e.touches.length);
    };
    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const s = start.get(t.identifier);
        if (s) moved = Math.max(moved, Math.hypot(t.clientX - s.x, t.clientY - s.y));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length) return;
      start.clear();
      const tap =
        !ignore && (most === 2 || most === 3) && moved < TAP_MOVE && e.timeStamp - t0 < TAP_MS;
      if (!tap) return void (last = { n: 0, at: 0 });
      if (last.n === most && e.timeStamp - last.at < PAIR_MS) {
        last = { n: 0, at: 0 };
        if (most === 2) {
          undo();
          toast('Undone');
        } else {
          redo();
          toast('Redone');
        }
        return;
      }
      last = { n: most, at: e.timeStamp };
    };
    const onCancel = () => {
      start.clear();
      last = { n: 0, at: 0 };
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, []);
}
