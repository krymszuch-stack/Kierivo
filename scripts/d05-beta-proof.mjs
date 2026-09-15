#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.D05_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.D05_SCREENSHOT_DIR ?? 'artifacts/d05-beta';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

const forbiddenPurchaseCtas = [
  'Rozpocznij 30 dni',
  'Kup szablon',
  'Zobacz Karnet',
  'Stripe Portal',
  'Subskrybuj Pro',
];

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Wiesz, co umiesz/i }).waitFor();

  const landingText = await page.locator('body').innerText();
  for (const forbidden of forbiddenPurchaseCtas) {
    if (landingText.includes(forbidden)) throw new Error(`Ekran startowy nadal zawiera CTA zakupowe: ${forbidden}`);
  }
  await page.screenshot({ path: `${outputDir}/01-start-kierivo.png`, fullPage: true });

  // Wejście do warunków bety jest celowo w menu konta: nie udajemy checkoutu,
  // ale tester ma zawsze dostęp do jasnego opisu zakresu i ceny.
  await page.getByRole('button', { name: 'Konto' }).click();
  await page.getByRole('button', { name: 'Zakres bezpłatnej bety' }).click();
  await page.getByTestId('beta-scope-view').waitFor();
  const scopeText = await page.getByTestId('beta-scope-view').innerText();
  if (!scopeText.includes('0 zł') || !scopeText.includes('Podstawowy przepływ nie wymaga płatności')) {
    throw new Error('Widok zakresu bety nie potwierdza ceny 0 i podstawowego przepływu bez płatności.');
  }
  for (const forbidden of forbiddenPurchaseCtas) {
    if (scopeText.includes(forbidden)) throw new Error(`Widok zakresu bety zawiera aktywne CTA zakupowe: ${forbidden}`);
  }
  if (!scopeText.includes('Nie przewiduje decyzji rekrutera')) {
    throw new Error('Widok zakresu bety nie komunikuje ograniczenia wyniku ATS.');
  }
  await page.screenshot({ path: `${outputDir}/02-zakres-bety-0-zl.png`, fullPage: true });

  console.log('✓ D05: nowy tester dotarł do zakresu bety Kierivo bez płatności.');
  console.log('✓ D05: brak aktywnych CTA zakupowych na sprawdzonych ekranach.');
  console.log(`✓ D05: zrzuty zapisane w ${outputDir}.`);
} finally {
  await browser.close();
}
