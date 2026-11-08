import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('save as PDF gives a printable score sheet', async ({ page }) => {
  await page.locator('.lib-btn').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF score' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('First phrase.pdf');
  const bytes = readFileSync((await d.path())!);
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  expect(bytes.length).toBeGreaterThan(20_000);
});

test('save as JSON, then open the file again', async ({ page }) => {
  await page.locator('.lib-btn').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('First phrase.timesculpture.json');
  const path = (await d.path())!;
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file).toMatchObject({
    format: 'time-sculpture',
    version: 2,
    title: 'First phrase',
    beatsPerCycle: 4,
    cycles: 2,
    start: [{ pulses: 2, rest: true }, { pulses: 3 }, { pulses: 3 }, { pulses: 2 }],
  });
  expect(file.sounds[0]).toEqual({ at: 0.5, length: 0.75, pulses: 3 });

  // change the piece, then open the saved file: it comes back as a new library entry
  await page.keyboard.press('Escape');
  await page.keyboard.press('5');
  await expectSeq(page, '(2) 3 3 2 5 │ 3 (1) 3 2 4');
  await page.locator('.lib-btn').click();
  await page.locator('input[type=file]').setInputFiles(path);
  await expectSeq(page, DEFAULT_SEQ);
  await expect(page.getByTestId('toast')).toContainText('Imported First phrase');
});
