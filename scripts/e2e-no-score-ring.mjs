import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT = 'docs/evidence/quick-onboarding-no-score-ring-2026-10-01.png';
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const PLAYWRIGHT_CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH ||
  'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';

let chromium;
try {
  ({ chromium } = await import(PLAYWRIGHT_MODULE));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true, executablePath: PLAYWRIGHT_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Wklej ofertę pracy' }).click();
  await page.locator('#onboarding-cv').waitFor({ state: 'visible' });
  await page.locator('#onboarding-cv').fill([
    'Anna Kowalska',
    'Email: anna.kowalska@example.pl',
    'Tel: +48 600 700 800',
    'Stanowisko: Backend Developer',
    'Podsumowanie: Programistka backendu z pięcioletnim doświadczeniem w budowie usług sieciowych.',
    'Umiejętności: Python, Django, PostgreSQL, Git, Docker',
    'Doświadczenie zawodowe: Acme Sp. z o.o. - Backend Developer, 2020 - 2025',
    'Projektowanie i utrzymanie usług REST w Pythonie oraz optymalizacja zapytań do PostgreSQL.',
    'Wykształcenie: Politechnika Warszawska - Inżynier Informatyki, 2015 - 2019',
  ].join('\n'));
  await page.locator('#onboarding-jd').fill([
    'Szukamy osoby do miłego zespołu. Oferujemy owoce, kawę, spokojne miejsce pracy i przyjazną atmosferę dla całego zespołu.',
  ].join('\n'));
  await page.getByRole('button', { name: 'Sprawdź', exact: true }).click();

  const result = page.getByRole('status', { name: 'Nie wyliczono wyniku dopasowania Kierivo' });
  await result.waitFor({ state: 'visible' });
  const track = result.locator('svg circle.stroke-line');
  if (await track.getAttribute('stroke-dasharray') !== '4 5') {
    throw new Error('Stan bez wyniku nie został wizualnie odróżniony od wyniku 0%.');
  }
  const resultText = await result.innerText();
  if (!/Nie wykryto|nie ma czego oceniać/i.test(resultText)) {
    throw new Error(`Ekran nie wyjaśnia braku wyniku: ${resultText}`);
  }

  await mkdir('docs/evidence', { recursive: true });
  await result.screenshot({ path: OUTPUT });
  console.log(`Brak wyniku jest oznaczony przerywanym pierścieniem; zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
