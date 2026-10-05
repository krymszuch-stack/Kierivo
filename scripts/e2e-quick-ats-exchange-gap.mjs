/** E2E: brak Exchange Online nie może zniknąć z wyniku szybkiej analizy. */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/quick-ats-exchange-gap-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
  process.exit(2);
}

const cv = [
  'Jan Testowy',
  'IT Support Technician',
  'Podsumowanie zawodowe',
  'Doświadczony pracownik wsparcia użytkowników w środowisku Windows i Microsoft 365.',
  'Doświadczenie zawodowe',
  'IT Support Technician — Example Helpdesk | 2021–2025',
  'Obsługa zgłoszeń ServiceNow, konfiguracja kont, diagnozowanie problemów Windows i TCP/IP.',
  'Umiejętności',
  'ServiceNow, Windows 11, Microsoft 365, Active Directory, TCP/IP, obsługa klienta.',
].join('\n');

const job = [
  'Specjalista wsparcia IT',
  'Required qualifications',
  'Microsoft Exchange Online administration is required for daily mailbox support.',
  'ServiceNow ticket management and clear communication with business users.',
  'The role includes investigating incidents, documenting solutions and escalating unresolved cases.',
].join('\n');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await page.locator('#onboarding-cv').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#onboarding-jd').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#onboarding-cv').fill(cv);
  await page.locator('#onboarding-jd').fill(job);
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();

  const result = page.locator('[role="status"]').filter({ hasText: 'Zgodność wymaganych umiejętności' }).first();
  await result.waitFor({ state: 'visible', timeout: 15_000 });
  const warningContrast = await page.getByTestId('quick-onboarding-status').evaluate((card) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable for contrast measurement.');

    const paintOver = (foreground, background) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = background;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = foreground;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const luminance = (rgb) => {
      const channels = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foreground = getComputedStyle(card.querySelector('h3')).color;
    const background = getComputedStyle(card).backgroundColor;
    const surface = getComputedStyle(card.parentElement).backgroundColor;
    const compositeBackground = paintOver(background, surface);
    const compositeForeground = paintOver(foreground, `rgb(${compositeBackground.join(',')})`);
    const values = [luminance(compositeForeground), luminance(compositeBackground)].sort((a, b) => b - a);
    return { foreground, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
  });
  console.log(`Kontrast komunikatu ostrzegawczego: ${warningContrast.ratio.toFixed(2)}:1 (${warningContrast.foreground} na ${warningContrast.background})`);
  if (warningContrast.ratio < 4.5) {
    throw new Error(`Kontrast tekstu komunikatu ostrzegawczego jest niższy niż 4.5:1: ${JSON.stringify(warningContrast)}`);
  }
  const body = await page.locator('body').innerText();
  const scoreText = await result.innerText();
  if (/Zgodność wymaganych umiejętności:\s*100%/.test(scoreText)) {
    throw new Error(`Brak wymaganej technologii dostał pełne pokrycie: ${scoreText}`);
  }
  if (!/Zgodność wymaganych umiejętności:\s*50%/.test(scoreText)) {
    throw new Error(`Oczekiwano jednego dopasowanego i jednego brakującego wymagania: ${scoreText}`);
  }
  if (!body.includes('Nie znaleziono w CV: exchange online')) {
    throw new Error(`Wynik nie pokazuje brakującego Exchange Online: ${body.slice(-1400)}`);
  }
  if (/Nie znaleziono w CV:\s*required\b/i.test(body)) {
    throw new Error('Nagłówek Required qualifications został błędnie pokazany jako brakująca umiejętność.');
  }
  if (/Nie znaleziono w CV:.*specjalista/i.test(body)) {
    throw new Error('Nazwa stanowiska została błędnie pokazana jako brakująca umiejętność.');
  }
  if (pageErrors.length) throw new Error(`Błędy strony: ${pageErrors.join(' | ')}`);

  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Zrzut: ${OUTPUT}`);
  console.log(`OK: wynik szybkiej analizy nie zalicza brakującego Exchange Online jako pełnego pokrycia. ${scoreText.replace(/\s+/g, ' ').trim()}`);
} catch (error) {
  console.error('Stan strony przy błędzie:', (await page.locator('body').innerText().catch(() => '')).slice(-2_000));
  await page.screenshot({ path: 'docs/evidence/quick-ats-exchange-gap-debug-2026-10-02.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
