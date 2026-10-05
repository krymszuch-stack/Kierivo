import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/invalid-historical-percentages-2026-10-02.png';
const CANONICAL_OUTPUT = 'docs/evidence/invalid-canonical-percentage-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const rendered = await page.evaluate(async () => {
    const [react, reactDom, { AtsSimulatorView }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/matcher/AtsSimulatorView.tsx'),
    ]);
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const createElement = react.createElement ?? react.default?.createElement;
    const malformedSnapshot = {
      keywordCoverageScore: 150,
      structureScore: Number.NaN,
      layer2Nlp: {
        hardSkillsCoverage: -1,
        formalReqsCoverage: Number.POSITIVE_INFINITY,
      },
      layer3Scoring: {
        recencyScore: 150,
        titleMatchScore: -1,
      },
      ocrWarnings: [],
      badDateFormats: [],
      missingHardSkills: [],
      recommendations: [],
    };
    document.body.innerHTML = '<main id="audit-invalid-snapshot" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    const reactRoot = createRoot(document.getElementById('audit-invalid-snapshot'));
    reactRoot.render(createElement(AtsSimulatorView, {
      result: malformedSnapshot,
    }));
    window.renderInvalidCanonicalResult = () => reactRoot.render(createElement(AtsSimulatorView, {
      result: malformedSnapshot,
      canonicalResult: {
        state: 'SCORABLE',
        score: 150,
        matchedRequirements: [],
        missingRequirements: [],
        unconfirmedRequirements: [],
        components: { skills: 150, experience: -1, structure: Number.NaN, formal: Number.POSITIVE_INFINITY },
        effectiveWeights: { skills: 0.4, experience: 0.25, structure: 0.2, formal: 0.15 },
      },
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const root = document.getElementById('audit-invalid-snapshot');
    return { text: root.innerText, html: root.innerHTML };
  });

  const report = page.locator('#audit-invalid-snapshot');
  await report.getByText('Diagnostyka zapisanej migawki').waitFor({ state: 'visible' });
  assert.equal((rendered.text.match(/brak danych/g) ?? []).length, 4,
    'wszystkie błędne metryki legacy powinny być oznaczone jako brak danych');
  assert.equal((rendered.text.match(/\?/g) ?? []).length, 4,
    'nieprawidłowe wyniki kafelków diagnostycznych powinny być oznaczone znakiem zapytania');
  assert.doesNotMatch(rendered.text, /(?:150|100)%/, 'nie wolno przycinać błędnych wartości do wiarygodnego procentu');
  assert.doesNotMatch(rendered.html, /role="progressbar"/, 'brak danych nie może renderować paska postępu');

  await mkdir('docs/evidence', { recursive: true });
  await report.screenshot({ path: OUTPUT, fullPage: true });
  await page.evaluate(() => window.renderInvalidCanonicalResult());
  await report.getByText('Niezweryfikowany wynik').waitFor({ state: 'visible' });
  const canonicalText = await report.innerText();
  assert.equal((canonicalText.match(/brak danych/g) ?? []).length, 8);
  assert.doesNotMatch(canonicalText, /(?:150|100)%/);
  assert.doesNotMatch(canonicalText, /Wszystkie wykryte wymagania są potwierdzone/);
  await report.screenshot({ path: CANONICAL_OUTPUT, fullPage: true });
  console.log(`Nieprawidlowe wartosci legacy i kanoniczne sa prezentowane jako brak wiarygodnego wyniku. Zrzuty: ${OUTPUT}, ${CANONICAL_OUTPUT}`);
} finally {
  await browser.close();
}
