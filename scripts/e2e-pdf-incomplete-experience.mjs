import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4186';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(15_000);
const errors = [];
let downloads = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('download', () => downloads++);
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    // Syntetyczny kontekst UI; właściwa autoryzacja jest badana osobno w D04.
    if (url.pathname === '/src/context/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'export const useOptionalAuth = () => ({ mode: "cloud", session: { access_token: "synthetic" } });' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '');
      return route.fulfill({ response, body: html });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const [React, dom, { CVExportModal }, { ToastHost }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/ui/CVExportModal.tsx'), import('/src/components/ui/ToastHost.tsx'), import('/src/lib/sampleVault.ts'),
    ]);
    const vault = createEmptyVault('Profil syntetyczny', 'test@example.invalid');
    vault.history = [{ id: 'partial', company: 'PartWork', role: '', location: '', startDate: '', endDate: '', isCurrent: false, highlights: [] }];
    window.__partialVault = vault;
    window.__partialOriginal = JSON.stringify(vault);
    window.__printCalls = 0;
    window.print = () => { window.__printCalls++; };
    const e = React.createElement ?? React.default.createElement;
    document.body.innerHTML = '<main id="pdf-preflight"></main>';
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('pdf-preflight')).render(e('div', null,
      e(CVExportModal, { isOpen: true, onClose() {}, vault }), e(ToastHost)));
  });
  const [response] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === '/api/cv/export-pdf' && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Pobierz PDF ATS Dual-Layer', exact: true }).click(),
  ]);
  assert.equal(response.status(), 400);
  await page.getByText('Nieprawidłowe dane CV', { exact: true }).waitFor();
  await page.getByText(/Niekompletny wpis doświadczenia nr 1/).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(window.__partialVault) === window.__partialOriginal), true);
  assert.equal(downloads, 0);
  await page.getByRole('button', { name: 'Drukuj CV', exact: true }).click();
  await page.getByRole('button', { name: 'Uruchom drukowanie CV', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__printCalls), 0, 'Niepełny wpis nie może ominąć preflight przez druk');
  for (const section of ['education', 'projects']) {
    // Jawna zmiana syntetycznego źródła pozwala sprawdzić obie ścieżki tego
    // samego modalu, bez podstawiania odpowiedzi API ani renderera.
    await page.evaluate(section => {
      const vault = window.__partialVault;
      vault.history = [];
      vault.education = section === 'education'
        ? [{ id: 'draft', institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '' }] : [];
      vault.projects = section === 'projects'
        ? [{ id: 'draft', name: '', role: 'Autor', description: '', techStack: [] }] : [];
      window.__partialOriginal = JSON.stringify(vault);
    }, section);
    await page.getByRole('button', { name: 'Uruchom drukowanie CV', exact: true }).click();
    const message = section === 'education' ? /Niekompletny wpis edukacji/ : /Niekompletny wpis projektu/;
    await page.getByText(message).last().waitFor();
    assert.equal(await page.evaluate(() => window.__printCalls), 0);
    await page.getByRole('button', { name: 'Pobierz PDF ATS / Dual-Layer', exact: true }).click();
    const [rejected] = await Promise.all([
      page.waitForResponse(res => new URL(res.url()).pathname === '/api/cv/export-pdf' && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Pobierz PDF ATS Dual-Layer', exact: true }).click(),
    ]);
    assert.equal(rejected.status(), 400);
    assert.match((await rejected.json()).error, message);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__partialVault) === window.__partialOriginal), true);
    assert.equal(downloads, 0);
    await page.getByRole('button', { name: 'Drukuj CV', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/pdf-incomplete-experience.png', fullPage: true });
  console.log('PASS: rzeczywisty modal i API odrzucają półpusty wpis, pokazują przyczynę, nie pobierają PDF i nie zmieniają faktów.');
} catch (error) {
  console.error(errors, await page.locator('body').innerText());
  throw error;
} finally { await browser.close(); }
