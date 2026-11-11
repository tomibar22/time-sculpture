import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as E from '../engine';
import {
  fillRegion,
  previewSizes,
  previewVary,
  regionGroups,
  toggleMotif,
  varyWith,
} from '../state/fill';
import { useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Contour, GroupStrip, Heart, Strip, UseBar, useRegionBeats } from './fillParts';
import { BranchIcon, LockIcon } from './Icons';

/** A passage you varied from: the history of a session of varying is a tree of these. */
interface Node {
  id: number;
  parent: number | null;
  groups: E.GroupSpec[];
  label: string;
}

/**
 * Vary: the passage said another way, always the same length. Tap its groups to lock them
 * (they keep their place); the variations work around them. Nearby ones (one line moved) come
 * first, so you can walk step by step; "↻ From here" makes the current passage a new branch,
 * and the trail above takes you back to any earlier one.
 */
export function VaryPanel() {
  const region = fillRegion();
  const beats = useRegionBeats();
  const [tree, setTree] = useState<Node[]>([]);
  const [cur, setCur] = useState(0);
  const [locked, setLocked] = useState<number[]>([]);
  const [picked, setPicked] = useState<E.Variation | null>(null);
  /** The variation on trial: shown and heard, not written yet. */
  const [trying, setTrying] = useState<E.Variation | null>(null);
  const tryingRef = useRef<E.Variation | null>(null);
  tryingRef.current = trying;
  const base = useMemo(() => tree.find((n) => n.id === cur)?.groups ?? [], [tree, cur]);

  // a new region: a new tree, rooted in what is written there
  useEffect(() => {
    setTree([{ id: 0, parent: null, groups: regionGroups(), label: 'Start' }]);
    setCur(0);
    setLocked([]);
    setPicked(null);
    setTrying(null);
  }, [region?.a, region?.b]);

  const vars = useMemo(() => E.variations(base, 80, Math.random, locked), [base, locked]);
  const steps = useMemo(
    () =>
      (trying ?? picked)
        ? E.between(
            base.map((g) => g.n),
            (trying ?? picked)!.groups.map((g) => g.n),
            5,
          )
        : [],
    [base, picked, trying],
  );

  const motifs = useUiStore((s) => s.motifs);
  const kept = useMemo(() => new Set(motifs.map((m) => m.join(' '))), [motifs]);
  const write = useCallback((v: E.Variation) => {
    setPicked(v);
    setTrying(null);
    varyWith(v);
  }, []);
  // a tap tries; a second tap on the same variation (or "Use") writes it
  const pick = useCallback(
    (v: E.Variation) => {
      if (tryingRef.current?.key === v.key) return write(v);
      setTrying(v);
      previewVary(v);
    },
    [write],
  );
  const settle = useCallback(() => previewVary(tryingRef.current), []);
  const branch = () => {
    const groups = regionGroups();
    if (E.formatGroups(groups) === E.formatGroups(base)) return;
    const id = Math.max(...tree.map((n) => n.id)) + 1;
    setTree([...tree, { id, parent: cur, groups, label: picked?.label ?? 'Edited' }]);
    setCur(id);
    setLocked([]);
    setPicked(null);
    setTrying(null);
  };
  const goTo = (n: Node) => {
    setCur(n.id);
    setLocked([]);
    setPicked(null);
    setTrying(null);
    varyWith({ groups: n.groups, key: E.formatGroups(n.groups), label: n.label, kind: 'order' });
  };
  const depth = (n: Node): number => {
    const p = tree.find((x) => x.id === n.parent);
    return p ? depth(p) + 1 : 0;
  };
  // the tree in reading order: each node followed by its children
  const ordered: Node[] = [];
  const walk = (p: number | null) => {
    for (const n of tree.filter((x) => x.parent === p)) {
      ordered.push(n);
      walk(n.id);
    }
  };
  walk(null);

  if (!base.length) return <p className="lib-note">Select the groups (or a range) to vary.</p>;
  const total = base.reduce((a, g) => a + g.n, 0);

  return (
    <div className="fill-browse">
      {tree.length > 1 && (
        <div className="vary-trail" role="group" aria-label="Where you have been">
          {ordered.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={n.id === cur}
              data-depth={Math.min(depth(n), 3)}
              title={`${n.label}: ${E.formatGroups(n.groups)}`}
              onClick={() => goTo(n)}
            >
              <GroupStrip groups={n.groups} />
              <span className="sr-only">
                {n.label}: {E.formatGroups(n.groups)}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="vary-base" role="group" aria-label="Lock groups">
        {base.map((g, i) => {
          const on = locked.includes(i);
          const col = sizeColor(g.n);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              className={g.kind === 'rest' ? 'rest' : undefined}
              title={on ? 'Unlock: free to change' : 'Lock: keep this group where it is'}
              style={{
                flexGrow: g.n,
                background: g.kind === 'rest' ? 'transparent' : col,
                color: g.kind === 'rest' ? undefined : inkFor(col),
              }}
              onClick={() => {
                setPicked(null);
                setTrying(null);
                setLocked(on ? locked.filter((x) => x !== i) : [...locked, i]);
              }}
            >
              {on && <LockIcon />}
              {g.n}
              <span className="sr-only">{on ? ', locked' : ''}</span>
            </button>
          );
        })}
        {beats.map((f) => (
          <i key={f} className="strip-beat" style={{ left: `${(f * 100).toFixed(3)}%` }} />
        ))}
      </div>
      <div className="fill-sort">
        <span className="lib-note">
          {locked.length
            ? `${locked.length} locked. The rest moves around ${locked.length > 1 ? 'them' : 'it'}.`
            : `${total} pulses. Tap a group to lock it in place.`}
        </span>
        <button
          type="button"
          className="fill-dice"
          title="Vary what is there now (a new branch)"
          onClick={branch}
        >
          <BranchIcon />
          From here
        </button>
      </div>
      {steps.length > 0 && (
        <div className="fill-between" role="group" aria-label="On the way there">
          <span className="lib-note">On the way</span>
          {steps.map((t) => (
            <button
              key={t.join(' ')}
              type="button"
              title={t.join(' ')}
              onMouseEnter={() => previewSizes(t)}
              onClick={() =>
                pick({
                  groups: t.map((n) => ({ n, kind: 'sound' as const })),
                  key: t.join(' '),
                  label: 'On the way',
                  kind: 'nudge',
                })
              }
            >
              <Strip sizes={t} />
              <span className="sr-only">{t.join(' ')}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="fill-list" aria-label="Variations" onMouseLeave={settle}>
        <li>
          <div className="fill-row">
            <button
              type="button"
              className="fill-main"
              aria-pressed={false}
              data-written={(picked === null && !trying) || undefined}
              onMouseEnter={() => previewVary(null)}
              onClick={() => {
                setPicked(null);
                setTrying(null);
                varyWith({
                  groups: base,
                  key: E.formatGroups(base),
                  label: 'As it was',
                  kind: 'order',
                });
              }}
            >
              <GroupStrip groups={base} beats={beats} />
              <span className="fill-cap">
                <span className="fill-meta">As it was</span>
              </span>
            </button>
          </div>
        </li>
        {E.VARIATION_KINDS.map((k) => {
          const vs = vars.filter((v) => v.kind === k.id);
          if (!vs.length) return null;
          return (
            <Fragment key={k.id}>
              <li className="fill-group">{k.label}</li>
              {vs.map((v) => (
                <li key={v.key}>
                  <VaryRow
                    v={v}
                    beats={beats}
                    written={picked?.key === v.key}
                    trying={trying?.key === v.key}
                    kept={kept.has(v.groups.map((g) => g.n).join(' '))}
                    onPick={pick}
                  />
                </li>
              ))}
            </Fragment>
          );
        })}
      </ul>
      <UseBar
        trying={
          trying && {
            sizes: trying.groups.map((g) => g.n),
            rests: trying.groups.flatMap((g, i) => (g.kind === 'rest' ? [i] : [])),
          }
        }
        beats={beats}
        what="variation"
        onUse={() => trying && write(trying)}
        onCancel={() => {
          setTrying(null);
          previewVary(null);
        }}
      />
    </div>
  );
}

const VaryRow = memo(function VaryRow({
  v,
  beats,
  written,
  trying,
  kept,
  onPick,
}: {
  v: E.Variation;
  beats: number[];
  written: boolean;
  trying: boolean;
  kept: boolean;
  onPick: (v: E.Variation) => void;
}) {
  const sizes = v.groups.map((g) => g.n);
  return (
    <div className="fill-row">
      <button
        type="button"
        className="fill-main"
        aria-pressed={trying}
        data-written={written || undefined}
        title={trying ? 'Tap again to use it' : undefined}
        onMouseEnter={() => previewVary(v)}
        onClick={() => onPick(v)}
      >
        <GroupStrip groups={v.groups} beats={beats} />
        <span className="fill-cap">
          <Contour sizes={sizes} />
          <span className="fill-meta">{v.label}</span>
        </span>
      </button>
      <Heart on={kept} label={v.key} onClick={() => toggleMotif(sizes)} />
    </div>
  );
});
