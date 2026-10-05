import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/pipeline-malformed-storage-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const outcome = await page.evaluate(async () => {
    const [react, reactDom, { ApplicationTracker }, { AuthProvider }, { createEmptyVault }, storage, applicationStore] =
      await Promise.all([
        import('/node_modules/.vite/deps/react.js'),
        import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/features/tracker/ApplicationTracker.tsx'),
        import('/src/context/AuthContext.tsx'),
        import('/src/lib/sampleVault.ts'),
        import('/src/lib/storage.ts'),
        import('/src/store/useApplications.ts'),
      ]);
    const createElement = react.createElement ?? react.default?.createElement;
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const profileId = 'synthetic-pipeline-profile';
    const valid = {
      id: 'valid-application', company: 'Przykładowa firma', position: 'Support Engineer',
      salary: '', date: '2026-10-02', status: 'Wysłana',
    };
    const malformed = { ...valid, id: 'invalid-status', status: 'Prawie oferta' };
    const malformedShape = { ...valid, id: 'invalid-company', company: null };
    storage.writeJson(storage.StorageKeys.profile, { id: profileId, name: 'Profil syntetyczny' });
    storage.writeJson(storage.applicationsKeyFor(profileId), [valid, malformed, malformedShape, null]);
    document.body.innerHTML = '<main id="audit-pipeline" style="max-width: 1240px; margin: 24px auto; padding: 20px"></main>';
    const vault = createEmptyVault('Profil syntetyczny', '');
    createRoot(document.getElementById('audit-pipeline')).render(
      createElement(AuthProvider, null,
        createElement(ApplicationTracker, { vault }),
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, 150));
    const loaded = applicationStore.loadApplicationsFor(profileId);
    applicationStore.saveApplicationsFor(profileId, loaded);
    const persistedAfterSave = storage.readJson(storage.applicationsKeyFor(profileId), []);
    return {
      loadedIds: loaded.map((entry) => entry.id),
      persistedMalformedCount: persistedAfterSave.filter((entry) =>
        entry?.id === 'invalid-status' || entry?.id === 'invalid-company' || entry === null,
      ).length,
    };
  });

  const panel = page.locator('#audit-pipeline');
  await panel.getByText('Część zapisanej historii wymaga sprawdzenia', { exact: true }).waitFor({ state: 'visible' });
  assert.deepEqual(outcome.loadedIds, ['valid-application']);
  assert.equal(outcome.persistedMalformedCount, 3, 'kolejny zapis nie może nadpisać odrzuconych surowych rekordów');
  assert.equal(await panel.getByText('invalid-status', { exact: true }).count(), 0);
  assert.equal(await panel.getByText('Przykładowa firma', { exact: true }).count(), 1);
  assert.deepEqual(pageErrors, [], `Błędy strony: ${pageErrors.join('; ')}`);
  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: Pipeline pokazuje poprawny wpis, pomija wadliwe rekordy i zachowuje je przy zapisie. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
