#!/usr/bin/env node
/**
 * Destrukcyjny test race condition dla operacji modyfikujących stan współdzielony.
 *
 * Sprawdza, czy operacje bazodanowe mają atomowość SQL (nie read-then-write w JS).
 * Dla każdej operacji wysyła 10 równoległych żądań i weryfikuje, czy limity
 * są przestrzegane, a liczniki nie przekraczają dozwolonych wartości.
 *
 * Domyślnie wolno mu działać WYŁĄCZNIE na lokalnym Supabase. Zdalna baza
 * wymaga jawnego D04_ALLOW_REMOTE_TESTS=I_UNDERSTAND_THIS_CREATES_AND_DELETES_USERS.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error(
    'Brak konfiguracji. Wymagane: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.\n' +
      'Uruchom lokalny Supabase i przekaż wartości z `supabase status -o env`.'
  );
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
const remoteOptIn =
  process.env.D04_ALLOW_REMOTE_TESTS === 'I_UNDERSTAND_THIS_CREATES_AND_DELETES_USERS';

if (!isLocal && !remoteOptIn) {
  console.error(
    `ODMOWA: test:race tworzy i usuwa konta, a SUPABASE_URL wskazuje zdalny host (${host}).\n` +
      'Uruchom go na lokalnym/odrębnym środowisku testowym. Zdalne uruchomienie wymaga jawnego opt-in.'
  );
  process.exit(2);
}

const CONCURRENT = 10;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const failures = [];
const created = [];

function check(name, passed, detail = '') {
  if (passed) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

async function createUser(label) {
  const email = `race-${label}-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Nie udało się założyć konta ${label}: ${error.message}`);

  created.push(data.user.id);
  return { id: data.user.id };
}

async function cleanup() {
  for (const id of created) {
    try {
      await admin.rpc('delete_user_data', { p_user: id });
    } catch {}
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Test 1: consume_quota — 10 równoległych wywołań, limit 3
// ---------------------------------------------------------------------------
async function testConsumeQuotaRace() {
  console.log('\nRace condition: consume_quota (limit 3, 10 równoległych)');

  const user = await createUser('consume');

  // Zapewnij, że wiersz istnieje i jest na zero
  await admin.from('usage_counters').upsert({
    user_id: user.id,
    month_key: new Date().toISOString().slice(0, 7),
    ai_uses: 0,
    import_uses: 0,
  });

  // Upewnij się, że użytkownik jest na planie darmowym (brak subskrypcji)
  // consume_quota sprawdza subscriptions — brak wiersza = free plan

  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, () =>
      admin.rpc('consume_quota', { p_user: user.id, p_kind: 'ai' })
    )
  );

  const succeeded = results.filter((r) => r.data === true).length;
  const failed = results.filter((r) => r.data === false).length;
  const errors = results.filter((r) => r.error !== null).length;

  // Odczytaj faktyczny stan po wszystkich wywołaniach
  const { data: counter } = await admin
    .from('usage_counters')
    .select('ai_uses')
    .eq('user_id', user.id)
    .eq('month_key', new Date().toISOString().slice(0, 7))
    .maybeSingle();

  const actualUses = counter?.ai_uses ?? 0;

  check(
    'Brak błędów RPC',
    errors === 0,
    `błędy: ${errors}`
  );
  check(
    'Dokładnie 3 wywołania przeszły (limit darmowy)',
    succeeded === 3,
    `przeszło: ${succeeded}, odrzucono: ${failed}`
  );
  check(
    'Faktyczny stan licznika = 3',
    actualUses === 3,
    `ai_uses = ${actualUses}`
  );
}

// ---------------------------------------------------------------------------
// Test 2: activate_application_pass — 10 równoległych aktywacji
// ---------------------------------------------------------------------------
async function testActivatePassRace() {
  console.log('\nRace condition: activate_application_pass (10 równoległych)');

  const user = await createUser('pass');

  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, () =>
      admin.rpc('activate_application_pass', {
        p_user_id: user.id,
        p_days: 30,
      })
    )
  );

  const succeeded = results.filter((r) => r.error === null).length;
  const failed = results.filter((r) => r.error !== null).length;

  // Sprawdź pulę karnetu — powinna być 30, nie 300
  const { data: quota } = await admin
    .from('user_quotas')
    .select('karnet_ai_pool, karnet_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const pool = quota?.karnet_ai_pool ?? 0;

  check(
    'Wszystkie wywołania RPC się powiodły (transakcja jest atomowa)',
    succeeded === CONCURRENT,
    `powodzenie: ${succeeded}, błędy: ${failed}`
  );
  check(
    'Pula karnetu = 30 (nie 300 — sumowanie 10×30 nie następuje)',
    pool === 30,
    `karnet_ai_pool = ${pool}`
  );
  check(
    'Data wygaśnięcia jest ustawiona',
    quota?.karnet_expires_at !== null,
    `karnet_expires_at = ${quota?.karnet_expires_at}`
  );
}

// ---------------------------------------------------------------------------
// Test 3: record_client_errors — 10 równoległych raportów, ten sam fingerprint
// ---------------------------------------------------------------------------
async function testRecordClientErrorsRace() {
  console.log('\nRace condition: record_client_errors (10 raportów, ten sam fingerprint)');

  const fingerprint = `race-test-${randomUUID()}`;
  const event = {
    fingerprint,
    kind: 'unhandled',
    surface: 'test',
    message: 'Race condition test error',
    stack: null,
    env: 'test',
    uaFamily: 'TestAgent',
    viewportBucket: '1920x1080',
  };

  // Wyślij 10 identycznych raportów równolegle
  await Promise.all(
    Array.from({ length: CONCURRENT }, () =>
      admin.rpc('record_client_errors', { p_events: JSON.stringify([event]) })
    )
  );

  // Sprawdź faktyczną liczbę wystąpień
  const { data: row } = await admin
    .from('client_errors')
    .select('occurrences')
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  const occurrences = row?.occurrences ?? 0;

  check(
    'Occurrences = 10 (każdy raport dodaje +1 atomowo)',
    occurrences === CONCURRENT,
    `occurrences = ${occurrences}`
  );
}

// ---------------------------------------------------------------------------
// Test 4: intel crowdsourced_companies — 10 równoległych żądań, read-then-write
// ---------------------------------------------------------------------------
async function testIntelCompanyRace() {
  console.log('\nRace condition: intel crowdsourced_companies (read-then-write w JS)');

  const companyName = `RaceTestCompany ${randomUUID().slice(0, 8)}`;

  // Wyślij 10 identycznych żądań firmowych równolegle
  // Symulujemy to, co robi intel.routes.ts: SELECT then INSERT/UPDATE
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT }, async () => {
      const { data: existing } = await admin
        .from('crowdsourced_companies')
        .select('id')
        .ilike('company_name', companyName)
        .maybeSingle();

      if (existing) {
        return admin
          .from('crowdsourced_companies')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
      return admin.from('crowdsourced_companies').insert({
        company_name: companyName,
        normalized_domain: null,
        industry: null,
      });
    })
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected').length;

  // Policz wiersze w bazie — powinien być dokładnie 1 (unique index)
  const { count } = await admin
    .from('crowdsourced_companies')
    .select('*', { count: 'exact', head: true })
    .ilike('company_name', companyName);

  check(
    'Wszystkie żądania zakończone (brak crashy)',
    rejected === 0,
    `odrzucone: ${rejected}`
  );
  check(
    'Dokładnie 1 wiersz w bazie (unique index chroni)',
    count === 1,
    `wierszy: ${count}`
  );

  // Sprawdź, czy którykolwiek INSERT się nie powiódł (może być błąd 23505 = unique violation)
  // W praktyce read-then-write może powodować błędy — to jest oczekiwane zachowanie
  console.log(
    `    ℹ read-then-write: ${fulfilled} sukcesów, ${rejected} odrzuconych (oczekiwane przy race)`
  );
}

// ---------------------------------------------------------------------------
// Główna sekwencja
// ---------------------------------------------------------------------------
try {
  console.log(`\nTest race condition — ${CONCURRENT} równoległych żądań na operację\n`);
  console.log(`Środowisko: ${isLocal ? 'lokalne' : 'zdalne (opt-in)'}`);

  await testConsumeQuotaRace();
  await testActivatePassRace();
  await testRecordClientErrorsRace();
  await testIntelCompanyRace();

  console.log('\n--- Usuwanie danych testowych ---');
} catch (err) {
  console.error('\nTest przerwany:', err instanceof Error ? err.message : String(err));
  failures.push('wyjątek');
} finally {
  await cleanup();
}

if (failures.length > 0) {
  console.error(`\n✗ Nieudane sprawdzenia: ${failures.length}. NIE WDRAŻAJ.\n`);
  process.exit(1);
}

console.log('\n✓ Wszystkie operacje mają poprawną atomowość.\n');
