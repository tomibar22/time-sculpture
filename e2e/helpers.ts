import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Mirrors src/score/geometry.ts layout constants. */
const M = 4;
const STRIDE = 20 + 4 + 52 + 5 + 22 + 24;
const TILE_TOP = 4 + 20 + 4;
const BAND_MID = TILE_TOP + 52 + 5 + 11;

export interface ScoreBox {
  x: number;
  y: number;
  w: number;
  beats: number;
}

export async function score(page: Page, beats = 4): Promise<ScoreBox> {
  const el = page.getByTestId('score');
  await el.evaluate((n) => n.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const box = (await el.boundingBox())!;
  return { x: box.x, y: box.y, w: box.width, beats };
}

/** Client point at time t (beats) in the tile band; uniform subdivision assumed for x. */
export function at(s: ScoreBox, t: number, dy = 0): { x: number; y: number } {
  const r = Math.floor(t / s.beats + 1e-9);
  const bw = (s.w - 2 * M) / s.beats;
  return { x: s.x + M + (t - r * s.beats) * bw, y: s.y + TILE_TOP + 26 + r * STRIDE + dy };
}

export function laneAt(s: ScoreBox, beat: number): { x: number; y: number } {
  const r = Math.floor(beat / s.beats);
  const bw = (s.w - 2 * M) / s.beats;
  return { x: s.x + M + (beat - r * s.beats + 0.5) * bw, y: s.y + BAND_MID + r * STRIDE };
}

export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++)
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  await page.mouse.up();
}

export async function tap(
  page: Page,
  p: { x: number; y: number },
  modifiers: ('Shift' | 'ControlOrMeta')[] = [],
) {
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

export const seq = (page: Page) => page.getByTestId('sequence');
export const expectSeq = (page: Page, text: string) => expect(seq(page)).toHaveText(text);

/** Default doc: (2) 3 3 2 │ 3 (1) 3 2 4 in 4×2 at 4:1. Pulse p is at t = p / 4. */
export const P = (p: number) => p / 4;
export const DEFAULT_SEQ = '(2) 3 3 2 │ 3 (1) 3 2 4';

/** Show the number pad (it starts hidden on desktop, shown on phones). */
export async function showPad(page: Page) {
  const toggle = page.getByRole('button', { name: /^123/ });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await expect(page.getByTestId('key-1')).toBeVisible();
}

/** Unfold the meter / brush / drag settings (folded into one line on phones). */
export async function openSetup(page: Page) {
  const toggle = page.locator('.setup-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) !== 'true')
    await toggle.click();
}

/** Clear the composition (from the Library dialog). */
export async function clearAll(page: Page) {
  await page.locator('.lib-btn').click();
  await page.getByRole('button', { name: 'Clear this composition' }).click();
}

/** Wait until the app has loaded its composition from storage. */
export const ready = (page: Page) =>
  page.waitForSelector('html[data-ready]', { state: 'attached' });
