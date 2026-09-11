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
  await page.getByTestId('beta-landing').waitFor();

  const landingText = await page.locator('body').innerText();
  const hasHonestBetaLabel =
    landingText.includes('Public Pre-Beta') || landingText.includes('Bezpłatna beta');
  if (!hasHonestBetaLabel || !landingText.includes('0 zł')) {
    throw new Error('Ekran startowy nie komunikuje publicznego etapu beta/pre-beta i ceny 0 zł.');
  }
  for (const forbidden of forbiddenPurchaseCtas) {
    if (landingText.includes(forbidden)) throw new Error(`Ekran startowy nadal zawiera CTA zakupowe: ${forbidden}`);
  }
  await page.screenshot({ path: `${outputDir}/01-start-bezplatna-beta.png`, fullPage: true });

  await page.getByRole('button', { name: 'Sprawdź CV za darmo' }).click();
  await page.locator('#quick-cv').fill(
    'Jan Kowalski. Specjalista wsparcia IT. Obsługa Microsoft 365, Active Directory, Windows 11, PowerShell i zgłoszeń użytkowników. Diagnozowałem problemy, konfigurowałem konta i dokumentowałem rozwiązania. Język angielski B2.'
  );
  await page.locator('#quick-jd').fill(
    'Szukamy specjalisty IT Support. Wymagamy Windows 11, Microsoft 365, Active Directory, PowerShell, obsługi ticketów, dokumentacji technicznej i języka angielskiego B2. Mile widziane doświadczenie w pracy z użytkownikiem.'
  );
  await page.getByRole('button', { name: 'Policz wynik CVelocity' }).click();
  await page.getByTestId('quick-ats-result').waitFor();

  const resultText = await page.getByTestId('quick-ats-result').innerText();
  if (!resultText.includes('CVelocity')) throw new Error('Wynik szybkiego sprawdzenia nie jest podpisany jako CVelocity.');
  if (!resultText.includes('nie prognoza decyzji rekrutera')) {
    throw new Error('Przy wyniku brakuje ograniczenia obietnicy rekrutacyjnej.');
  }
  await page.screenshot({ path: `${outputDir}/02-wynik-cvelocity-bez-platnosci.png`, fullPage: true });

  await page.getByRole('button', { name: 'Zobacz zakres bety' }).click();
  await page.getByTestId('beta-scope-view').waitFor();
  const scopeText = await page.getByTestId('beta-scope-view').innerText();
  if (!scopeText.includes('0 zł') || !scopeText.includes('Podstawowy przepływ nie wymaga płatności')) {
    throw new Error('Widok zakresu bety nie potwierdza ceny 0 i podstawowego przepływu bez płatności.');
  }
  for (const forbidden of forbiddenPurchaseCtas) {
    if (scopeText.includes(forbidden)) throw new Error(`Widok zakresu bety zawiera aktywne CTA zakupowe: ${forbidden}`);
  }
  await page.screenshot({ path: `${outputDir}/03-zakres-bety-0-zl.png`, fullPage: true });

  console.log('✓ D05: nowy tester uzyskał wynik CVelocity i dotarł do zakresu bety bez płatności.');
  console.log('✓ D05: brak aktywnych CTA zakupowych na sprawdzonych ekranach.');
  console.log(`✓ D05: zrzuty zapisane w ${outputDir}.`);
} finally {
  await browser.close();
}
