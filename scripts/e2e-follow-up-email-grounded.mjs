import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/follow-up-email-grounded-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const pageErrors = [];
  let sharedQuestionPayload = null;
  let shareRequestCount = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/intel/job', async (route) => {
    sharedQuestionPayload = route.request().postDataJSON();
    shareRequestCount += 1;
    if (shareRequestCount === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Brak usługi' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const [React, ReactDOM, { PostCallDebriefView }, { createInterviewSession }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/loop/PostCallDebriefView.tsx'),
      import('/src/lib/interviewLoopEngine.ts'),
      import('/src/lib/sampleVault.ts'),
    ]);
    const createElement = React.createElement ?? React.default?.createElement;
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    const session = createInterviewSession('Firma testowa', 'Analityk danych');
    session.postCallDebrief = {
      overallRating: 4,
      whatWentWell: '',
      trickyQuestions: [],
      topicsToClarifyInFollowUp: '',
      generatedFollowUpEmail: 'Dzień dobry, dziękuję za dzisiejsze inspirujące spotkanie. Potwierdzam duże zainteresowanie.',
      completedAt: '2026-10-01T10:00:00.000Z',
    };
    session.liveTracker.notes = [{
      id: 'synthetic-note', timestamp: '10:00', stage: 'TECHNICAL',
      text: 'Rozmowa o szczegółach rekrutacji', sentiment: 'NEUTRAL',
    }];
    document.body.innerHTML = '<main id="audit-follow-up-email" style="max-width: 1180px; margin: 24px auto; padding: 20px"></main>';
    createRoot(document.getElementById('audit-follow-up-email')).render(createElement(PostCallDebriefView, {
      profileId: 'synthetic-profile',
      session,
      vault: createEmptyVault(),
      onUpdateSession: (updatedSession) => { window.__updatedDebriefSession = updatedSession; },
      onClose: () => {},
    }));
  });

  const panel = page.locator('#audit-follow-up-email');
  const message = panel.locator('textarea').last();
  await panel.getByText('Wygenerowany e-mail follow-up (Podziękowanie):').waitFor({ state: 'visible' });
  const initial = await message.inputValue();
  assert.doesNotMatch(initial, /dzisiejsz|inspiruj|świetn|duże zainteresowanie|plany zespołu|wrażenie/i);
  await panel.getByText('Wcześniej zapisany szkic — do ręcznego sprawdzenia').click();
  await panel.getByText(/Ten tekst pochodzi ze starszej wersji generatora/).waitFor({ state: 'visible' });
  assert.match(await panel.locator('pre').innerText(), /dzisiejsze inspirujące spotkanie/);
  await panel.getByText('Wcześniej zapisany szkic — do ręcznego sprawdzenia').click();

  await panel.getByPlaceholder('np. szczegółowe wyjaśnienie wdrożenia kolejki zdarzeń...').fill('omówienie zakresu raportów miesięcznych');
  await panel.getByPlaceholder('np. doświadczenie z konfiguracją klastra Kafka...').fill('termin przekazania wyników zadania');
  await panel.getByRole('button', { name: 'Inny wariant' }).click();
  const firstRegenerated = await message.inputValue();
  assert.notEqual(firstRegenerated, initial);
  assert.match(firstRegenerated, /Notatka po rozmowie: omówienie zakresu raportów miesięcznych/);
  assert.match(firstRegenerated, /Proszę o doprecyzowanie kwestii: termin przekazania wyników zadania/);
  assert.doesNotMatch(firstRegenerated, /dzisiejsz|inspiruj|świetn|duże zainteresowanie|plany zespołu|wrażenie/i);

  await panel.getByRole('button', { name: 'Inny wariant' }).click();
  const secondRegenerated = await message.inputValue();
  assert.notEqual(secondRegenerated, firstRegenerated);
  assert.match(secondRegenerated, /termin przekazania wyników zadania/);

  await panel.getByPlaceholder('np. Jak rozwiązywałeś konflikt w zespole?').fill('Jak wygląda wdrożenie do pracy?');
  await panel.getByRole('button', { name: 'Udostępnij pytanie' }).click();
  await panel.getByText(/Nie udało się potwierdzić dodania pytania/).waitFor({ state: 'visible' });
  assert.equal(await panel.getByText('Jak wygląda wdrożenie do pracy?', { exact: true }).count(), 1);
  await panel.getByPlaceholder('np. Jak rozwiązywałeś konflikt w zespole?').fill('Jak wygląda wdrożenie do pracy?');
  await panel.getByRole('button', { name: 'Udostępnij pytanie' }).click();
  await panel.getByText('Serwer potwierdził dodanie pytania do wspólnej bazy.').waitFor({ state: 'visible' });
  assert.deepEqual(sharedQuestionPayload, {
    companyName: 'Firma testowa',
    jobTitle: 'Analityk danych',
    requiredSkills: [],
    interviewQuestions: ['Jak wygląda wdrożenie do pracy?'],
  });
  assert.equal(await panel.getByText('Jak wygląda wdrożenie do pracy?', { exact: true }).count(), 1);
  await panel.getByText('To szkic do sprawdzenia i skopiowania. Kierivo nie wysyła tej wiadomości.').waitFor({ state: 'visible' });
  await panel.getByRole('button', { name: 'Ocena 4 z 5' }).click();
  await panel.getByRole('button', { name: 'Zapisz i Zakończ Sesję' }).click();
  const persistedSession = await page.evaluate(() => window.__updatedDebriefSession);
  assert.equal(persistedSession.postCallDebrief.generatedFollowUpEmailVersion, 1);
  assert.equal(persistedSession.postCallDebrief.generatedFollowUpEmailVariantIndex, 2);
  assert.match(persistedSession.postCallDebrief.legacyGeneratedFollowUpEmail, /dzisiejsze inspirujące spotkanie/);
  assert.match(persistedSession.postCallDebrief.generatedFollowUpEmail, /termin przekazania wyników zadania/);
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: szkic używa tylko wpisanych notatek, a wariant przebudowy się zmienia. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
