import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/error-buffer-sanitize-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const [{ createErrorReporter }, { parseClientErrorBuffer }, storage] = await Promise.all([
      import('/src/lib/errorReporter.ts'),
      import('/src/lib/clientErrorBuffer.ts'),
      import('/src/lib/storage.ts'),
    ]);
    const key = storage.StorageKeys.errorReportBuffer;
    const valid = {
      fingerprint: 'bbbbbbbbbbbbbbbb', kind: 'ui-crash', surface: 'ui-crash:Boundary',
      message: 'synthetic failure', occurredAt: '1970-01-01T00:00:00.000Z',
    };
    const malformed = [valid, null, { ...valid, userEmail: 'private@example.test' }];
    storage.writeJson(key, malformed);
    const parsed = parseClientErrorBuffer(storage.readJson(key, []), 50);
    const sent = [];
    const reporter = createErrorReporter({
      loadBuffered: () => storage.readJson(key, []),
      persistBuffered: (events) => storage.writeJson(key, events),
      sendBatch: async (payload) => { sent.push(payload); return true; },
    });
    const pendingBeforeFlush = reporter.pendingCount();
    const repairedBuffer = storage.readJson(key, []);
    await reporter.flush();
    const pendingAfterFlush = reporter.pendingCount();
    document.body.innerHTML = `
      <main style="font-family:system-ui;max-width:720px;margin:100px auto;padding:36px;border:1px solid #d0d5dd;border-radius:20px;background:#fff;color:#101828">
        <p style="color:#1570ef;font-weight:700">KIERIVO / QA</p>
        <h1>Client error queue</h1>
        <p>Valid events recovered: <strong>${parsed.events.length}</strong></p>
        <p>Malformed or unsupported events discarded: <strong>${parsed.invalidCount}</strong></p>
        <p>Stored after sanitizing: <strong>${repairedBuffer.length}</strong></p>
        <p>Events delivered: <strong>${sent[0]?.events.length ?? 0}</strong></p>
        <p>Pending after flush: <strong>${pendingAfterFlush}</strong></p>
      </main>`;
    return { validCount: parsed.events.length, invalidCount: parsed.invalidCount, pendingBeforeFlush, repairedBuffer, sent, pendingAfterFlush };
  });

  assert.equal(result.validCount, 1);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.pendingBeforeFlush, 1);
  assert.equal(result.repairedBuffer.length, 1);
  assert.equal(result.sent[0].events.length, 1);
  assert.equal(result.pendingAfterFlush, 0);
  assert.deepEqual(pageErrors, []);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`The reporter discarded two invalid rows, delivered the valid row, and cleared its queue. Screenshot: ${OUTPUT}`);
} finally {
  await browser.close();
}
