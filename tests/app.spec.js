import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
test('PDF integrity, passwords, compression, resizing, and cancellation', async ({ page }) => {
  await page.goto('/tests/browser.html');
  await expect(page.locator('#status')).toHaveText('15 passed, 0 failed', { timeout: 75000 });
});
test('A protected PDF can be unlocked and downloaded through the UI', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/folio-encrypted-aes256.pdf');
  await expect(page.getByLabel('Document password')).toBeVisible();
  await page.getByLabel('Document password').fill('wrong');
  await page.getByRole('button', { name: 'Unlock PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('password');
  await page.getByLabel('Document password').fill('folio-test-2026');
  await page.getByRole('button', { name: 'Unlock PDF', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your PDF is unlocked.' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('folio-encrypted-aes256-unlocked.pdf');
  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.isEncrypted).toBe(false);
});
test('Mobile layout and resize flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Resize pages Find the perfect fit' }).click();
  await page.getByRole('button', { name: 'Try a sample PDF' }).click();
  await page.getByLabel('Paper size').selectOption('custom');
  await page.getByLabel('Width (mm)').fill('0');
  await page.getByRole('button', { name: 'Resize PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('between 20 and 2,000');
  await page.getByLabel('Width (mm)').fill('150');
  await page.getByRole('button', { name: 'Resize PDF', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
