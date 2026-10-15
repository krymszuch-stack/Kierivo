import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:net';

// Jeden konsument istniejących regresji. Brak narzędzia lub dowodu nie staje się PASS.
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || 'fast';
if (!['fast', 'release', 'postdeploy'].includes(mode)) throw new Error('Tryb: fast | release | postdeploy');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
const output = resolve(root, process.env.GATE_OUTPUT || `artifacts/${mode}-${sha}`);
mkdirSync(join(output, 'docs/evidence'), { recursive: true });
const report = { schemaVersion: 1, mode, sha, startedAt: new Date().toISOString(), node: process.version, checks: [] };
const node = process.execPath;
const npm = [node, [process.env.npm_execpath || join(process.env.ProgramFiles || '/usr', 'nodejs/node_modules/npm/bin/npm-cli.js')]];
// Wywołania binariów JS omijają różnice npm.cmd / npm na Windows i Linux.
const vitest = join(root, 'node_modules/vitest/vitest.mjs');
const tsx = join(root, 'node_modules/tsx/dist/cli.mjs');
const python = process.env.PYTHON_BIN || (existsSync(join(root, '.venv/Scripts/python.exe')) ? join(root, '.venv/Scripts/python.exe') : 'python3');
const env = { ...process.env, DISABLE_HMR: 'true', PYTHON_BIN: python, PLAYWRIGHT_MODULE: pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href, PLAYWRIGHT_CHROME_PATH: chromium.executablePath() };

function record(id, status, reason, extra = {}) {
  report.checks.push({ id, status, reason, ...extra });
  report.status = report.checks.some(c => c.status === 'FAIL') ? 'FAIL' : report.checks.some(c => c.required !== false && c.status !== 'PASS') ? 'UNKNOWN' : 'PASS';
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`[${status}] ${id}: ${reason}`);
}

async function run(id, command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const logPath = join(output, `${id}.log`);
  const log = createWriteStream(logPath);
  const child = spawn(command, args, { cwd: options.cwd || root, env: { ...env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.pipe(log); child.stderr.pipe(log);
  let spawnError;
  child.on('error', error => { spawnError = error.code || error.message; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeout || 300_000);
  const code = await new Promise(resolveCode => child.on('close', resolveCode));
  clearTimeout(timer);
  await new Promise(done => log.end(done));
  const status = spawnError ? 'UNKNOWN' : code === 0 && !timedOut ? 'PASS' : 'FAIL';
  record(id, status, spawnError || (timedOut ? 'Przekroczony limit czasu' : `exit ${code}`), { command: [command, ...args], startedAt, finishedAt: new Date().toISOString(), log: `${id}.log` });
  return status === 'PASS';
}

async function browserTest(name, baseUrl) {
  return run(`browser-${name}`, node, [join(root, `scripts/e2e-${name}.mjs`)], { cwd: output, env: { BASE_URL: baseUrl }, timeout: 180_000 });
}

async function withServer(production, action, syntheticCloud = false) {
  const probe = createServer();
  await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const baseUrl = `http://127.0.0.1:${port}`;
  const log = createWriteStream(join(output, production ? 'server-built.log' : syntheticCloud ? 'server-synthetic-cloud.log' : 'server-vite.log'));
  const child = spawn(node, production ? [join(root, 'dist/server.mjs')] : [tsx, 'server.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, VITE_SUPABASE_URL: syntheticCloud ? 'https://synthetic-project.supabase.co' : '', VITE_SUPABASE_ANON_KEY: syntheticCloud ? 'synthetic-anon-key' : '', PORT: String(port), NODE_ENV: production ? 'production' : 'development', BACKEND_MODE: production ? 'cloud' : 'local', SUPABASE_URL: 'https://smoke.kierivo.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-only', AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:1', APP_URL: production ? 'https://smoke.kierivo.invalid' : baseUrl, CLIENT_ERRORS_LOCAL_FILE: join(output, 'client-errors.jsonl') },
  });
  child.stdout.pipe(log); child.stderr.pipe(log);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) break;
      try { if ((await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* oczekiwanie na proces */ }
      await new Promise(done => setTimeout(done, 500));
    }
    if (!ready) { record(production ? 'built-server' : 'vite-server', 'FAIL', 'Serwer nie wystartował; zobacz log.'); return; }
    await action(baseUrl);
  } finally {
    child.kill();
    await new Promise(done => child.exitCode !== null ? done() : child.once('close', done));
    log.end();
  }
}

function scanBundle() {
  const visit = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? visit(join(dir, entry.name)) : [join(dir, entry.name)]);
  const hits = visit(join(root, 'dist/client')).filter(file => /service_role|sk_live_|sk_test_|SUPABASE_SERVICE_ROLE|AZURE_OPENAI/.test(readFileSync(file, 'utf8')));
  record('client-secret-patterns', hits.length ? 'FAIL' : 'PASS', hits.length ? `Wykryto wzorzec sekretu w ${hits.length} plikach; treść nie jest logowana.` : 'Brak znanych wzorców sekretów w bundlu klienta. To nie jest pełny skan historii sekretów.');
}

try {
  const dirty = git('status', '--porcelain', '--untracked-files=normal');
  record('source-identity', dirty ? 'UNKNOWN' : 'PASS', dirty ? 'Nieczysty checkout: wynik nie opisuje samego SHA.' : 'Czysty checkout przypisany do SHA.');
  if (mode === 'postdeploy') {
    const baseUrl = process.env.BASE_URL;
    if (!baseUrl || !/^https:\/\//.test(baseUrl)) record('deployed-url', 'UNKNOWN', 'Wymagany jawny BASE_URL HTTPS.');
    else if (!process.env.SMOKE_STORAGE_STATE) record('deployed-user-flow', 'UNKNOWN', 'Brak SMOKE_STORAGE_STATE dedykowanego konta testowego.');
    else await run('deployed-user-flow', node, [join(root, 'scripts/e2e-release-user-flow.mjs')], { cwd: output, env: { BASE_URL: baseUrl, SMOKE_OUTPUT: join(output, 'user-flow') } });
  } else {
    await run('rule-limits', node, ['scripts/sprawdz-limity-regul.mjs']);
    await run('lint-typescript', ...[npm[0], [...npm[1], 'run', 'lint']]);
    if (mode === 'release') {
      await run('unit-integration', node, [vitest, 'run', '--maxWorkers=4'], { timeout: 600_000 });
      await run('pdf-integration', node, [vitest, 'run', 'src/server/__tests__/pdf.routes.test.ts'], { env: { RUN_PDF_INTEGRATION: '1' } });
      await run('python-pdf', python, ['-m', 'unittest', 'discover', '-s', 'mastervault-cv/tests'], { env: { PYTHONPATH: join(root, 'mastervault-cv') } });
      await run('multipage-pdf', node, [tsx, join(root, 'scripts/audit-pdf-long-cv.ts')], { env: { EVIDENCE_DIR: join(output, 'docs/evidence') } });
    } else {
      await run('critical-regressions', node, [vitest, 'run', '--maxWorkers=4', 'atsAdversarial', 'atsContract', 'atsDiagnosticReadiness', 'consistency', 'ground', 'releaseGolden', 'clientErrorGate', 'releaseGate', 'vaultImport', 'quickOnboarding', 'quickAtsCheck', 'errors.routes']);
      // Zmienione moduły też mają konsumenta w Fast Gate; krytyczny rdzeń biegnie zawsze.
      if (process.env.GATE_BASE_SHA) await run('changed-module-tests', node, [vitest, 'run', '--maxWorkers=4', '--passWithNoTests', '--changed', process.env.GATE_BASE_SHA]);
    }
    const built = await run('build', npm[0], [...npm[1], 'run', 'build']);
    if (built) scanBundle(); else record('client-secret-patterns', 'SKIPPED', 'Build nie powiódł się.');
    await withServer(false, async url => {
      const names = mode === 'fast' ? ['quick-onboarding'] : [
        'quick-onboarding', 'fit-structure-separation', 'ats-independent-aggregation', 'quick-ats-required-qualification', 'quick-ats-limitation-reason',
        'ats-unconfirmed-only', 'ats-score-unknown-experience', 'negated-requirements',
        'consistency-projected-dates', 'consistency-negated-tags', 'consistency-projected-metrics',
        'consistency-missing-sources', 'local-profile-isolation', 'local-profile-session-race',
        'ats-timeline-status', 'consistency-timeline-unknown',
        'cloud-logout-race', 'account-delete-ui', 'auth-modal-operations', 'idb-stale-write',
        'master-vault-invalid-import',
        'cv-import-source-facts',
        'cv-malformed-file', 'rewriter-model-error', 'summary-skills-grounded', 'cv-copy-parity', 'pdf-preview', 'pdf-artifact-preview', 'pdf-incomplete-experience',
      ];
      for (const name of names) await browserTest(name, url);
    });
    if (mode === 'release') await withServer(false, async url => {
      await browserTest('cloud-vault-conflict', url);
      await browserTest('cloud-vault-malformed', url);
    }, true);
    if (mode === 'release' && built) await withServer(true, async url => {
      await run('built-user-flow', node, [join(root, 'scripts/e2e-quick-onboarding.mjs')], { cwd: output, env: { BASE_URL: url } });
    });
    if (mode === 'release') record('authenticated-ui-pdf', 'UNKNOWN', 'Wykonywany w wymaganym workflow D04 na izolowanym Supabase; ten raport lokalny nie potwierdza jego wyniku.', { required: false });
    record('production-telemetry', 'SKIPPED', 'Lokalny/CI odbiór nie ma produkcyjnego źródła. Przed wdrożeniem wymagane bledy:bramka -- --required --cloud.', { required: false });
    record('live-provider-auth-ai', 'UNKNOWN', 'Deterministyczne testy nie potwierdzają dostępności produkcyjnego OAuth/AI. RLS i cykl kont sprawdza osobny wymagany job na izolowanym Supabase.', { required: false });
  }
} catch (error) {
  record('gate-execution', 'FAIL', error instanceof Error ? error.message : String(error));
} finally {
  const endSha = git('rev-parse', 'HEAD');
  if (endSha !== sha || git('status', '--porcelain', '--untracked-files=normal')) record('source-identity-end', 'UNKNOWN', 'Checkout zmienił się w trakcie lub pozostaje nieczysty.');
  report.finishedAt = new Date().toISOString();
  report.releaseDecision = 'REQUIRES_EXTERNAL_ACCEPTANCE';
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(output, 'report.md'), `# ${mode.toUpperCase()} GATE\n\nSHA: \`${sha}\`\n\nWynik automatycznych kontroli: **${report.status}**. Nie jest to zgoda na publikację.\n\n| Kontrola | Status | Powód |\n|---|---|---|\n` + report.checks.map(c => `| ${c.id} | ${c.status} | ${c.reason.replaceAll('|', '/')} |`).join('\n') + '\n');
  console.log(`Raport: ${join(output, 'report.json')}`);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}
