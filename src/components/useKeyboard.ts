import { useEffect } from 'react';
import { togglePlayback } from '../audio/player';
import {
  clearSelection,
  duplicateSelection,
  mergeSelection,
  moveSelection,
  redo,
  removeSelection,
  selectAll,
  splitSelection,
  toggleSelectionKind,
  undo,
} from '../state/actions';
import { useUiStore } from '../state/store';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable);
const isActivatable = (t: EventTarget | null) =>
  t instanceof HTMLElement && t.matches('button, summary, a, [role="button"]');

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (e.key === ' ' || e.code === 'Space') {
        if (isActivatable(e.target)) return;
        e.preventDefault();
        togglePlayback();
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey) return;
      if (k === 'z') return void (e.preventDefault(), undo());
      if (k === 'y') return void (e.preventDefault(), redo());
      if (e.key === 'Escape') return clearSelection();
      if (!useUiStore.getState().selection.length) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          return moveSelection(-1);
        case 'ArrowRight':
          e.preventDefault();
          return moveSelection(1);
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          return removeSelection();
      }
      if (k === 's') splitSelection();
      else if (k === 'm') mergeSelection();
      else if (k === 'r') toggleSelectionKind();
      else if (k === 'd') duplicateSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
