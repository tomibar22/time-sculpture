import { useEffect, useState } from 'react';
import { connect, disconnect, onSyncState, syncNow, syncState } from '../persistence/sync';
import type { SyncState } from '../persistence/sync';
import { toast } from '../state/actions';
import { ChevronIcon, SyncIcon } from './Icons';

const time = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function summary(s: SyncState): string {
  if (!s.on) return 'Off on this device';
  if (s.status === 'syncing') return 'Syncing…';
  if (s.status === 'offline') return 'Offline, will sync when back';
  if (s.status === 'error')
    return s.error === 'bad-code' ? 'The sync code was refused' : 'Could not sync, will try again';
  return s.at ? `On · synced ${time(s.at)}` : 'On';
}

const REFUSED: Record<string, string> = {
  'bad-code': 'That code is not the right one.',
  'not-set-up': 'Sync is not set up on the server yet.',
  offline: 'No connection. Try again when online.',
};

/** Library section: the same compositions on the iPhone, the iPad and the computer. */
export function SyncSection() {
  const [s, setS] = useState<SyncState>(syncState);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => onSyncState(setS), []);

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setMsg('');
    const r = await connect(code);
    setBusy(false);
    if (r === 'ok') {
      setCode('');
      toast('Syncing this device');
    } else setMsg(REFUSED[r] ?? '');
  };

  return (
    <section className="lib-sec lib-sync">
      <button
        type="button"
        className="lib-fold"
        aria-expanded={open}
        aria-controls="lib-sync"
        onClick={() => setOpen(!open)}
      >
        <SyncIcon />
        Sync between devices
        <span className="dim"> · {summary(s)}</span>
        <ChevronIcon />
      </button>
      <div id="lib-sync" className="lib-sync-body" hidden={!open}>
        {s.on ? (
          <>
            <p className="lib-note" role="status">
              Every composition saved here is also on your other devices, and theirs are here.
              {s.on && s.status !== 'idle' ? ` ${summary(s)}.` : ''}
            </p>
            <div className="lib-actions">
              <button type="button" className="primary" onClick={() => void syncNow()}>
                Sync now
              </button>
              <button
                type="button"
                className="ghost"
                title="This device stops syncing. Its compositions stay here."
                onClick={() => {
                  disconnect();
                  toast('This device no longer syncs');
                }}
              >
                Stop syncing here
              </button>
            </div>
          </>
        ) : (
          <form
            className="lib-rename"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <label htmlFor="sync-code">Sync code</label>
            <div className="row">
              <input
                id="sync-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="xxxx-xxxx-xxxx-xxxx"
              />
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Joining…' : 'Join'}
              </button>
            </div>
            <p className="lib-note" role="status">
              {msg ||
                'Type the same code on the iPhone, the iPad and the computer. What is here joins what is there; nothing is replaced.'}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
