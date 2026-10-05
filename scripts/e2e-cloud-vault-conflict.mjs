/**
 * E2E lokalny dla wyboru pełnego snapshotu przy konflikcie Vaultu.
 * Sesja i odpowiedzi Supabase są syntetyczne; test nie łączy się z backendem.
 */
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OWNER_ID = 'synthetic-conflict-owner';
const REMOTE_UPDATED_AT = '2026-10-02T08:00:00.000Z';
const SCREENSHOT = 'docs/evidence/cloud-vault-conflict-2026-10-02.png';

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

function vault(marker, title) {
  return {
    version: '1.0.0',
    updatedAt: REMOTE_UPDATED_AT,
    profiler: {
      flags: [], experienceLevel: 'MID',
      location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
      languages: [],
    },
    personalInfo: {
      fullName: 'Marek Nowak', email: 'marek.nowak@example.invalid', phone: '', location: '',
      title, summary: `Snapshot ${marker}.`,
    },
    skillsMatrix: { hardSkills: [marker], softSkills: [], toolsAndTech: [], certifications: [] },
    history: [{
      id: marker,
      company: `Firma ${marker}`,
      role: `Rola ${marker}`,
      location: '',
      startDate: '2024-01',
      endDate: '',
    }],
    education: [], projects: [],
  };
}

const localVault = vault('LOCAL-ONLY', 'Tytuł lokalny');
const remoteVault = vault('CLOUD-ONLY', 'Tytuł z chmury');
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
      id: OWNER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'marek.nowak@example.invalid',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { display_name: 'Marek Nowak' },
      created_at: '2026-09-01T10:00:00.000Z',
    }),
  });
});

await page.route('https://synthetic-project.supabase.co/rest/v1/vaults**', async (route) => {
  if (route.request().method() === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: remoteVault, updated_at: REMOTE_UPDATED_AT }),
    });
    return;
  }
  if (route.request().method() === 'PATCH') {
    const payload = route.request().postDataJSON();
    writes.push(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ updated_at: '2026-10-02T08:05:00.000Z' }),
    });
    return;
  }
  await route.fulfill({ status: 405, body: 'Method not allowed in synthetic test.' });
});

await page.addInitScript(({ ownerId, localSnapshot, remoteUpdatedAt }) => {
  const fnv1a = (input) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  const envelope = (value) => {
    const data = JSON.stringify(value);
    return JSON.stringify({ cvel: 2, crc: fnv1a(data), data });
  };
  localStorage.setItem('cvelocity:profile', envelope({
    id: ownerId, name: 'Marek Nowak', email: 'marek.nowak@example.invalid', type: 'local',
    createdAt: '2026-09-01T10:00:00.000Z',
  }));
  localStorage.setItem(`cvelocity:cloud-vault-outbox:${ownerId}`, envelope({
    ownerId,
    revision: 1,
    queuedAt: '2026-10-02T08:01:00.000Z',
    baseUpdatedAt: '2026-10-02T07:00:00.000Z',
    conflict: true,
    vault: localSnapshot,
  }));
  localStorage.setItem(`cvelocity:cloud-vault-revision:${ownerId}`, envelope(remoteUpdatedAt));
  localStorage.setItem('sb-synthetic-project-auth-token', JSON.stringify({
    access_token: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJzeW50aGV0aWMtY29uZmxpY3Qtb3duZXIiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjQxMDI0NDQ4MDB9.synthetic',
    token_type: 'bearer',
    expires_in: 31536000,
    expires_at: 4102444800,
    refresh_token: 'synthetic-refresh-token',
    user: {
      id: ownerId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'marek.nowak@example.invalid',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { display_name: 'Marek Nowak' },
      created_at: '2026-09-01T10:00:00.000Z',
    },
  }));
}, {
  ownerId: OWNER_ID,
  localSnapshot: localVault,
  remoteUpdatedAt: REMOTE_UPDATED_AT,
});

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog', { name: 'Konflikt dwóch wersji CV' });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });
  await dialog.getByText('Lokalna wersja', { exact: true }).waitFor({ state: 'visible' });
  await dialog.getByText('Wersja z chmury', { exact: true }).waitFor({ state: 'visible' });
  if ((await dialog.getByText('1 doświadczeń · 0 etapów edukacji · 0 projektów', { exact: true }).count()) !== 2) {
    throw new Error('Modal nie porównał liczby sekcji z obu pełnych snapshotów.');
  }
  await page.waitForTimeout(600); // Daj animacji wejścia dialogu zakończyć się przed dowodem ekranowym.
  await dialog.getByRole('button', { name: 'Zachowaj lokalną wersję', exact: true }).waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Zachowaj wersję z chmury', exact: true }).waitFor({ state: 'visible' });
  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: SCREENSHOT, fullPage: true });

  await dialog.getByRole('button', { name: 'Zachowaj lokalną wersję', exact: true }).click();
  await page.getByText('Konflikt rozstrzygnięty', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction((key) => localStorage.getItem(key) === null, `cvelocity:cloud-vault-outbox:${OWNER_ID}`);

  if (writes.length !== 1) throw new Error(`Oczekiwano jednego zapisu CAS, otrzymano ${writes.length}.`);
  if (writes[0]?.data?.personalInfo?.title !== 'Tytuł lokalny') {
    throw new Error('Wybrany lokalny pełny snapshot nie został wysłany do zapisu.');
  }
  if (JSON.stringify(writes[0]?.data).includes('CLOUD-ONLY')) {
    throw new Error('Wybór pełnego snapshotu nie może automatycznie łączyć danych z drugą wersją.');
  }
  if (errors.length) throw new Error(`Błędy przeglądarki: ${errors.join('; ')}`);

  console.log(`PASS: modal pokazał obie wersje, zapisano wyłącznie wybrany snapshot; zrzut: ${SCREENSHOT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`URL: ${page.url()}`);
  console.error(`Widok: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 2_000)}`);
  console.error(`Klucze Supabase: ${JSON.stringify(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('auth-token'))).catch(() => []))}`);
  if (errors.length) console.error(`Błędy strony: ${errors.join('; ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
