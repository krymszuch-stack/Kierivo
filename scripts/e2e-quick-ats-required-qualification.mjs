/** E2E: szybki wynik nie może ukryć twardego braku formalnego. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/quick-ats-required-qualification-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const cv = [
  'Jan Testowy',
  'Technik serwisu',
  'Podsumowanie zawodowe',
  'Doświadczenie zawodowe w serwisie technicznym i diagnozowaniu usterek.',
  'Doświadczenie zawodowe',
  'Technik serwisu — Example Service | 2021–2025',
  'Diagnozowanie usterek urządzeń i obsługa klienta.',
  'Umiejętności',
  'Diagnostyka techniczna, obsługa klienta.',
].join('\n');
const job = [
  'Technik serwisu',
  'Wymagania',
  'Pracodawcy wymagają ważnych uprawnień SEP G1 do 1 kV.',
  'Zakres obowiązków obejmuje diagnozowanie usterek, dokumentowanie napraw i kontakt z klientami.',
  'Mile widziane doświadczenie w serwisie urządzeń i obsłudze zgłoszeń.',
].join('\n');

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await page.locator('#onboarding-cv').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#onboarding-jd').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#onboarding-cv').fill(cv);
  await page.locator('#onboarding-jd').fill(job);
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();

  const status = page.getByTestId('quick-onboarding-status');
  await status.waitFor({ state: 'visible', timeout: 15_000 });
  const statusText = await status.innerText();
  const body = await page.locator('body').innerText();
  if (!statusText.includes('Wymóg obowiązkowy niepotwierdzony') ||
      !statusText.includes('SEP G1') || !body.includes('Sprawdź wymagane uprawnienie przed oceną aplikacji')) {
    throw new Error(`Szybki wynik nie pokazał braku wymaganego SEP G1: ${statusText}`);
  }
  if (/wymog obowiazkowy|sprawdz wymagane uprawnienie|spelnienia tego warunku/i.test(statusText)) {
    throw new Error(`Ekran zawiera tekst bez polskich znaków: ${statusText}`);
  }
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join('; ')}`);

  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`OK: szybki wynik wskazuje brak obowiązkowego SEP G1; zrzut: ${OUTPUT}`);
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(-2_000));
  await page.screenshot({ path: 'docs/evidence/quick-ats-required-qualification-debug-2026-10-02.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
