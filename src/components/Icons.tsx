const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const UndoIcon = () => (
  <svg {...base}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const RedoIcon = () => (
  <svg {...base}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);
export const PlayIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
  </svg>
);
export const StopIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const ThemeIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
  </svg>
);
export const ChevronIcon = () => (
  <svg {...base}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const FitIcon = () => (
  <svg {...base}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
/** A screen on a stand: the stage (a clean view for filming). */
export const StageIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M12 16v4M8 20h8" />
    <path d="m10 8 4 2-4 2Z" fill="currentColor" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const HeadphonesIcon = () => (
  <svg {...base}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4.5" height="6.5" rx="1.6" />
    <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6" />
  </svg>
);
export const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </svg>
);
export const PinIcon = () => (
  <svg {...base}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z" />
    <path d="M12 13v7" />
  </svg>
);
/** Two lines that join and part again: a crossing. */
export const BreedIcon = () => (
  <svg {...base}>
    <path d="M5 4c0 6 14 10 14 16" />
    <path d="M19 4c0 6-14 10-14 16" />
    <path d="M8 7h8M8 17h8" />
  </svg>
);
export const DiceIcon = () => (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth={2.6} />
  </svg>
);
export const LockIcon = () => (
  <svg {...base} width={12} height={12} strokeWidth={2.6}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const BranchIcon = () => (
  <svg {...base}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M6 7v10M18 10c0 4-6 3-11 6" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);
export const SyncIcon = () => (
  <svg {...base}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v3h3" />
    <path d="M4 13a8 8 0 0 0 14.6 4.5M20 20v-3h-3" />
  </svg>
);
export const ScissorsIcon = () => (
  <svg {...base}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <path d="M8.2 7.5 20 18M8.2 16.5 20 6" />
  </svg>
);
export const CopyIcon = () => (
  <svg {...base}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);
export const PasteIcon = () => (
  <svg {...base}>
    <path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
  </svg>
);
export const DuplicateIcon = () => (
  <svg {...base}>
    <rect x="4" y="4" width="11" height="11" rx="2" />
    <path d="M19 9v9a2 2 0 0 1-2 2H9M9.5 7v5M7 9.500h5" />
  </svg>
);
export const EraseIcon = () => (
  <svg {...base}>
    <path d="M8 19h11M5 14l8.500-8.500a1.500 1.500 0 0 1 2.100 0L19 8.900a1.500 1.500 0 0 1 0 2.100L11 19H8l-3-3a1.400 1.400 0 0 1 0-2z" />
  </svg>
);
