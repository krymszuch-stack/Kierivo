import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3004';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
let downloads = 0;
let exports = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('download', () => downloads++);
page.on('request', request => { if (new URL(request.url()).pathname === '/api/cv/export-pdf' && request.method() === 'POST') exports++; });
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE_URL) return route.abort();
    // Wyłącznie syntetyczny kontekst modalu; autoryzację sprawdza osobny D04.
    if (url.pathname === '/src/context/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'export const useOptionalAuth = () => ({ mode: "cloud", session: { access_token: "synthetic", user: { id: window.__pdfOwner || "test-owner" } } });' });
    if (url.pathname === '/') {
      const response = await route.fetch();
      return route.fulfill({ response, body: (await response.text()).replace(/<script\b[^>]*\bsrc=["']\/src\/main\.tsx(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gu, '') });
    }
    return route.continue();
  });
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    const [React, dom, { CVExportModal }, { createLongCvVault }, { ToastHost }, { createEmptyVault }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/ui/CVExportModal.tsx'), import('/scripts/fixtures/longCvVault.ts'), import('/src/components/ui/ToastHost.tsx'), import('/src/lib/sampleVault.ts'), import('/src/index.css'),
    ]);
    // Ta sama próbka co w istniejącym audit-pdf-long-cv.
    const vault = createLongCvVault();
    window.__pdfSource = JSON.stringify(vault);
    const e = React.createElement ?? React.default.createElement;
    const useState = React.useState ?? React.default.useState;
    function Harness() {
      const [source, setSource] = useState(vault);
      const [open, setOpen] = useState(true);
      const [, setOwnerTick] = useState(0);
      window.__openPdf = () => setOpen(true);
      window.__replacePdfSource = () => setSource({ ...vault, personalInfo: { ...vault.personalInfo, fullName: 'Inny Profil' } });
      window.__replacePdfOwner = () => { window.__pdfOwner = 'other-owner'; setOwnerTick(tick => tick + 1); };
      window.__useOwnerBSource = () => {
        const b = createEmptyVault('OWNER B', 'owner-b@example.invalid');
        b.personalInfo.title = 'Serwisant B';
        b.personalInfo.summary = 'ONLY_B_MARKER — syntetyczny profil serwisanta.';
        b.skillsMatrix.hardSkills = ['SQL'];
        b.history = [{ id: 'b', company: 'Firma B', role: 'Serwisant B', location: '', startDate: '2020-01', endDate: '2024-01', isCurrent: false,
          highlights: [{ id: 'b-hl', text: 'ONLY_B_MARKER', action: '', target: '', tool: '', metric: '', keywords: [] }] }];
        setSource(b);
      };
      return e('div', null, e(CVExportModal, { isOpen: open, onClose() { setOpen(false); }, vault: source, initialTheme: 'classic', initialLayout: 'sidebar', initialTargetPages: 2 }), e(ToastHost));
    }
    document.body.innerHTML = '<main id="pdf-proof"></main>';
    (dom.createRoot ?? dom.default.createRoot)(document.getElementById('pdf-proof')).render(e(Harness));
  });
  const [response] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === '/api/cv/export-pdf' && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Przygotuj podgląd PDF ATS Dual-Layer', exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  const result = await response.json();
  const bytes = Buffer.from(result.pdf, 'base64');
  const expectedHash = createHash('sha256').update(bytes).digest('hex');
  const preview = page.getByTestId('prepared-pdf-preview');
  assert.ok(result.contentWarnings.length > 0, 'istniejąca długa próbka musi zachować jawne ostrzeżenia o skróceniu');
  await page.getByText('Treść CV została skrócona', { exact: true }).waitFor();
  assert.equal(await preview.count(), 1, 'ostrzeżeniom musi towarzyszyć podgląd rzeczywistego pliku');
  await preview.getByRole('status').filter({ hasText: /Podgląd PDF gotowy/ }).waitFor({ timeout: 60_000 });
  assert.equal(downloads, 0, 'sam podgląd nie może pobrać pliku przed decyzją użytkownika');
  assert.equal(await preview.getAttribute('data-pdf-sha256'), expectedHash);
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await task.promise;
  assert.equal(pdf.numPages, 2, 'reprodukcja musi obejmować rzeczywisty wielostronicowy dokument');
  assert.equal(await preview.locator('canvas').count(), pdf.numPages);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/pdf-artifact-preview.png', fullPage: true });
  await preview.locator('canvas').nth(1).screenshot({ path: 'docs/evidence/pdf-artifact-preview-page-2.png' });
  const label = result.contentWarnings?.length ? 'Pobierz CV po potwierdzeniu skrócenia treści' : 'Pobierz pokazany plik PDF';
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: label, exact: true }).click(),
  ]);
  const file = await download.path();
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expectedHash, 'pobrany PDF musi być identyczny z wyrenderowanym');
  assert.equal(downloads, 1);
  assert.equal(exports, 1, 'potwierdzenie pobiera gotowy plik bez ponownego wywołania renderera');
  await task.destroy();
  await page.getByRole('button', { name: 'Zamknij okno', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.evaluate(() => window.__openPdf());
  await page.getByRole('button', { name: 'Przygotuj podgląd PDF ATS Dual-Layer', exact: true }).click();
  await preview.getByRole('status').filter({ hasText: /Podgląd PDF gotowy/ }).waitFor({ timeout: 60_000 });
  // Nowy profil nie może odziedziczyć przygotowanego artefaktu poprzedniego źródła.
  await page.evaluate(() => window.__replacePdfSource());
  await preview.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0);
  assert.equal(downloads, 1, 'zmiana źródła nie pobiera przygotowanego wcześniej dokumentu');
  await page.getByRole('button', { name: 'Przygotuj podgląd PDF ATS Dual-Layer', exact: true }).click();
  await preview.getByRole('status').filter({ hasText: /Podgląd PDF gotowy/ }).waitFor({ timeout: 60_000 });
  await page.evaluate(() => window.__replacePdfOwner());
  await preview.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0, 'nowe konto nie może pobrać gotowego PDF poprzedniego konta');
  assert.equal(downloads, 1);
  // Sprawdzamy również faktyczne bajty następnego eksportu B, nie tylko
  // zniknięcie panelu lub obecność właściwego właściciela w DOM.
  await page.evaluate(() => window.__useOwnerBSource());
  await page.getByRole('button', { name: 'Przygotuj podgląd PDF ATS Dual-Layer', exact: true }).click();
  await preview.getByRole('status').filter({ hasText: /Podgląd PDF gotowy/ }).waitFor({ timeout: 60_000 });
  const ownerBPreviewHash = await preview.getAttribute('data-pdf-sha256');
  const [ownerBDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz pokazany plik PDF', exact: true }).click(),
  ]);
  const ownerBBytes = await readFile(await ownerBDownload.path());
  assert.equal(createHash('sha256').update(ownerBBytes).digest('hex'), ownerBPreviewHash);
  const ownerBTask = getDocument({ data: new Uint8Array(ownerBBytes), useSystemFonts: true });
  const ownerBPdf = await ownerBTask.promise;
  const ownerBPages = await Promise.all(Array.from({ length: ownerBPdf.numPages }, async (_, index) => {
    const content = await (await ownerBPdf.getPage(index + 1)).getTextContent();
    return content.items.map(item => 'str' in item ? item.str : '').join(' ');
  }));
  const ownerBText = ownerBPages.join('\n');
  assert.ok(ownerBText.includes('ONLY_B_MARKER'));
  const ownerAName = JSON.parse(await page.evaluate(() => window.__pdfSource)).personalInfo.fullName;
  assert.ok(!ownerBText.replace(/\s+/g, '').includes(ownerAName.replace(/\s+/g, '')), 'pobrany PDF B nie może zawierać poprzedniego właściciela A');
  assert.ok(!JSON.stringify(await ownerBPdf.getMetadata()).includes(ownerAName));
  assert.equal(await ownerBPdf.getAttachments(), null);
  await ownerBTask.destroy();
  assert.deepEqual(errors, []);
  console.log('PASS: dwie strony podglądu pochodzą z tego samego PDF co pobranie (SHA-256), pobranie wymaga decyzji bez ponownego renderowania, zmiana profilu lub konta usuwa artefakt; pobrany PDF właściciela B zawiera B, bez A w tekście/metadanych i bez załączników.');
} catch (error) {
  console.error(errors, (await page.locator('body').innerText()).slice(-2200));
  throw error;
} finally { await browser.close(); }
