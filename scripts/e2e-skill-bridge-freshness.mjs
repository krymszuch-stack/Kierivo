import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Syntetyczna granica audytu.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>').replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { JDKeywordMapper } = await import('/src/features/matcher/JDKeywordMapper.tsx');
    const { SkillBridgeCard } = await import('/src/components/bridge/SkillBridgeCard.tsx');
    const { SkillBridgeMatrixModal } = await import('/src/components/bridge/SkillBridgeMatrixModal.tsx');
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const { findSkillBridgeForGap } = await import('/src/lib/skillBridgeEngine.ts');
    const createElement = react.createElement ?? react.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    const vault = createEmptyVault('Profil syntetyczny');
    vault.skillsMatrix.hardSkills = ['RabbitMQ', 'Docker', 'WMS'];
    window.__bridgeAudit = { root, createElement, react, vault, SkillBridgeCard, SkillBridgeMatrixModal, ToastHost, findSkillBridgeForGap, writes: [] };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: text => new Promise((resolve, reject) => window.__bridgeAudit.writes.push({ text, resolve, reject })),
    } });
    root.render(createElement(JDKeywordMapper, { vault, initialJdText: 'Poszukujemy pracownika.\nWymagania:\n- Doświadczenie w pracy z Kafka' }));
  });
  await page.getByRole('button', { name: 'Most kompetencyjny', exact: true }).first().click();
  assert.equal(await page.getByText('Nie wykazano w profilu: Kafka', { exact: true }).count(), 1, 'Kliknięta luka ma otworzyć własny most w rzeczywistym mapperze');
  await page.waitForFunction(() => {
    const modal = document.querySelector('.shadow-floating');
    return modal && Number(getComputedStyle(modal).opacity) >= 0.99;
  });
  await page.screenshot({ path: 'docs/evidence/skill-bridge-open-from-offer-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Zamknij most kompetencyjny', exact: true }).click();
  await page.getByRole('button', { name: 'Most kompetencyjny', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Brakująca umiejętność', exact: true }).fill('Kubernetes');
  await page.getByRole('button', { name: 'Zbuduj Most', exact: true }).click();
  await page.getByText('Nie wykazano w profilu: Kubernetes', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zamknij most kompetencyjny', exact: true }).click();
  await page.getByRole('button', { name: 'Most kompetencyjny', exact: true }).first().click();
  assert.equal(await page.getByText('Nie wykazano w profilu: Kubernetes', { exact: true }).count(), 0, 'Ponowne otwarcie nie przywraca poprzedniej ręcznie dodanej luki');

  async function renderModal(overrides) {
    await page.evaluate(overrides => {
      const a = window.__bridgeAudit;
      a.modalProps = { isOpen: true, onClose: () => {}, vault: a.vault, initialMissingSkill: 'Kafka', ...a.modalProps, ...overrides };
      a.root.render(a.createElement(a.SkillBridgeMatrixModal, a.modalProps));
    }, overrides);
  }
  await renderModal({});
  await renderModal({ initialMissingSkill: 'Kubernetes' });
  await page.getByText('Nie wykazano w profilu: Kubernetes', { exact: true }).waitFor();
  assert.equal(await page.getByText('Nie wykazano w profilu: Kafka', { exact: true }).count(), 0);
  await renderModal({ initialMissingSkill: undefined, missingSkillsList: ['SAP WMS'] });
  await page.getByText('Nie wykazano w profilu: SAP WMS', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Brakująca umiejętność', exact: true }).fill('Szkic użytkownika');
  await page.evaluate(() => {
    const a = window.__bridgeAudit;
    a.modalProps.vault = { ...a.vault, updatedAt: '2026-10-04T12:00:00Z' };
    a.root.render(a.createElement(a.SkillBridgeMatrixModal, a.modalProps));
  });
  assert.equal(await page.getByRole('textbox', { name: 'Brakująca umiejętność', exact: true }).inputValue(), 'Szkic użytkownika');
  await page.evaluate(() => {
    const a = window.__bridgeAudit;
    a.modalProps.vault = { ...a.vault, skillsMatrix: { ...a.vault.skillsMatrix, hardSkills: ['Excel'] } };
    a.root.render(a.createElement(a.SkillBridgeMatrixModal, a.modalProps));
  });
  assert.equal(await page.getByRole('textbox', { name: 'Brakująca umiejętność', exact: true }).inputValue(), '');
  await page.getByText('Brak udokumentowanego powiązania dla wybranych umiejętności.', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/evidence/skill-bridge-context-2026-10-04.png', animations: 'disabled' });

  async function renderCard(skill) {
    await page.evaluate(skill => {
      const a = window.__bridgeAudit;
      a.root.render(a.createElement(a.react.Fragment ?? a.react.default.Fragment, null,
        a.createElement(a.SkillBridgeCard, { bridge: a.findSkillBridgeForGap(skill, a.vault) }), a.createElement(a.ToastHost)));
    }, skill);
  }
  await renderCard('Kafka');
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  await page.getByRole('button', { name: 'Kopiowanie…', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Kopiowanie…', exact: true }).isDisabled(), true);
  await renderCard('Kubernetes');
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  await page.evaluate(() => window.__bridgeAudit.writes[0].resolve());
  await page.waitForTimeout(80);
  assert.equal(await page.getByText('Skopiowano odpowiedź do schowka', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Kopiowanie…', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.__bridgeAudit.writes[1].resolve());
  await page.getByRole('button', { name: 'Skopiowano!', exact: true }).waitFor();
  await renderCard('Kafka');
  assert.equal(await page.getByRole('button', { name: 'Skopiowano!', exact: true }).count(), 0);
  for (const close of await page.getByRole('button', { name: 'Zamknij powiadomienie', exact: true }).all()) await close.click();
  await page.getByText('Skopiowano odpowiedź do schowka', { exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  await renderCard('Kubernetes');
  await page.evaluate(() => window.__bridgeAudit.writes[2].reject(new DOMException('Odmowa', 'NotAllowedError')));
  await page.waitForTimeout(80);
  assert.equal(await page.getByText('Nie udało się skopiować', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  await page.evaluate(() => window.__bridgeAudit.writes[3].reject(new DOMException('Odmowa', 'NotAllowedError')));
  await page.getByText('Nie udało się skopiować', { exact: true }).waitFor();
  await page.screenshot({ path: 'docs/evidence/skill-bridge-copy-freshness-2026-10-04.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  const successesBeforeUnmount = await page.getByText('Skopiowano odpowiedź do schowka', { exact: true }).count();
  await page.evaluate(() => {
    const a = window.__bridgeAudit;
    a.root.render(a.createElement(a.ToastHost));
  });
  await page.getByRole('button', { name: 'Kopiowanie…', exact: true }).waitFor({ state: 'detached' });
  await page.evaluate(() => window.__bridgeAudit.writes[4].resolve());
  await page.waitForTimeout(80);
  assert.equal(await page.getByText('Skopiowano odpowiedź do schowka', { exact: true }).count(), successesBeforeUnmount, 'Odmontowana karta nie dodaje drugiego sukcesu');
  assert.deepEqual(errors, []);
  console.log('PASS: rzeczywisty mapper otwiera właściwą lukę; kontekst modala odświeża stan; kopiowanie nie zatwierdza nowej karty spóźnionym wynikiem.');
} finally { await browser.close(); }
