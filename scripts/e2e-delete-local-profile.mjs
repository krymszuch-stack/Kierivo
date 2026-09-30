/** E2E usuwania wyłącznie fikcyjnego profilu w osobnym kontekście przeglądarki. */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const base = process.env.BASE_URL || 'http://localhost:3000';

try {
  await page.goto(base);
  await page.getByRole('button', { name: /Konto/ }).click();
  await page.getByRole('button', { name: 'Utwórz profil lokalny', exact: true }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Profil Syntetyczny');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.getByText('Profil zapisany na tym urządzeniu').waitFor({ timeout: 10000 });
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 10000 });

  // Wymuszamy prawdziwą kopię awaryjną w IndexedDB, żeby test obejmował oba magazyny.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('cvelocity-backup', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put('synthetic', 'cvelocity.synthetic-delete-proof');
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  }));

  await page.screenshot({ path: 'docs/audyt-usuwanie-profilu-przed-2026-09-30.png' });
  await page.locator('button[aria-haspopup="menu"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Usuń profil' }).click();
  await page.getByText('Dane zostały usunięte').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /Konto/ }).waitFor({ timeout: 10000 });

  const remainingKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('cvelocity') || key.startsWith('kierivo'))
  );
  if (remainingKeys.length) {
    throw new Error(`Po usunięciu zostały klucze aplikacji: ${remainingKeys.join(', ')}`);
  }
  const idbValue = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('cvelocity-backup', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readonly');
      const getRequest = tx.objectStore('kv').get('cvelocity.synthetic-delete-proof');
      getRequest.onsuccess = () => { resolve(getRequest.result ?? null); db.close(); };
      getRequest.onerror = () => reject(getRequest.error);
    };
  }));
  if (idbValue !== null) throw new Error('Po usunięciu pozostała kopia awaryjna w IndexedDB.');
  await page.screenshot({ path: 'docs/audyt-usuwanie-profilu-po-2026-09-30.png' });
  console.log('Profil fikcyjny usunięty: widok wrócił do stanu bez konta, brak kluczy aplikacji.');
} finally {
  await context.close();
  await browser.close();
}
