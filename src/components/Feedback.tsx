import { useEffect } from 'react';
import { undo } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const version = useDocStore((s) => s.version);
  const set = useUiStore((s) => s.set);
  const canUndo = toast?.undoVersion !== undefined && toast.undoVersion === version;
  const hasAction = canUndo || !!toast?.action;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(
      () => {
        if (useUiStore.getState().toast?.id === toast.id) set({ toast: null });
      },
      hasAction ? 5000 : 2400,
    );
    return () => clearTimeout(t);
  }, [toast, hasAction, set]);

  return (
    <div
      className={`toast ${toast ? 'show' : ''}`}
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      <span>{toast?.message}</span>
      {toast && canUndo && (
        <button
          type="button"
          onClick={() => {
            undo();
            set({ toast: null });
          }}
        >
          Undo
        </button>
      )}
      {toast?.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run();
            set({ toast: null });
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function Announcer() {
  const msg = useUiStore((s) => s.announcement);
  return (
    <div className="sr-only" aria-live="polite" data-testid="announcer">
      {msg}
    </div>
  );
}
