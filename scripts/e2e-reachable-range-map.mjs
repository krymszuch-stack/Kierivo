/** E2E komponentu mapy: geometrię Azure pokazujemy z rzeczywistych punktów, bez wymyślonej pinezki. */
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SCREENSHOT = 'docs/evidence/reachable-range-map-2026-10-02.png';

let chromium;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE ||
    'file:///C:/Users/Adrian/AppData/Local/npm-cache/_npx/d71ea5ed3eabc9b3/node_modules/playwright/index.mjs';
  ({ chromium } = await import(modulePath));
} catch {
  console.error('Brak Playwright. Ustaw PLAYWRIGHT_MODULE na lokalny moduł Playwright.');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH ||
    'C:/Users/Adrian/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));

const center = { lat: 52.2297, lon: 21.0122, name: 'Warszawa' };
const rangeData = {
  source: 'azure_maps',
  center,
  timeBudgetMinutes: 45,
  boundaryPoints: [
    { lat: 52.18, lon: 20.89 },
    { lat: 52.28, lon: 20.83 },
    { lat: 52.39, lon: 20.98 },
    { lat: 52.34, lon: 21.17 },
    { lat: 52.20, lon: 21.15 },
  ],
  approxAreaKm2: 100,
};
const routeData = {
  source: 'azure_maps',
  trafficDataAvailable: true,
  roadDistanceKm: 12.4,
  freeFlowMinutes: 18,
  trafficMinutes: 24,
  trafficDelayMinutes: 6,
  energyConsumption: null,
  points: [center, { lat: 52.25, lon: 20.98 }, { lat: 52.30, lon: 20.94 }],
};

async function mountMap(props) {
  await page.evaluate(async (mapProps) => {
    const React = await import('/node_modules/.vite/deps/react.js');
    const createElement = React.createElement ?? React.default?.createElement;
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { ReachableRangeMap } = await import('/src/components/mobility/ReachableRangeMap.tsx');
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot;
    if (typeof createRoot !== 'function') throw new Error(`Brak createRoot: ${Object.keys(ReactDOM).join(', ')}`);
    let host = document.getElementById('mobility-proof');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mobility-proof';
      Object.assign(host.style, {
        position: 'fixed', left: '280px', top: '140px', width: '900px', zIndex: '10000',
        padding: '12px', borderRadius: '18px', background: 'var(--color-surface)',
      });
      document.body.append(host);
      host.__root = createRoot(host);
    }
    host.__root.render(createElement(ReachableRangeMap, mapProps));
  }, props);
  await page.locator('#mobility-proof svg[viewBox="0 0 480 280"]').waitFor({ state: 'visible' });
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const common = {
    rangeData,
    originName: 'Warszawa',
    destinationName: 'Pruszków',
    timeBudget: 45,
    isPeakTraffic: true,
    engineType: 'combustion',
  };
  await mountMap({ ...common, routeData });
  await page.locator('#mobility-proof polyline').waitFor({ state: 'visible' });
  await page.getByText('Pruszków', { exact: true }).last().waitFor({ state: 'visible' });
  mkdirSync('docs/evidence', { recursive: true });
  await page.locator('#mobility-proof').screenshot({ path: SCREENSHOT });

  await mountMap({
    ...common,
    routeData: { ...routeData, source: 'local_deterministic', points: undefined, trafficDataAvailable: false },
  });
  if (await page.locator('#mobility-proof polyline').count()) {
    throw new Error('Estymacja lokalna bez geometrii nie może rysować trasy.');
  }
  if (await page.locator('#mobility-proof svg text').getByText('Pruszków', { exact: true }).count()) {
    throw new Error('Mapa nie może umieszczać pracodawcy bez zwróconych współrzędnych.');
  }
  if (pageErrors.length) throw new Error(`Błędy przeglądarki: ${pageErrors.join('; ')}`);
  console.log(`PASS: trasa Azure używa własnych punktów, estymacja bez geometrii nie rysuje pinezki; zrzut: ${SCREENSHOT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
