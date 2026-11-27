import { useUiStore } from '../state/store';

/** Re-render when the tile palette changes (for anything drawn with `sizeColor`). */
export const usePalette = () => useUiStore((s) => s.palette);
