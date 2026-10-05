/**
 * E2E lokalny: błędny Vault bieżącego schematu nie trafia do pustej migracji ani zapisu.
 * Sesja i odpowiedzi Supabase są syntetyczne; test nie łączy się z backendem.
 */
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OWNER_ID = 'synthetic-malformed-vault-owner';
const SCREENSHOT = 'docs/evidence/cloud-vault-malformed-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
  process.exit(2);
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function envelope(value) {
  const data = JSON.stringify(value);
  return JSON.stringify({ cvel: 2, crc: fnv1a(data), data });
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [];
const writes = [];
page.on('pageerror', (error) => {
  if (!/WebSocket closed without opened/i.test(String(error))) errors.push(String(error));
});

await page.route('https://synthetic-project.supabase.co/auth/v1/user**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: OWNER_ID, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { display_name: 'Profil testowy' }, created_at: '2026-09-01T10:00:00.000Z',
    }),
  });
});

await page.route('https://synthetic-project.supabase.co/rest/v1/vaults**', async (route) => {
  if (route.request().method() === 'GET') {
    const malformed = {
      schemaVersion: 1,
      version: '1.0.0',
      updatedAt: '2026-10-02T08:00:00.000Z',
      profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
      personalInfo: { fullName: 'Profil testowy', email: 'test@example.invalid', phone: '', location: '', title: '', summary: '' },
      skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
      history: [{ id: 'broken-history-row' }],
      education: [], projects: [], claims: [],
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: malformed, updated_at: malformed.updatedAt }) });
    return;
  }
  if (route.request().method() === 'PATCH' || route.request().method() === 'POST') {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated_at: '2026-10-02T08:05:00.000Z' }) });
    return;
  }
  await route.fulfill({ status: 405, body: 'Method not allowed in synthetic test.' });
});

await page.addInitScript(({ ownerId }) => {
  const fnv = (input) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  const wrap = (value) => { const data = JSON.stringify(value); return JSON.stringify({ cvel: 2, crc: fnv(data), data }); };
  localStorage.setItem('cvelocity:profile', wrap({ id: ownerId, name: 'Profil testowy', email: 'test@example.invalid', type: 'local', createdAt: '2026-09-01T10:00:00.000Z' }));
  localStorage.setItem(`cvelocity:vault:${ownerId}`, wrap({
    schemaVersion: 1, version: '1.0.0', updatedAt: '2026-10-02T07:00:00.000Z',
    profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
    personalInfo: { fullName: 'Profil testowy', email: 'test@example.invalid', phone: '', location: '', title: '', summary: '' },
    skillsMatrix: { hardSkills: ['LOKALNY-SNAPSHOT'], softSkills: [], toolsAndTech: [], certifications: [] }, history: [], education: [], projects: [], claims: [],
  }));
  localStorage.setItem('sb-synthetic-project-auth-token', JSON.stringify({
    access_token: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJzeW50aGV0aWMtbWFsZm9ybWVkLXZhdWx0LW93bmVyIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo0MTAyNDQ0ODAwfQ.synthetic',
    token_type: 'bearer', expires_in: 31536000, expires_at: 4102444800, refresh_token: 'synthetic-refresh-token',
    user: { id: ownerId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'Profil testowy' }, created_at: '2026-09-01T10:00:00.000Z' },
  }));
}, { ownerId: OWNER_ID });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByText('Nie udało się pobrać CV z konta', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByText('Odśwież stronę, żeby spróbować ponownie.', { exact: false }).waitFor({ state: 'visible' });
  await page.locator('[data-vault-sync-status="pending"], [data-vault-sync-status="unverified"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  if (await page.locator('[data-vault-sync-status="cloud"]').count()) {
    throw new Error('Ekran fałszywie potwierdził zapis w chmurze po odrzuceniu snapshotu.');
  }
  await page.waitForTimeout(500);
  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: SCREENSHOT, fullPage: true });

  const localCopyPreserved = await page.evaluate(() => Object.keys(localStorage).some((key) => {
    if (!key.includes('vault')) return false;
    return localStorage.getItem(key)?.includes('LOKALNY-SNAPSHOT') ?? false;
  }));
  if (!localCopyPreserved) throw new Error('Lokalny snapshot został usunięty lub nadpisany.');
  if (writes.length !== 0) throw new Error(`Błędny Vault wywołał zapis (${writes.length}).`);
  if (errors.length) throw new Error(`Błędy przeglądarki: ${errors.join('; ')}`);
  console.log(`PASS: błędny snapshot zatrzymał bootstrap, lokalne CV zostało zachowane; zrzut: ${SCREENSHOT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`URL: ${page.url()}`);
  console.error(`Widok: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 2_000)}`);
  if (errors.length) console.error(`Błędy strony: ${errors.join('; ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
