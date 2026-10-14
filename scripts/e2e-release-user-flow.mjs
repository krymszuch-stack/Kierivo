import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CV_TEXT, JD_TEXT } from './user-flow-fixture.mjs';

const baseUrl = process.env.BASE_URL;
const state = process.env.SMOKE_STORAGE_STATE;
if (!baseUrl || !state) {
  console.error('UNKNOWN: wymagane BASE_URL i SMOKE_STORAGE_STATE dedykowanego konta testowego.');
  process.exit(2);
}
const output = resolve(process.env.SMOKE_OUTPUT || 'artifacts/authenticated-smoke');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await page.locator('#onboarding-cv').fill(CV_TEXT);
  await page.locator('#onboarding-jd').fill(JD_TEXT);
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();
  const result = page.getByRole('status', { name: /Wstępny wynik Kierivo \d+ procent/ });
  await result.waitFor({ timeout: 20_000 });
  assert.match(await result.innerText(), /Nie mierzy prawdopodobieństwa/);
  await page.getByRole('button', { name: 'Pokaż szczegóły' }).click();
  const dialog = page.getByRole('dialog', { name: /Dopasowanie do oferty: Specjalista IT Support/ });
  await dialog.getByRole('tab', { name: 'Generator gotowego CV' }).click();
  const preview = await dialog.innerText();
  assert.ok(preview.includes('Microsoft 365'));
  assert.ok(!preview.includes('Wyrażam zgodę'));
  await page.screenshot({ path: `${output}/preview.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Otwórz menu eksportu CV', exact: true }).click();
  const button = page.getByRole('button', { name: 'Przygotuj podgląd PDF ATS Dual-Layer', exact: true });
  await button.waitFor();
  assert.equal(await button.isEnabled(), true, 'Zalogowane konto nie może pobrać PDF.');
  await button.click();
  const pdfPreview = page.getByTestId('prepared-pdf-preview');
  await pdfPreview.getByRole('status').filter({ hasText: /Podgląd PDF gotowy/ }).waitFor({ timeout: 60_000 });
  await page.screenshot({ path: `${output}/pdf-preview.png`, fullPage: true });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Pobierz pokazany plik PDF', exact: true }).click(),
  ]);
  await download.saveAs(`${output}/download.pdf`);
  const task = getDocument({ data: new Uint8Array(await readFile(`${output}/download.pdf`)), useSystemFonts: true });
  const pdf = await task.promise;
  const texts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const text = await (await pdf.getPage(i)).getTextContent();
    texts.push(text.items.map(item => 'str' in item ? item.str : '').join(' '));
  }
  const text = texts.join(' ').toLowerCase();
  for (const fact of ['Alicja Testowa', 'alicja.testowa@example.com', 'Microsoft 365', 'TCP/IP', 'Technik informatyk']) {
    assert.ok(text.includes(fact.toLowerCase()), `PDF pomija fakt: ${fact}`);
  }
  assert.doesNotMatch(text, /entra id|powershell|intune|wyrażam zgodę/);
  assert.deepEqual(errors, []);
  console.log(`PASS: zalogowana ścieżka CV → wynik z niepewnością → podgląd → pobrany PDF (${pdf.numPages} stron).`);
  await task.destroy();
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
