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

test('save as MusicXML and MIDI', async ({ page }) => {
  await page.locator('.lib-btn').click();
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'MusicXML' }).click();
  let d = await download;
  expect(d.suggestedFilename()).toBe('First phrase.musicxml');
  const xml = readFileSync((await d.path())!, 'utf8');
  expect(xml).toContain('<score-partwise');
  expect(xml.match(/<measure /g)).toHaveLength(2);
  // 3 3 2 … 3 3 2 4: seven sounding groups, some tied over a beat line
  expect(xml).toContain('<tied type="start"/>');

  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'MIDI' }).click();
  d = await download;
  expect(d.suggestedFilename()).toBe('First phrase.mid');
  const bytes = readFileSync((await d.path())!);
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('MThd');
  // seven note-ons
  expect([...bytes].filter((b) => b === 0x90)).toHaveLength(7);
});

test('save a picture of the sheet', async ({ page }) => {
  await page.locator('.lib-btn').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Picture' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('First phrase.png');
  const bytes = readFileSync((await d.path())!);
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
});

test('back up the whole library and bring it back', async ({ page }) => {
  await page.keyboard.press('2');
  await page.locator('.lib-btn').click();
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await page.keyboard.press('4');
  await page.locator('.lib-btn').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up everything' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^Time Sculpture library \d{4}-\d\d-\d\d\.json$/);
  const path = (await d.path())!;
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  expect(backup.format).toBe('time-sculpture-library');
  expect(backup.pieces).toHaveLength(2);

  // bringing it in again changes nothing: everything is already here
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByTestId('toast')).toContainText('already here');
  const list = page.getByRole('list', { name: 'Saved compositions' });
  await page.locator('.lib-btn').click();
  await expect(list.getByRole('listitem')).toHaveCount(2);

  // delete one, restore: it comes back
  await page.getByRole('button', { name: 'Delete First phrase' }).click();
  await page.getByRole('button', { name: 'Delete?' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByTestId('toast')).toContainText('1 composition added');
  await page.locator('.lib-btn').click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
});
