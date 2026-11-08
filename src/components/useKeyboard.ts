import { useEffect } from 'react';
import * as E from '../engine';
import { togglePlayback } from '../audio/player';
import {
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
import {
  brushSelection,
  copySelection,
  caretHome,
  deleteAtCaret,
  escape,
  extendSelection,
  moveCaret,
  extendRange,
  paste,
  playFromCaret,
  resizeSelection,
  reverseSelection,
  trimSelection,
  typeDigit,
} from '../state/editing';
import { useUiStore } from '../state/store';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable);
const isActivatable = (t: EventTarget | null) =>
  t instanceof HTMLElement && t.matches('button, summary, a, [role="button"]');
/** The page has selected text (e.g. in the help): leave copy to the browser. */
const hasTextSelection = () => (window.getSelection()?.toString() ?? '') !== '';

/**
 * All keyboard shortcuts. Digits type sizes at the caret, ⌘C/⌘X/⌘V copy and paste groups
 * (also as text such as "3 (2) 4", so phrases can be pasted from Notes).
 */
export function useKeyboard() {
  useEffect(() => {
    let pendingPaste: number | undefined;
    /** Text of the groups just copied or cut by the keyboard, for the copy/cut event. */
    let copiedText: string | null = null;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const hasSel = useUiStore.getState().selection.length > 0;

      if (e.key === ' ' || e.code === 'Space') {
        if (isActivatable(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) playFromCaret();
        else togglePlayback();
        return;
      }
      if (mod) {
        if (k === 'a') return void (e.preventDefault(), selectAll());
        if (k === 'z') return void (e.preventDefault(), e.shiftKey ? redo() : undo());
        if (k === 'y') return void (e.preventDefault(), redo());
        if (
          (k === 'c' || k === 'x') &&
          (hasSel || useUiStore.getState().range) &&
          !hasTextSelection()
        ) {
          // do the work here (it must also work if no copy event follows); the event writes the text
          copiedText = copySelection(k === 'x');
          return;
        }
        if (k === 'v') {
          // prefer the system clipboard text from the paste event; fall back to our own clipboard
          clearTimeout(pendingPaste);
          pendingPaste = window.setTimeout(() => paste(), 60);
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          return caretHome(e.key === 'ArrowRight');
        }
        return;
      }
      if (e.altKey) {
        // ⌥←/→ trim the end edge, ⌥⇧←/→ the start edge (preventDefault also stops Alt+← = Back)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          if (hasSel) return trimSelection(e.shiftKey ? 'start' : 'end', dir);
          // no tiles selected: jump the caret (or the range's end) from tile edge to tile edge
          return e.shiftKey ? extendRange(dir, true) : moveCaret(dir, true);
        }
        return;
      }

      // digits: type a size (Shift+digit types a silence)
      const digit =
        /^Digit(\d)$/.exec(e.code)?.[1] ??
        /^Numpad(\d)$/.exec(e.code)?.[1] ??
        (/^\d$/.test(e.key) ? e.key : undefined);
      if (digit !== undefined) {
        e.preventDefault();
        return typeDigit(Number(digit), e.shiftKey ? 'rest' : 'sound');
      }
      if (k === 'a' && e.shiftKey) return void (e.preventDefault(), selectAll());
      if (k === 'z') return void (e.preventDefault(), undo());
      if (k === 'y') return void (e.preventDefault(), redo());
      if (e.key === 'Escape') return escape();
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        return caretHome(e.key === 'End');
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (e.shiftKey) {
          e.preventDefault();
          return extendSelection(dir);
        }
        if (hasSel) {
          e.preventDefault();
          return moveSelection(dir);
        }
        e.preventDefault();
        return moveCaret(dir);
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (hasSel) return removeSelection();
        deleteAtCaret(e.key === 'Backspace' ? -1 : 1);
        return;
      }
      if (k === 'b' && useUiStore.getState().range) return brushSelection();
      if (!hasSel) return;
      if (e.key === '+' || e.key === '=') return resizeSelection(1);
      if (e.key === '-' || e.key === '_') return resizeSelection(-1);
      if (e.key === 'R' && e.shiftKey) return reverseSelection();
      if (k === 'b') return brushSelection();
      if (k === 's') splitSelection();
      else if (k === 'm') mergeSelection();
      else if (k === 'r') toggleSelectionKind();
      else if (k === 'd') duplicateSelection();
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || hasTextSelection() || copiedText === null) return;
      e.clipboardData?.setData('text/plain', copiedText);
      e.preventDefault();
      copiedText = null;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      clearTimeout(pendingPaste);
      const parsed = E.parseGroups(e.clipboardData?.getData('text/plain') ?? '');
      e.preventDefault();
      paste(parsed ?? undefined);
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
