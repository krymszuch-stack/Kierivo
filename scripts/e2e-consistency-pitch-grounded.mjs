import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/consistency-pitch-profile-claims-2026-10-02.png';
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
    const [React, ReactDOM, { ConsistencyGuardView }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/features/consistency/ConsistencyGuardView.tsx'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.personalInfo.title = '';
    vault.projects = [{
      id: 'synthetic-project-tags-only', name: 'Projekt testowy', role: 'Autor',
      description: 'Wpis profilu bez opisu zadań ani potwierdzonych wyników.',
      techStack: ['TypeScript', 'React'],
    }];
    document.body.innerHTML = '<main id="audit-grounded-pitch" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-grounded-pitch')).render(createElement(ConsistencyGuardView, { vault }));
  });

  const panel = page.locator('#audit-grounded-pitch');
  await panel.getByRole('tab', { name: 'Renderer Pitch (30s)' }).click();
  await panel.getByText('Szkic wypowiedzi z wpisów profilu').waitFor({ state: 'visible' });
  await panel.getByText(/Generator nie weryfikuje ich prawdziwości ani poziomu biegłości/i).waitFor({ state: 'visible' });
  await panel.getByText('Wpisy profilu użyte w szkicu').waitFor({ state: 'visible' });
  await panel.getByText(/W profilu przy wpisie „Projekt testowy” zapisano tagi wpisu: TypeScript, React\./).waitFor({ state: 'visible' });
  const renderedText = await panel.innerText();
  assert.doesNotMatch(renderedText, /zweryfikowanych filarach|specjalizuję się|od lat realizuję|udokumentowaną historią wdrożeń|odpowiadałem za wdrożenia|osiągnąłem wymierny rezultat|natychmiastowe wsparcie/i);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: pitch opisuje wpis profilu i nie wyprowadza biegłości ani doświadczenia z liczby claimów. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
