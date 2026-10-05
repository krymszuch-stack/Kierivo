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
    if (url.pathname.endsWith('/coach-star/evaluate-answer')) {
      const component = { score: 6, feedback: 'Syntetyczna ocena do próby schowka.' };
      return route.fulfill({ json: { evaluation: { overallScore: 6, verdict: 'SOLID', starBreakdown: { situation: component, task: component, action: component, result: component }, strengths: ['Opis działania'], improvements: ['Sprawdź fakty'], exemplaryResponse: 'Obsługiwałem zgłoszenia klientów.' } } });
    }
    if (url.pathname === '/api/advisor/rewrite-section') {
      const { text } = route.request().postDataJSON();
      return route.fulfill({ json: { success: true, originalText: text, proposedText: text, ruleExplanation: 'Syntetyczna próba schowka.', appliedRules: [], model: 'syntetyczny endpoint' } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Syntetyczny endpoint audytowy.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text())
        .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
        .replace('<div id="root"></div>', '<main id="audit-preview"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { StarHelperModal } = await import('/src/features/vault/StarHelperModal.tsx');
    const { ToastHost } = await import('/src/components/ui/ToastHost.tsx');
    const toastStore = await import('/src/store/useToastStore.ts');
    const createElement = react.createElement ?? react.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    window.__clipboardAudit = { root, createElement, react, ToastHost, toastStore, writes: [] };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: text => new Promise((resolve, reject) => window.__clipboardAudit.writes.push({ text, resolve, reject })),
    } });
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(StarHelperModal, { isOpen: true, onClose: () => {} }), createElement(ToastHost)));
  });
  await page.getByRole('button', { name: 'Kopiuj szablon', exact: true }).first().click();
  await page.waitForTimeout(150);
  assert.equal(await page.getByText('Skopiowano do schowka', { exact: true }).count(), 0, 'Oczekiwanie na Clipboard API nie jest sukcesem');
  await page.evaluate(() => window.__clipboardAudit.writes[0].reject(new DOMException('Syntetyczna odmowa dostępu', 'NotAllowedError')));
  await page.getByText('Nie udało się skopiować', { exact: true }).waitFor();
  assert.equal(await page.getByText('Skopiowano do schowka', { exact: true }).count(), 0);
  await page.waitForFunction(() => {
    const title = [...document.querySelectorAll('p')].find(node => node.textContent === 'Nie udało się skopiować');
    return title && Number(getComputedStyle(title.parentElement.parentElement).opacity) >= 0.99;
  });
  await page.screenshot({ path: 'docs/evidence/clipboard-denied-2026-10-03.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Kopiuj szablon', exact: true }).first().click();
  await page.evaluate(() => window.__clipboardAudit.writes[1].resolve());
  await page.getByText('Skopiowano do schowka', { exact: true }).waitFor();

  await page.evaluate(async () => {
    const { root, createElement, react, ToastHost } = window.__clipboardAudit;
    const { SkillBridgeCard } = await import('/src/components/bridge/SkillBridgeCard.tsx');
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(SkillBridgeCard, { bridge: { missingSkill: 'UDT', existingSkill: 'Praca w magazynie', relatedTopics: 'Syntetyczna próba schowka', talkingPoint: 'Nie posiadam UDT.', evidenceFromVault: '' } }), createElement(ToastHost)));
  });
  await page.getByRole('button', { name: 'Kopiuj odpowiedź', exact: true }).click();
  await page.evaluate(() => window.__clipboardAudit.writes[2].reject(new DOMException('Syntetyczna odmowa dostępu', 'NotAllowedError')));
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button', { name: 'Skopiowano!', exact: true }).count(), 0);
  // Pierwszy błąd ze słowniczka pozostaje w kolejce, drugi dowodzi obsłużenia karty.
  assert.equal(await page.getByText('Nie udało się skopiować', { exact: true }).count(), 2);
  for (const close of await page.getByRole('button', { name: 'Zamknij powiadomienie', exact: true }).all()) await close.click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Zamknij powiadomienie"]').length === 0);
  await page.evaluate(async () => {
    const { root, createElement, react, ToastHost } = window.__clipboardAudit;
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.apiUrl = '/api';
    const { SectionRewriterView } = await import('/src/features/advisor/SectionRewriterView.tsx');
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(SectionRewriterView, { azureAvailable: true }), createElement(ToastHost)));
  });
  const source = page.getByRole('textbox', { name: 'Treść punktu lub sekcji do ulepszenia:', exact: true });
  await source.fill('Obsługiwałem zgłoszenia klientów.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ulepsz ten punkt', exact: true }).click();
  await page.getByText('Podgląd propozycji zmian', { exact: true }).waitFor();
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: /skopiuj/i }).click();
  await source.fill('Przyjmowałem dostawy w magazynie.');
  await page.getByRole('button', { name: 'Ulepsz ten punkt', exact: true }).click();
  await page.getByText('Podgląd propozycji zmian', { exact: true }).waitFor();
  await page.evaluate(() => window.__clipboardAudit.writes[3].resolve());
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('Skopiowano ulepszoną treść do schowka', { exact: true }).count(), 0, 'Spóźnione kopiowanie nie zatwierdza nowej propozycji');
  assert.equal(await page.getByRole('button', { name: 'Skopiowano!', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /skopiuj/i }).isDisabled(), true);
  await page.screenshot({ path: 'docs/evidence/rewriter-stale-clipboard-2026-10-03.png', animations: 'disabled' });
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: /skopiuj/i }).click();
  await page.getByRole('checkbox').last().uncheck();
  await page.evaluate(() => window.__clipboardAudit.writes[4].resolve());
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('Skopiowano ulepszoną treść do schowka', { exact: true }).count(), 0, 'Cofnięcie potwierdzenia unieważnia oczekujące kopiowanie');
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: /skopiuj/i }).click();
  await page.evaluate(() => window.__clipboardAudit.writes[5].reject(new DOMException('Syntetyczna odmowa dostępu', 'NotAllowedError')));
  await page.getByText('Nie udało się skopiować automatycznie', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Skopiowano!', exact: true }).count(), 0);
  await page.getByRole('button', { name: /skopiuj/i }).click();
  await page.evaluate(() => window.__clipboardAudit.writes[6].resolve());
  await page.getByRole('button', { name: 'Skopiowano!', exact: true }).waitFor();

  async function expectCopyFailure(button, message) {
    const before = await page.evaluate(() => window.__clipboardAudit.writes.length);
    await button.click();
    await page.waitForFunction(count => window.__clipboardAudit.writes.length > count, before);
    assert.equal(await page.getByRole('button', { name: /^Skopiowano!?$/ }).count(), 0, 'Sukces wymaga zakończenia zapisu');
    await page.evaluate(() => window.__clipboardAudit.writes.at(-1).reject(new DOMException('Syntetyczna odmowa dostępu', 'NotAllowedError')));
    await page.getByText(message, { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Skopiowano!?$/ }).count(), 0);
  }

  await page.evaluate(async () => {
    const { root, createElement, react, ToastHost } = window.__clipboardAudit;
    const { JDKeywordMapper } = await import('/src/features/matcher/JDKeywordMapper.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const vault = createEmptyVault('Profil syntetyczny');
    vault.projects = [{ id: 'synthetic-project', name: 'Projekt testowy', role: 'Tester', description: 'System oparty o Kafka.', techStack: ['Kafka'] }];
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(JDKeywordMapper, { vault, initialJdText: 'Poszukujemy pracownika.\nWymagania:\n- Doświadczenie w pracy z Kafka' }), createElement(ToastHost)));
  });
  await expectCopyFailure(page.getByRole('button', { name: 'Kopiuj', exact: true }).first(), 'Zaznacz treść sugestii i skopiuj ją ręcznie.');

  await page.evaluate(async () => {
    const { root, createElement, react, ToastHost } = window.__clipboardAudit;
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.supabaseUrl = null;
    clientEnv.supabaseAnonKey = null;
    const { AuthProvider } = await import('/src/context/AuthContext.tsx');
    const { JobFeasibilityAdvisor } = await import('/src/features/matcher/JobFeasibilityAdvisor.tsx');
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(AuthProvider, null, createElement(JobFeasibilityAdvisor, {
        offer: { id: 'synthetic-offer', title: 'Magazynier', company: 'Firma testowa', salary: '6000 zł', location: '' },
        preferences: { salaryAmount: 6000, contract: 'UOP', workMode: 'ONSITE', officeDaysPerWeek: 5, oneWayMinutes: 45, monthlyCommuteCost: 400 },
        onPreferencesChange: () => {},
      })), createElement(ToastHost)));
  });
  await page.getByRole('checkbox', { name: 'Zatwierdzam parametry (pokaż wynik)' }).check();
  await page.getByRole('button', { name: /Taktyka Negocjacyjna/ }).click();
  await expectCopyFailure(page.getByRole('button', { name: 'Kopiuj', exact: true }).first(), 'Zaznacz treść taktyki i skopiuj ją ręcznie.');

  await page.evaluate(async () => {
    const { root, createElement, react, ToastHost } = window.__clipboardAudit;
    const { StarCoachSection } = await import('/src/features/cockpit/StarCoachSection.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const { setAuthenticatedEntitlements } = await import('/src/store/useEntitlements.ts');
    // Stan wyłącznie tej izolowanej strony, bez konta lub logowania produkcyjnego.
    setAuthenticatedEntitlements({ status: 'free' });
    root.render(createElement(react.Fragment ?? react.default.Fragment, null,
      createElement(StarCoachSection, { vault: createEmptyVault('Profil syntetyczny') }), createElement(ToastHost)));
  });
  await page.getByRole('checkbox').check();
  await page.locator('textarea').fill('Obsługiwałem zgłoszenia klientów.');
  await page.getByRole('button', { name: 'Oceń odpowiedź (AI STAR Coach)', exact: true }).click();
  await page.getByRole('button', { name: 'Kopiuj', exact: true }).waitFor();
  await page.getByRole('checkbox').last().check();
  await expectCopyFailure(page.getByRole('button', { name: 'Kopiuj', exact: true }), 'Zaznacz szkic odpowiedzi i skopiuj go ręcznie.');
  await page.getByRole('button', { name: 'Kopiuj', exact: true }).click();
  await page.locator('textarea').fill('Przyjmowałem dostawy w magazynie.');
  await page.evaluate(() => window.__clipboardAudit.writes.at(-1).resolve());
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button', { name: 'Skopiowano!', exact: true }).count(), 0, 'Zakończenie kopiowania starego szkicu trenera nie wraca po edycji');
  assert.deepEqual(errors, []);
  console.log('PASS: cztery poprawione miejsca oczekują na zapis i pokazują odmowę; ponowienie słowniczka działa; karta umiejętności pokazuje błąd; stara operacja nie zatwierdza nowej propozycji.');
} finally {
  await browser.close();
}
