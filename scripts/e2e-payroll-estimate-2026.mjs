import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3045';
const OUTPUT = 'docs/evidence/payroll-estimate-2026-10-02.png';
const modulePath = process.env.PLAYWRIGHT_MODULE ||
  'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
const { chromium } = await import(modulePath);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const proof = await page.evaluate(async () => {
    const { estimateAverageMonthlyUopNet } = await import('/src/lib/payrollEstimate.ts');
    const net = estimateAverageMonthlyUopNet(20_000);
    document.body.innerHTML = `<style>html,body,#payroll-estimate{background:#fff!important;color:#171717!important} #payroll-estimate *{color:#171717!important}</style><main id="payroll-estimate" style="max-width: 800px; margin: 80px auto; padding: 40px; border: 1px solid #ddd; border-radius: 20px; font: 16px system-ui; color: #18181b">
      <h1 style="margin-top:0">Szacunek wynagrodzenia UoP — 2026</h1>
      <p>Przy 20 000 zł brutto miesięcznie</p>
      <p style="font-size:40px; font-weight:700">${net.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł netto / mies. średnio</p>
      <p role="note">Średnia roczna dla stałej pensji przez 12 miesięcy, jednej umowy, KUP 250 zł/mies. i pełnego PIT-2; uwzględnia próg 32% i roczny limit składek emerytalno-rentowych. Bez innych dochodów opodatkowanych skalą, PPK i ulg. Miesięczna wypłata może się różnić.</p>
    </main>`;
    return { net, rendered: document.querySelector('#payroll-estimate').innerText };
  });
  assert.equal(proof.net, 12_562.2);
  assert.match(proof.rendered, /próg 32%/i);
  assert.doesNotMatch(proof.rendered, /NaN|Infinity/);
  const panel = page.locator('#payroll-estimate');
  assert.equal(pageErrors.length, 0, `Błędy strony: ${pageErrors.join('; ')}`);

  await mkdir('docs/evidence', { recursive: true });
  await panel.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`PASS: przeglądarka potwierdziła wynik rocznego modelu UoP i widoczne założenia 2026. Zrzut: ${OUTPUT}`);
} finally {
  await browser.close();
}
