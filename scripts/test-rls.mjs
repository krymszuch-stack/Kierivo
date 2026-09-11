#!/usr/bin/env node
/**
 * Destrukcyjny test polityk RLS. Tworzy i usuwa konta testowe.
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
    `ODMOWA: test:rls tworzy i usuwa konta, a SUPABASE_URL wskazuje zdalny host (${host}).\n` +
      'Uruchom go na lokalnym/odrębnym środowisku testowym. Zdalne uruchomienie wymaga jawnego opt-in.'
  );
  process.exit(2);
}

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
  const email = `rls-${label}-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Nie udało się założyć konta ${label}: ${error.message}`);

  created.push(data.user.id);

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: login, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !login.session) {
    throw new Error(`Nie udało się zalogować ${label}: ${signInError?.message ?? 'brak sesji'}`);
  }

  return { id: data.user.id, client, accessToken: login.session.access_token };
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

try {
  console.log(`\nTest polityk RLS (${isLocal ? 'lokalne środowisko izolowane' : 'zdalne środowisko z jawnym opt-in'})\n`);

  const alice = await createUser('alice');
  const bob = await createUser('bob');

  await admin.from('vaults').upsert({
    user_id: alice.id,
    data: { sekret: 'CV Alicji' },
    version: '1',
  });

  await admin.from('applications').insert({
    user_id: alice.id,
    company: 'Firma Alicji',
    position: 'Stanowisko Alicji',
  });

  console.log('Izolacja danych między kontami:');

  const bobReadsVault = await bob.client.from('vaults').select('*').eq('user_id', alice.id);
  check(
    'Bob nie widzi vaultu Alicji',
    (bobReadsVault.data ?? []).length === 0,
    `zwrócono ${bobReadsVault.data?.length ?? 0} wierszy`
  );

  const bobReadsApps = await bob.client.from('applications').select('*').eq('user_id', alice.id);
  check(
    'Bob nie widzi aplikacji Alicji',
    (bobReadsApps.data ?? []).length === 0,
    `zwrócono ${bobReadsApps.data?.length ?? 0} wierszy`
  );

  const aliceReadsOwn = await alice.client.from('vaults').select('*');
  check(
    'Alicja widzi własny vault',
    (aliceReadsOwn.data ?? []).length === 1,
    `zwrócono ${aliceReadsOwn.data?.length ?? 0} wierszy`
  );

  console.log('\nIzolacja zapisu między kontami:');

  const bobInsertsAsAlice = await bob.client.from('vaults').upsert({
    user_id: alice.id,
    data: { sekret: 'Fałszywy vault' },
    version: '2',
  });
  check('Bob nie może zapisać wiersza jako Alicja', bobInsertsAsAlice.error !== null, 'zapis się powiódł');

  const bobOverwrites = await bob.client
    .from('vaults')
    .update({ data: { sekret: 'Podmienione przez Boba' } })
    .eq('user_id', alice.id);
  const aliceAfterOverwrite = await admin
    .from('vaults')
    .select('data')
    .eq('user_id', alice.id)
    .maybeSingle();
  check(
    'Bob nie może nadpisać vaultu Alicji',
    aliceAfterOverwrite.data?.data?.sekret === 'CV Alicji',
    bobOverwrites.error ? `błąd: ${bobOverwrites.error.message}` : 'aktualizacja dotknęła wiersz'
  );

  const bobDeletes = await bob.client.from('vaults').delete().eq('user_id', alice.id);
  const aliceCountAfterDelete = await admin
    .from('vaults')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', alice.id);
  check(
    'Bob nie może usunąć vaultu Alicji',
    (aliceCountAfterDelete.count ?? 0) === 1,
    bobDeletes.error ? `błąd: ${bobDeletes.error.message}` : `wierszy po próbie: ${aliceCountAfterDelete.count ?? 0}`
  );

  console.log('\nOchrona danych serwerowych i kwot:');

  const selfUpgrade = await bob.client
    .from('subscriptions')
    .upsert({ user_id: bob.id, status: 'active' });
  check('Bob nie może nadać sobie statusu active', selfUpgrade.error !== null, 'zapis się powiódł');

  const quotaTamper = await bob.client
    .from('usage_counters')
    .upsert({ user_id: bob.id, month_key: '2026-01', ai_uses: 0, import_uses: 0 });
  check('Bob nie może wyzerować własnych liczników', quotaTamper.error !== null, 'zapis się powiódł');

  const rpcTamper = await bob.client.rpc('consume_quota', { p_user: alice.id, p_kind: 'ai' });
  check('Bob nie może wywołać consume_quota bezpośrednio', rpcTamper.error !== null, 'RPC się powiodło');

  console.log('\nLimity i race condition:');

  const results = [];
  for (let i = 0; i < 6; i++) {
    const { data } = await admin.rpc('consume_quota', { p_user: bob.id, p_kind: 'ai' });
    results.push(data);
  }
  check(
    'Piąte wywołanie przechodzi, szóste jest odrzucane',
    results.slice(0, 5).every((r) => r === true) && results[5] === false,
    `wyniki: ${results.join(', ')}`
  );

  const race = await Promise.all(
    Array.from({ length: 10 }, () =>
      admin.rpc('reserve_ai_quota', { p_user_id: alice.id, p_max_daily_uses: 5 })
    )
  );
  const allowedCount = race.filter((r) => r.data?.allowed === true).length;
  const deniedCount = race.filter((r) => r.data?.allowed === false).length;
  check(
    'Z 10 równoległych rezerwacji (limit 5) dokładnie 5 przechodzi',
    allowedCount === 5 && deniedCount === 5,
    `dopuszczono: ${allowedCount}, odrzucono: ${deniedCount}`
  );

  console.log('\nUsunięcie konta i stary token:');

  await admin.rpc('delete_user_data', { p_user: alice.id });
  const leftovers = await admin.from('vaults').select('*').eq('user_id', alice.id);
  check('delete_user_data usuwa vault', (leftovers.data ?? []).length === 0);

  const leftoverApps = await admin.from('applications').select('*').eq('user_id', alice.id);
  check('delete_user_data usuwa aplikacje', (leftoverApps.data ?? []).length === 0);

  const deleted = await admin.auth.admin.deleteUser(alice.id);
  check('konto Auth Alicji zostało usunięte', deleted.error === null, deleted.error?.message ?? '');

  const oldTokenClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${alice.accessToken}` } },
  });

  const oldTokenUser = await oldTokenClient.auth.getUser(alice.accessToken);
  check('stary token nie potwierdza już istnienia użytkownika', oldTokenUser.error !== null);

  const oldTokenReads = await oldTokenClient.from('vaults').select('*').eq('user_id', alice.id);
  check('stary token nie odzyskuje usuniętego vaultu', (oldTokenReads.data ?? []).length === 0);

  const oldTokenRecreates = await oldTokenClient.from('vaults').insert({
    user_id: alice.id,
    data: { sekret: 'Próba po usunięciu' },
    version: '1',
  });
  check('stary token nie może odtworzyć danych usuniętego konta', oldTokenRecreates.error !== null);

  const aliceIndex = created.indexOf(alice.id);
  if (aliceIndex >= 0) created.splice(aliceIndex, 1);
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

console.log('\n✓ Wszystkie polityki i granice po usunięciu konta działają.\n');
