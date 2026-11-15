import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Mirrors src/score/geometry.ts layout constants. */
/** Left/right margin of every row: the caret gutter (geometry L.margin). */
export const M = 18;
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
  await settle(page, true);
  const box = (await el.boundingBox())!;
  return { x: box.x, y: box.y, w: box.width, beats };
}

/**
 * Wait until the score's box holds still for two frames: the canvas takes its size on its next
 * frame (after a load, a reload or an edit), and a smooth keep-in-view scroll may be running.
 * With `toTop`, keep scrolling it to the top of the screen meanwhile.
 */
export async function settle(page: Page, toTop = false) {
  await page.getByTestId('score').evaluate(async (n, top) => {
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    let last = '';
    let still = 0;
    for (let i = 0; i < 120 && still < 2; i++) {
      await frame();
      if (top) n.scrollIntoView({ block: 'start', behavior: 'instant' });
      const r = n.getBoundingClientRect();
      const now = `${r.top}|${r.height}|${r.width}`;
      still = now === last ? still + 1 : 0;
      last = now;
    }
  }, toTop);
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

/**
 * On a phone the fill panel folds the sizes and the shapes into two buttons while browsing:
 * open the one that is needed (a no-op on wider screens, where both rows are always there).
 */
export async function fillFold(page: Page, which: 'Sizes' | 'Shape') {
  const b = page.locator('.fill-folds button', { hasText: which });
  if ((await b.count()) && (await b.getAttribute('aria-expanded')) !== 'true') await b.click();
}

/** Open the library with its "Save and share" part unfolded. */
export async function openShare(page: Page) {
  await page.locator('.lib-btn').click();
  await page.getByRole('button', { name: /Save and share/ }).click();
}

/** Fingers on the screen (touch projects only): raw touch events through the DevTools protocol. */
export async function fingers(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  type Pt = { x: number; y: number };
  const send = (type: string, pts: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: type as 'touchStart',
      touchPoints: pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i })),
    });
  return {
    /** One finger along a path; `hold` ms before it moves (a long press). */
    async swipe(path: Pt[], hold = 0) {
      await send('touchStart', [path[0]!]);
      if (hold) await page.waitForTimeout(hold);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        const n = Math.max(3, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
        for (let j = 1; j <= n; j++) {
          await send('touchMove', [
            { x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n },
          ]);
          await page.waitForTimeout(8);
        }
      }
      await send('touchEnd', []);
    },
    async tap(p: Pt) {
      await send('touchStart', [p]);
      await page.waitForTimeout(30);
      await send('touchEnd', []);
    },
    /** A tap with n fingers side by side, twice. */
    async doubleTap(p: Pt, n: number) {
      const pts = Array.from({ length: n }, (_, i) => ({ x: p.x + i * 46, y: p.y }));
      for (let i = 0; i < 2; i++) {
        await send('touchStart', pts);
        await page.waitForTimeout(40);
        await send('touchEnd', []);
        await page.waitForTimeout(90);
      }
    },
  };
}

/** The knob under the caret or a range end at time t (beats): mirrors geometry KNOB_DROP. */
export function knobAt(s: ScoreBox, t: number, row = Math.floor(t / s.beats + 1e-9)) {
  const bw = (s.w - 2 * M) / s.beats;
  return {
    x: s.x + M + (t - row * s.beats) * bw,
    y: s.y + TILE_TOP + 52 + 5 + 22 + 8 + row * STRIDE,
  };
}
