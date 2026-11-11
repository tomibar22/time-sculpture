import { Fragment, useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import {
  fillRegion,
  fillSizes,
  previewSizes,
  previewVary,
  regionGroups,
  toggleMotif,
  varyWith,
} from '../state/fill';
import { useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { Contour, GroupStrip, Heart, Strip, useRegionBeats } from './fillParts';

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
  const base = useMemo(() => tree.find((n) => n.id === cur)?.groups ?? [], [tree, cur]);

  // a new region: a new tree, rooted in what is written there
  useEffect(() => {
    setTree([{ id: 0, parent: null, groups: regionGroups(), label: 'Start' }]);
    setCur(0);
    setLocked([]);
    setPicked(null);
  }, [region?.a, region?.b]);

  const vars = useMemo(() => E.variations(base, 80, Math.random, locked), [base, locked]);
  const steps = useMemo(
    () =>
      picked
        ? E.between(
            base.map((g) => g.n),
            picked.groups.map((g) => g.n),
            5,
          )
        : [],
    [base, picked],
  );

  const branch = () => {
    const groups = regionGroups();
    if (E.formatGroups(groups) === E.formatGroups(base)) return;
    const id = Math.max(...tree.map((n) => n.id)) + 1;
    setTree([...tree, { id, parent: cur, groups, label: picked?.label ?? 'Edited' }]);
    setCur(id);
    setLocked([]);
    setPicked(null);
  };
  const goTo = (n: Node) => {
    setCur(n.id);
    setLocked([]);
    setPicked(null);
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
              title={`${n.label}: ${E.formatGroups(n.groups)}`}
              onClick={() => goTo(n)}
            >
              {depth(n) > 0 && <span aria-hidden="true">{'↳'}</span>}
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
                setLocked(on ? locked.filter((x) => x !== i) : [...locked, i]);
              }}
            >
              {on && <span aria-hidden="true">🔒</span>}
              {g.n}
              <span className="sr-only">{on ? ' locked' : ''}</span>
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
            ? `${locked.length} locked; the rest moves around them.`
            : `${total} pulses. Tap a group to lock it.`}
        </span>
        <button
          type="button"
          className="fill-dice"
          title="Vary what is there now (a new branch)"
          onClick={branch}
        >
          ↻ From here
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
              onFocus={() => previewSizes(t)}
              onClick={() => fillSizes(t, 'On the way:')}
            >
              <Strip sizes={t} />
              <span className="sr-only">{t.join(' ')}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="fill-list" aria-label="Variations" onMouseLeave={() => previewVary(null)}>
        <li>
          <div className="fill-row">
            <button
              type="button"
              className="fill-main"
              aria-pressed={picked === null}
              onMouseEnter={() => previewVary(null)}
              onClick={() => {
                setPicked(null);
                varyWith({
                  groups: base,
                  key: E.formatGroups(base),
                  label: 'As it was',
                  kind: 'order',
                });
              }}
            >
              <GroupStrip groups={base} beats={beats} />
              <span className="fill-meta">As it was</span>
            </button>
          </div>
        </li>
        {E.VARIATION_KINDS.map((k) => {
          const vs = vars.filter((v) => v.kind === k.id);
          if (!vs.length) return null;
          return (
            <Fragment key={k.id}>
              <li className="fill-group" aria-hidden="true">
                {k.label}
              </li>
              {vs.map((v) => (
                <li key={v.key}>
                  <VaryRow
                    v={v}
                    beats={beats}
                    picked={picked?.key === v.key}
                    onPick={() => {
                      setPicked(v);
                      varyWith(v);
                    }}
                  />
                </li>
              ))}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

function VaryRow({
  v,
  beats,
  picked,
  onPick,
}: {
  v: E.Variation;
  beats: number[];
  picked: boolean;
  onPick: () => void;
}) {
  const sizes = v.groups.map((g) => g.n);
  const kept = useUiStore((s) => s.motifs.some((m) => m.join(' ') === sizes.join(' ')));
  return (
    <div className="fill-row">
      <button
        type="button"
        className="fill-main"
        aria-pressed={picked}
        onMouseEnter={() => previewVary(v)}
        onFocus={() => previewVary(v)}
        onBlur={() => previewVary(null)}
        onClick={onPick}
      >
        <GroupStrip groups={v.groups} beats={beats} />
        <Contour sizes={sizes} />
        <span className="fill-meta">{v.label}</span>
      </button>
      <Heart on={kept} label={v.key} onClick={() => toggleMotif(sizes)} />
    </div>
  );
}
