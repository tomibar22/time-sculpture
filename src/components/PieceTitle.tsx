import { useEffect, useState } from 'react';
import { renamePiece } from '../persistence/session';
import { announce } from '../state/actions';
import { useUiStore } from '../state/store';

/** The mark: groups of pulses in two rows, landing on the red line of the 1. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 44 28" width="33" height="21" aria-hidden="true">
      <rect x="0" y="0" width="10" height="11" rx="3" fill="#159a90" />
      <rect x="12" y="0" width="15" height="11" rx="3" fill="#4b5fd3" />
      <rect x="29" y="0" width="9" height="11" rx="3" fill="#d4961c" />
      <rect x="0" y="15" width="15" height="11" rx="3" fill="#8657d3" />
      <rect
        x="17.75"
        y="15.75"
        width="8.5"
        height="9.5"
        rx="2.5"
        fill="none"
        stroke="var(--faint)"
        strokeWidth="1.5"
        strokeDasharray="2.5 2"
      />
      <rect x="29" y="15" width="9" height="11" rx="3" fill="#c43a5c" />
      <rect x="40.5" y="-1" width="2.5" height="29" rx="1.25" fill="var(--land)" />
    </svg>
  );
}

/**
 * The name of the open composition, written large like a title on a page: type in it to rename
 * (it is saved when you leave the field or press Enter; Esc puts the old name back).
 */
export function PieceTitle() {
  const current = useUiStore((s) => s.currentName);
  const [name, setName] = useState(current);
  useEffect(() => setName(current), [current]);
  const commit = () => {
    const n = name.trim();
    if (!n || n === current) return setName(current);
    renamePiece(n);
    announce(`Renamed to ${n}`);
  };
  return (
    <input
      className="piece-title"
      aria-label="Name of the composition"
      title="The name of this composition: tap to rename"
      value={name}
      maxLength={80}
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      dir="auto"
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setName(current);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.blur());
        }
      }}
    />
  );
}
