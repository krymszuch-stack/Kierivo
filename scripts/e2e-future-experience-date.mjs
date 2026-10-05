import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3045';
const output = 'docs/evidence/future-experience-date-not-counted-2026-10-01.png';
const playwrightModule = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';

const { chromium } = await import(playwrightModule);
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await page.locator('#onboarding-cv').waitFor({ state: 'visible' });
  await page.locator('#onboarding-cv').fill([
    'Anna Kowalska',
    'Email: anna.kowalska@example.pl',
    'Stanowisko: Inżynier wsparcia IT',
    'Umiejętności',
    'Python, AWS, Linux',
    'Doświadczenie zawodowe',
    'Example Sp. z o.o. — Inżynier wsparcia IT',
    '2020-01 – 2099-01',
    'Diagnozowanie incydentów i utrzymanie usług w środowisku Linux.',
  ].join('\n'));
  await page.locator('#onboarding-jd').fill([
    'Firma szuka Inżyniera wsparcia IT do zespołu obsługującego środowisko chmurowe.',
    'Wymagania obowiązkowe:',
    '- Minimum 5 lat doświadczenia zawodowego w roli Inżyniera wsparcia IT.',
    '- Praktyczna znajomość Python, AWS oraz Linux.',
    '- Samodzielna diagnostyka incydentów i dokumentowanie rozwiązania.',
    'Zakres obejmuje obsługę zgłoszeń, analizę logów, współpracę z zespołami infrastruktury,',
    'monitorowanie usług i utrzymanie procedur operacyjnych. Kandydat będzie uczestniczyć',
    'w przeglądach jakości i przekazywać użytkownikom jasne informacje o postępie.',
  ].join('\n'));
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();
  await page.waitForTimeout(2500);
  const details = page.getByRole('button', { name: /Pokaż szczegóły/ });
  if (await details.isVisible()) {
    await details.click();
    await page.waitForTimeout(500);
  }

  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('Nie można potwierdzić: Min. 5 lat doświadczenia')) {
    console.error(bodyText.slice(-3000));
    throw new Error('UI nie ujawnia niepotwierdzonego wymogu stażu przy przyszłej dacie końca.');
  }

  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Zapisano zrzut lokalnego wyniku syntetycznego: ${output}`);
  console.log(bodyText.slice(-2200));
} finally {
  await browser.close();
}
