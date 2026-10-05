import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3046';
const OUTPUT = 'docs/evidence/local-vault-invalid-storage-2026-10-02.png';
const PROFILE_ID = 'local-synthetic-invalid-vault';
const VAULT_KEY = `cvelocity:vault:${PROFILE_ID}`;
const originalVault = {
  schemaVersion: 1,
  version: '1.0.0',
  updatedAt: '2026-10-02T10:00:00.000Z',
  profiler: {
    flags: [], experienceLevel: 'ENTRY',
    location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
    languages: [],
  },
  personalInfo: {
    fullName: 'Profil syntetyczny', email: '', phone: '', location: '', title: '', summary: '',
  },
  skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
  history: [null],
  education: [],
  projects: [],
  claims: [],
};
const originalJson = JSON.stringify(originalVault);
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(message.text());
});

try {
  await page.addInitScript(({ profileId, vaultKey, vaultJson }) => {
    localStorage.setItem('cvelocity:profile', JSON.stringify({
      schemaVersion: 1, id: profileId, name: 'Profil syntetyczny', createdAt: '2026-10-02T10:00:00.000Z',
    }));
    localStorage.setItem(vaultKey, vaultJson);
  }, { profileId: PROFILE_ID, vaultKey: VAULT_KEY, vaultJson: originalJson });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').getByText('Zapisany profil ma nieprawidłową strukturę.', { exact: false })
    .waitFor({ state: 'visible' });
  await page.waitForTimeout(1400);
  const preserved = await page.evaluate((key) => localStorage.getItem(key), VAULT_KEY);
  assert.equal(preserved, originalJson, 'autosave nie może zastąpić uszkodzonego źródła pustym Vaultem');
  assert.deepEqual(pageErrors, [], `Błędy strony: ${pageErrors.join('; ')}`);
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: uszkodzony Vault jest jawnie oznaczony, a autosave zachował oryginalny zapis. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
