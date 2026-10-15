import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const url = process.env.SUPABASE_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('ODMOWA: wyłącznie izolowany lokalny Supabase.');
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const temp = await mkdtemp(join(tmpdir(), 'kierivo-smoke-auth-'));
const email = `release-${randomUUID()}@example.test`;
const password = `Release-${randomUUID()}aA7!`;
const baseUrl = 'http://127.0.0.1:4188';
let userId;
let server;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error('Nie utworzono lokalnego konta testowego.');
  userId = created.data.user.id;
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error('Logowanie testowe nie powiodło się.');
  const state = join(temp, 'state.json');
  await writeFile(state, JSON.stringify({ cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, value: JSON.stringify(login.data.session) }] }] }), { mode: 0o600 });
  server = spawn(process.execPath, ['dist/server.mjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '4188', BACKEND_MODE: 'cloud', AI_PROVIDER: 'ollama', APP_URL: 'https://smoke.kierivo.invalid' }, stdio: 'inherit', windowsHide: true });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) { ready = true; break; } } catch { /* start serwera */ }
    await new Promise(done => setTimeout(done, 500));
  }
  if (!ready) throw new Error('Serwer smoke nie wystartował.');
  const child = spawn(process.execPath, ['scripts/e2e-release-user-flow.mjs'], { env: { ...process.env, BASE_URL: baseUrl, SMOKE_STORAGE_STATE: state, SMOKE_OUTPUT: resolve('artifacts/isolated-auth-smoke') }, stdio: 'inherit', windowsHide: true });
  const code = await new Promise(done => child.once('close', done));
  if (code !== 0) throw new Error(`FAIL: uwierzytelniony smoke, exit ${code}`);
} finally {
  server?.kill();
  if (userId) {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) throw new Error('Nie udało się usunąć własnego konta z izolowanego Supabase.');
  }
  await rm(temp, { recursive: true, force: true });
}
