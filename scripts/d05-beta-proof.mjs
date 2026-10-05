#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const baseUrl = process.env.D05_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.D05_SCREENSHOT_DIR ?? 'artifacts/d05-beta';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

const forbiddenPurchaseCtas = [
  'Rozpocznij 30 dni',
  'Kup szablon',
  'Zobacz Karnet',
  'Stripe Portal',
  'Subskrybuj Pro',
];

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  // Hasło marketingowe zmienia się wraz z produktem; odbiór dotyczy wejścia
  // do działającego panelu i warunków bety, nie konkretnej wersji copy.
  await page.getByRole('heading', { name: 'Panel Główny', exact: true }).waitFor();
  const closeWelcome = page.getByRole('button', { name: 'Zamknij przewodnik', exact: true });
  if (await closeWelcome.isVisible()) await closeWelcome.click();

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
  const scopeText = (await page.getByTestId('beta-scope-view').innerText()).replace(/\s+/g, ' ');
  if (!scopeText.includes('0 zł') || !scopeText.includes('W tej wersji nie pobieramy opłat') ||
      !scopeText.includes('Pełny przepływ i asystenci AI bez karty płatniczej')) {
    throw new Error('Widok zakresu bety nie potwierdza ceny 0 i podstawowego przepływu bez płatności.');
  }
  for (const forbidden of forbiddenPurchaseCtas) {
    if (scopeText.includes(forbidden)) throw new Error(`Widok zakresu bety zawiera aktywne CTA zakupowe: ${forbidden}`);
  }
  if (!scopeText.includes('Nie przewiduje decyzji rekrutera')) {
    throw new Error('Widok zakresu bety nie komunikuje ograniczenia wyniku ATS.');
  }
  await page.screenshot({ path: `${outputDir}/02-zakres-bety-0-zl.png`, fullPage: true });
  if (pageErrors.length) throw new Error(`Błędy aplikacji: ${pageErrors.join('; ')}`);

  console.log('✓ D05: nowy tester dotarł do zakresu bety Kierivo bez płatności.');
  console.log('✓ D05: brak aktywnych CTA zakupowych na sprawdzonych ekranach.');
  console.log(`✓ D05: zrzuty zapisane w ${outputDir}.`);
} catch (error) {
  await page.screenshot({ path: `${outputDir}/blad-odbioru.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
