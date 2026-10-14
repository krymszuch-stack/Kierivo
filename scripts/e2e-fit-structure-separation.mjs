import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { CV_TEXT, JD_TEXT } from './user-flow-fixture.mjs';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
const scores = [];
try {
  for (const contact of ['', 'Kraków | alicja.testowa@example.com | +48 123 456 789']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
    await page.locator('#onboarding-cv').fill(CV_TEXT.replace('Kraków | alicja.testowa@example.com', contact));
    await page.locator('#onboarding-jd').fill(JD_TEXT);
    await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();
    const result = page.getByRole('status', { name: /Wstępny wynik Kierivo \d+ procent/ });
    await result.waitFor();
    scores.push(await result.getAttribute('aria-label'));
    assert.deepEqual(errors, []);
    await mkdir('docs/evidence', { recursive: true });
    await page.screenshot({ path: `docs/evidence/fit-contact-${contact ? 'present' : 'absent'}.png`, fullPage: true });
    await page.close();
  }
  assert.equal(scores[0], scores[1], 'Dane kontaktowe nie mogą zmieniać oceny kompetencji w głównej ścieżce');
  console.log(`PASS: identyczne kompetencje bez/z kontaktem mają ten sam wynik UI: ${scores[0]}`);
} finally { await browser.close(); }
