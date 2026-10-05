import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/jd-keyword-mapper-honest-coverage-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { JDKeywordMapper }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/JDKeywordMapper.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Profil syntetyczny', 'test@example.invalid');
    vault.skillsMatrix.hardSkills = ['React', 'TypeScript'];
    const tailoredResume = {
      targetJobTitle: 'Inżynier oprogramowania',
      companyName: 'Firma testowa',
      summary: 'Profil testowy.',
      selectedHighlights: [],
      skillsMatched: { hardSkills: ['React'], toolsAndTech: [], softSkills: [] },
      atsScore: 0,
    };
    document.body.innerHTML = '<main id="audit-jd-mapper" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-jd-mapper')).render(createElement(JDKeywordMapper, {
      initialJdText: 'Wymagania: React, TypeScript oraz Kubernetes.',
      vault,
      tailoredResume,
    }));
  });

  const panel = page.locator('#audit-jd-mapper');
  await panel.getByText('Pokrycie wykrytych terminów w bieżącym CV:').waitFor({ state: 'visible' });
  await panel.getByText(/nie jest wynikiem ATS ani prognozą decyzji rekrutera/i).waitFor({ state: 'visible' });
  await panel.getByText(/W MasterVault, poza bieżącym CV: 1/i).waitFor({ state: 'visible' });
  await panel.getByText(/Nie znaleziono w MasterVault: 1/i).waitFor({ state: 'visible' });
  assert.equal(await panel.getByText(/Potencjał z MasterVault|wpływ wg heurystyki|\+\d+%/i).count(), 0);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: mapper pokazuje tylko pokrycie terminów i ich liczby; brak prognoz procentowych. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
