/** Tile colour per size (cycles through 1–12). */
export const SIZE_COLORS = [
  '#7d8794',
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
];

export const sizeColor = (n: number) => SIZE_COLORS[((n - 1) % 12) + 1]!;

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
