/** A set of tile colours, one per size (cycling through 1–12; index 0 = size 1's). */
export interface TilePalette {
  id: string;
  name: string;
  colors: readonly string[];
}

const withZero = (c: string[]) => [c[0]!, ...c];

/** Tile palettes; "classic" is the default (the original colours). */
export const TILE_PALETTES: readonly TilePalette[] = [
  {
    id: 'classic',
    name: 'Classic',
    colors: withZero([
      '#7d8794',
      '#159a90',
      '#4b5fd3',
      '#d4961c',
      '#c43a5c',
      '#3c9550',
      '#8657d3',
      '#d97424',
      '#2399bd',
      '#a8448a',
      '#66792a',
      '#bf432a',
    ]),
  },
  {
    id: 'pastel',
    name: 'Pastel',
    colors: withZero([
      '#9aa5b1',
      '#7fcdbb',
      '#a3b4f0',
      '#f2c879',
      '#f29bb0',
      '#9fd59a',
      '#c5a8ef',
      '#f5b183',
      '#8ccfe6',
      '#e0a3cf',
      '#c3cf8a',
      '#f0a08f',
    ]),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: withZero([
      '#6b7f8e',
      '#0f8b8d',
      '#1d4e89',
      '#e0b04a',
      '#3a9bdc',
      '#2a9d6f',
      '#5a4fcf',
      '#e07a5f',
      '#0e7490',
      '#7fb7d9',
      '#3d5a80',
      '#98c1d9',
    ]),
  },
  {
    id: 'earth',
    name: 'Earth',
    colors: withZero([
      '#8a8172',
      '#7a8f4b',
      '#a0522d',
      '#c99a2e',
      '#6b4f3a',
      '#b5653a',
      '#4f6f52',
      '#d1a670',
      '#8c3b2e',
      '#9c8a54',
      '#5e5045',
      '#c2703d',
    ]),
  },
  {
    id: 'jewel',
    name: 'Jewel',
    colors: withZero([
      '#6c6f7f',
      '#0b7a5c',
      '#2b3a9e',
      '#b8860b',
      '#9b1d4a',
      '#1f6f8b',
      '#6a1b9a',
      '#c0392b',
      '#00796b',
      '#8e2475',
      '#3f6212',
      '#a35400',
    ]),
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: withZero([
      '#8d7f8f',
      '#f4a259',
      '#e76f51',
      '#f2cc8f',
      '#b5446e',
      '#ef8354',
      '#6d597a',
      '#e9c46a',
      '#c1666b',
      '#355070',
      '#eaac8b',
      '#9d4edd',
    ]),
  },
];

export const DEFAULT_PALETTE = 'classic';
export const isPaletteId = (v: unknown): v is string =>
  typeof v === 'string' && TILE_PALETTES.some((p) => p.id === v);
const paletteById = (id: string) => TILE_PALETTES.find((p) => p.id === id) ?? TILE_PALETTES[0]!;

let active: readonly string[] = TILE_PALETTES[0]!.colors;
/** Choose the tile palette used by `sizeColor` (the store keeps it in step with `ui.palette`). */
export function setTilePalette(id: string): void {
  active = paletteById(id).colors;
}

/** The colours of the classic palette (kept for callers that want the default). */
export const SIZE_COLORS = TILE_PALETTES[0]!.colors;

/** Tile colour per size in a palette (the active one by default). */
export const sizeColor = (n: number, colors: readonly string[] = active) =>
  colors[((n - 1) % 12) + 1]!;

/** A tile's colour: its own (a random one given to it), else its size's. */
export const tileColor = (n: number, own?: string) => own ?? sizeColor(n);

/** A random colour that reads well as a tile (mid lightness, clear saturation), as #rrggbb. */
export function randomTileColor(rand: () => number = Math.random): string {
  const h = rand() * 360;
  const s = 0.45 + rand() * 0.3;
  const l = 0.4 + rand() * 0.2;
  const f = (k: number) => {
    const kk = (k + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export interface Palette {
  fg: string;
  muted: string;
  faint: string;
  line: string;
  soft: string;
  card: string;
  accent: string;
  accentInk: string;
  land: string;
  warn: string;
  sel: string;
}

/** Fixed light palette for printing, whatever theme is on screen. */
export const PRINT_PALETTE: Palette = {
  fg: '#16191e',
  muted: '#646c78',
  faint: '#9aa2ad',
  line: '#e1e5ea',
  soft: '#f3f5f8',
  card: '#ffffff',
  accent: '#0d7a72',
  accentInk: '#ffffff',
  land: '#c9302c',
  warn: '#9a6516',
  sel: '#2b59d9',
};

export function readPalette(el: Element = document.documentElement): Palette {
  const cs = getComputedStyle(el);
  const v = (k: string) => cs.getPropertyValue(k).trim();
  return {
    fg: v('--fg'),
    muted: v('--muted'),
    faint: v('--faint'),
    line: v('--line'),
    soft: v('--soft'),
    card: v('--card'),
    accent: v('--accent'),
    accentInk: v('--accent-ink'),
    land: v('--land'),
    warn: v('--warn'),
    sel: v('--sel'),
  };
}

function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const INK_DARK = '#16191e';
/** Text colour with the best contrast on a size colour. */
export const inkFor = (bg: string) =>
  contrast(bg, '#ffffff') >= contrast(bg, INK_DARK) ? '#ffffff' : INK_DARK;
