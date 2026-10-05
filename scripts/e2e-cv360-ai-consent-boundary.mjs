/** E2E ekranu zgody Weryfikatora CV 360; API/model pozostaja poza testem. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/cv360-ai-consent-boundary-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 850 } });
  const aiRequests = [];
  page.on('request', (request) => {
    if (/\/api\/ai\/verify-cv/.test(request.url())) aiRequests.push(request.url());
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.body.replaceChildren();
    Object.assign(document.body.style, { margin: '0', minHeight: '100vh', background: 'var(--color-app-bg)' });
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const { Cv360VerifierModal } = await import('/src/features/matcher/Cv360VerifierModal.tsx');
    const vault = {
      version: '1', updatedAt: '2026-10-02T00:00:00.000Z',
      personalInfo: { fullName: 'Jan Testowy', title: 'Technik wsparcia', summary: 'Doswiadczenie w diagnozie usterek i obsludze zgloszen.' },
      skillsMatrix: { hardSkills: ['Troubleshooting'], toolsAndTech: ['Windows'], softSkills: [], certifications: [] },
      history: [], education: [], projects: [],
      profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
    };
    const host = document.createElement('div');
    host.id = 'cv360-consent-proof';
    document.body.append(host);
    createRoot(host).render(createElement(Cv360VerifierModal, {
      isOpen: true, onClose: () => undefined, vault,
      targetRole: 'Technik wsparcia', targetCompany: 'Firma testowa',
      currentUser: null,
      onRequireLogin: () => { window.__cv360LoginRequired = true; },
    }));
  });

  const dialog = page.locator('.fixed.inset-0');
  await dialog.waitFor();
  const checkbox = dialog.getByRole('checkbox');
  const runButton = dialog.getByRole('button', { name: /Uruchom analizę profilu AI/i });
  assert.equal(await runButton.isDisabled(), true, 'bez zgody akcja modelu ma pozostac zablokowana');
  const consentCopy = (await dialog.innerText()).normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  assert.match(consentCopy, /doswiadczenie, umiejetnosci, edukacja i uprawnienia/);
  assert.match(consentCopy, /nie gwarantuje pe[lł]nej anonimizacji/);

  await checkbox.check();
  assert.equal(await runButton.isDisabled(), false);
  mkdirSync('docs/evidence', { recursive: true });
  await dialog.screenshot({ path: SCREENSHOT });
  await runButton.click();
  await page.waitForFunction(() => window.__cv360LoginRequired === true);
  assert.deepEqual(aiRequests, [], 'bez aktywnej sesji UI nie moze wywolac endpointu AI');
  console.log(`PASS: zgoda jest jawna, bez sesji endpoint AI nie jest wywolywany; zrzut: ${SCREENSHOT}`);
} finally {
  await browser.close();
}
