import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const evaluations = [];
const questions = [];
const errors = [];
const feedback = { score: 6, feedback: 'Syntetyczna ocena do próby świeżości.' };
const evaluation = { overallScore: 6, verdict: 'SOLID', starBreakdown: { situation: feedback, task: feedback, action: feedback, result: feedback }, strengths: ['Opis działania'], improvements: ['Sprawdź fakty'], exemplaryResponse: 'Syntetyczny szkic do sprawdzenia.' };
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    if (url.pathname.endsWith('/coach-star/evaluate-answer')) { evaluations.push(route); return; }
    if (url.pathname.endsWith('/coach-star/generate-questions')) { questions.push(route); return; }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 501, json: { success: false, error: 'Syntetyczny endpoint audytowy.' } });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text())
        .replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '')
        .replace('</head>', '<link rel="stylesheet" href="/src/index.css"></head>')
        .replace('<div id="root"></div>', '<main id="audit-preview" style="max-width:1180px;margin:24px auto"></main>');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.apiUrl = '/api';
    clientEnv.backendConfigured = false;
    const react = await import('/node_modules/.vite/deps/react.js');
    const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { StarCoachSection } = await import('/src/features/cockpit/StarCoachSection.tsx');
    const { createEmptyVault } = await import('/src/lib/sampleVault.ts');
    const { setAuthenticatedEntitlements } = await import('/src/store/useEntitlements.ts');
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 30 });
    const createElement = react.createElement ?? react.default.createElement;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('audit-preview'));
    const vault = createEmptyVault('Profil syntetyczny');
    window.__coachAudit = { root, createElement, StarCoachSection, vault };
    root.render(createElement(StarCoachSection, { vault }));
  });
  const answer = page.getByPlaceholder(/Wpisz lub podyktuj odpowiedź/);
  const evaluate = page.getByRole('button', { name: 'Oceń odpowiedź (AI STAR Coach)', exact: true });
  const report = page.getByText('Syntetyczny szkic do sprawdzenia.', { exact: true });
  await page.getByRole('checkbox').check();
  await answer.fill('Obsługiwałem zgłoszenia klientów.');
  await evaluate.click();
  await page.waitForTimeout(100);
  await evaluations[0].fulfill({ json: { success: true, evaluation } });
  await report.waitFor();
  await page.getByRole('checkbox').last().check();
  await answer.fill('Przyjmowałem dostawy w magazynie.');
  assert.equal(await report.count(), 0, 'Zmiana odpowiedzi wycofuje ocenę i potwierdzenie starego szkicu');
  await page.screenshot({ path: 'docs/evidence/star-coach-stale-review-2026-10-03.png', animations: 'disabled' });

  await evaluate.click();
  await page.waitForTimeout(100);
  await answer.fill('Kompletowałem zamówienia w magazynie.');
  await evaluate.click();
  await page.waitForTimeout(100);
  assert.equal(evaluations[2].request().postDataJSON().answer, 'Kompletowałem zamówienia w magazynie.');
  await evaluations[1].fulfill({ json: { success: true, evaluation } });
  await page.waitForTimeout(100);
  assert.equal(await report.count(), 0, 'Spóźniona ocena nie wraca po edycji');
  assert.equal(await page.getByRole('button', { name: 'Analiza w schemacie STAR...', exact: true }).isDisabled(), true, 'Stary finally nie kończy nowej analizy');
  await evaluations[2].fulfill({ json: { success: true, evaluation } });
  await report.waitFor();
  assert.equal(await page.getByRole('checkbox').last().isChecked(), false);
  await page.getByRole('button', { name: /Podaj przykład zadania lub działania/ }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await report.count(), 0, 'Wybór innego pytania wycofuje ocenę');
  await evaluate.click();
  await page.waitForTimeout(100);
  assert.match(evaluations[3].request().postDataJSON().question, /Podaj przykład zadania/);
  await evaluations[3].fulfill({ json: { success: true, evaluation } });
  await report.waitFor();
  await page.getByPlaceholder(/np. Senior Product Designer/).fill('Spawacz');
  assert.equal(await report.count(), 0, 'Zmiana stanowiska unieważnia ocenę');

  const generate = page.getByRole('button', { name: /Generuj.*pytania/i });
  await generate.click();
  await page.waitForTimeout(100);
  await page.getByPlaceholder(/np. Allegro/).fill('Firma testowa');
  await generate.click();
  await page.waitForTimeout(100);
  await questions[0].fulfill({ json: { success: true, questions: [{ id: 'old-question', category: 'competency', question: 'Stare pytanie syntetyczne?', recruiterIntent: 'Próba', suggestedStarTips: 'Próba' }] } });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('Stare pytanie syntetyczne?', { exact: true }).count(), 0);
  await questions[1].fulfill({ json: { success: true, questions: [{ id: 'new-question', category: 'competency', question: 'Nowe pytanie syntetyczne?', recruiterIntent: 'Próba', suggestedStarTips: 'Próba' }] } });
  await page.getByText('Nowe pytanie syntetyczne?', { exact: true }).first().waitFor();
  await evaluate.click();
  await page.waitForTimeout(100);
  await page.getByRole('checkbox').first().uncheck();
  await evaluations[4].fulfill({ json: { success: true, evaluation } });
  await page.waitForTimeout(100);
  assert.equal(await report.count(), 0, 'Cofnięta zgoda unieważnia oczekujący wynik');
  await page.evaluate(() => {
    const { root, createElement, StarCoachSection, vault } = window.__coachAudit;
    root.render(createElement(StarCoachSection, { vault: { ...vault, updatedAt: '2026-10-03T12:00:00.000Z' } }));
  });
  assert.equal(await answer.inputValue(), 'Kompletowałem zamówienia w magazynie.', 'Zapis bez zmiany kontekstu nie resetuje ćwiczenia');
  await page.evaluate(() => {
    const { root, createElement, StarCoachSection, vault } = window.__coachAudit;
    root.render(createElement(StarCoachSection, { vault: { ...vault, personalInfo: { ...vault.personalInfo, title: 'Magazynier' } } }));
  });
  await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
  assert.equal(await answer.inputValue(), '', 'Nowy kontekst profilu rozpoczyna własne ćwiczenie');
  assert.equal(await page.getByRole('checkbox').isChecked(), false);

  await page.evaluate(async () => {
    const { root, createElement, vault } = window.__coachAudit;
    const { clientEnv } = await import('/src/lib/clientEnv.ts');
    clientEnv.supabaseUrl = null;
    clientEnv.supabaseAnonKey = null;
    const { AuthProvider, useAuth } = await import('/src/context/AuthContext.tsx');
    const { InterviewCockpitView } = await import('/src/features/cockpit/InterviewCockpitView.tsx');
    function ProfileProbe() {
      const auth = useAuth();
      window.__coachProfile = auth;
      return createElement(InterviewCockpitView, { vault: auth.userVault ?? vault });
    }
    root.render(createElement(AuthProvider, null, createElement(ProfileProbe)));
  });
  await page.waitForFunction(() => Boolean(window.__coachProfile));
  await page.evaluate(async () => {
    window.__coachProfile.signInLocally('Profil A syntetyczny', 'a@example.invalid');
    const { setAuthenticatedEntitlements } = await import('/src/store/useEntitlements.ts');
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 30 });
  });
  await page.getByRole('tab', { name: '2. Trener STAR (AI Coach)', exact: true }).click();
  await page.getByRole('checkbox').check();
  await answer.fill('Odpowiedź wyłącznie profilu A.');
  await evaluate.click();
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__coachProfile.signInLocally('Profil B syntetyczny', 'b@example.invalid'));
  await answer.waitFor();
  assert.equal(await answer.inputValue(), '', 'Nowy profil nie dziedziczy odpowiedzi');
  assert.equal(await page.getByRole('checkbox').isChecked(), false, 'Nowy profil wymaga własnej zgody');
  await evaluations[5].fulfill({ json: { success: true, evaluation: { ...evaluation, exemplaryResponse: 'SZKIC_PROFILU_A' } } });
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('SZKIC_PROFILU_A', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: edycja wycofuje ocenę i fakty; stare odpowiedzi i finally nie zmieniają nowej analizy; pytania zależą od aktualnych kryteriów; cofnięcie zgody odrzuca wynik; rzeczywisty cockpit izoluje profile A/B.');
} finally {
  await browser.close();
}
