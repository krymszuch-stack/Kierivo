import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3004';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname === '/') {
      const response = await route.fetch();
      return route.fulfill({ response, body: (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '') });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const [React, dom, { CVParserModal }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/parser/CVParserModal.tsx'), import('/src/lib/sampleVault.ts'), import('/src/index.css'),
    ]);
    const e = React.createElement ?? React.default.createElement;
    document.body.innerHTML = '<main id="import-proof" style="max-width:1200px;margin:24px auto"></main>';
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('import-proof')).render(e(CVParserModal, {
      currentVault: createEmptyVault('', ''), onApplyVault: vault => { window.__syntheticImport = vault; },
    }));
  });
  await page.getByRole('tab', { name: 'Wklej treść' }).click();
  await page.getByRole('textbox', { name: 'Treść CV', exact: true }).fill([
    'Anna Syntetyczna', 'Programistka Python', 'synthetic@example.invalid',
    'Podsumowanie zawodowe', 'Profil syntetyczny do odbioru Kierivo ADR-152. Rozwijam aplikacje Python.',
    'Umiejętności', 'Python, SQL',
    'Edukacja', 'Politechnika Testowa', 'Inżynier, Informatyka', '2015 – 2019',
  ].join('\n'));
  await page.getByRole('button', { name: 'Przeanalizuj CV i pokaż różnice' }).click();
  await page.getByRole('heading', { name: 'Wykształcenie (1 pozycji)', exact: true }).waitFor();
  assert.equal(await page.getByText('ADR', { exact: true }).count(), 0, 'identyfikator zgłoszenia nie jest umiejętnością');
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/cv-import-source-facts.png', fullPage: true });
  await page.getByRole('button', { name: 'Zastosuj i Scal do Master Vault' }).click();
  const saved = await page.evaluate(() => window.__syntheticImport);
  assert.ok(saved, 'rzeczywisty przycisk importu musi przekazać profil');
  assert.deepEqual(saved.skillsMatrix.hardSkills.sort(), ['Python', 'SQL']);
  assert.equal(saved.education.length, 1);
  assert.deepEqual(saved.education.map(({ institution, degree, fieldOfStudy, startDate, endDate }) => ({ institution, degree, fieldOfStudy, startDate, endDate })), [{
    institution: 'Politechnika Testowa', degree: 'Inżynier', fieldOfStudy: 'Informatyka', startDate: '2015', endDate: '2019',
  }]);
  assert.deepEqual(errors, []);
  console.log('PASS: rzeczywisty import tekstu → różnice → MasterVault zachowuje jedną edukację z datami i nie tworzy umiejętności ADR ze zgłoszenia ADR-152.');
} finally { await browser.close(); }
