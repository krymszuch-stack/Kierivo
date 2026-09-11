#!/usr/bin/env node
/**
 * D04 end-to-end acceptance for an ISOLATED local Supabase stack.
 *
 * Proves: public password-check channel -> signup -> confirmation email -> login
 * -> recovery email -> updateUser -> login with new password -> account deletion
 * -> old token cannot restore data.
 *
 * The script never prints passwords, access tokens, refresh tokens or full links.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const redirectTo = process.env.D04_TEST_REDIRECT_URL ?? 'http://127.0.0.1:3000/';

if (!url || !anonKey || !serviceKey) {
  console.error('Brak SUPABASE_URL, SUPABASE_ANON_KEY lub SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`ODMOWA: test cyklu kont jest destrukcyjny i wymaga lokalnego Supabase, otrzymano ${host}.`);
  process.exit(2);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `d04-${randomUUID()}@example.test`;
const oldPassword = `D04-Old-${randomUUID()}aA7`;
const newPassword = `D04-New-${randomUUID()}bB8`;
let userId = null;
let oldAccessToken = null;

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, error) {
  throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
}

function recipientMatches(message, address) {
  return JSON.stringify(message?.To ?? message?.to ?? '').toLowerCase().includes(address.toLowerCase());
}

async function getMailMessage(address, after = 0) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpit}/api/v1/messages`);
    if (!response.ok) fail('Mailpit nie odpowiada', `${response.status}`);
    const box = await response.json();
    const messages = Array.isArray(box.messages) ? box.messages : [];
    const candidate = messages.find((message) => {
      const created = Date.parse(message.Created ?? message.created ?? 0) || 0;
      return recipientMatches(message, address) && created >= after - 1000;
    });

    if (candidate) {
      const id = candidate.ID ?? candidate.Id ?? candidate.id;
      const full = await fetch(`${mailpit}/api/v1/message/${encodeURIComponent(id)}`);
      if (!full.ok) fail('Nie można odczytać wiadomości z Mailpit', `${full.status}`);
      return full.json();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Mailpit nie przechwycił oczekiwanej wiadomości w limicie czasu.');
}

function verificationLink(message) {
  const source = `${message?.HTML ?? message?.Html ?? ''}\n${message?.Text ?? message?.text ?? ''}`
    .replaceAll('&amp;', '&');
  const match = source.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/i);
  if (!match) throw new Error('W mailu nie znaleziono linku /auth/v1/verify.');
  return match[0];
}

async function consumeEmailLink(link) {
  const response = await fetch(link, { redirect: 'manual' });
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`Link Auth zwrócił ${response.status} zamiast przekierowania.`);
  }
  const location = response.headers.get('location');
  if (!location) throw new Error('Link Auth nie zwrócił Location.');
  return new URL(location, redirectTo);
}

function sessionFromRedirect(location) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    throw new Error('Powrót recovery nie zawiera sesji implicit flow.');
  }
  return { access_token, refresh_token };
}

async function cleanup() {
  if (!userId) return;
  try {
    await admin.rpc('delete_user_data', { p_user: userId });
  } catch {}
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {}
}

try {
  console.log('\nD04: pełny cykl konta na lokalnym Supabase\n');

  // Funkcja jest publiczna celowo: działa przed rejestracją i otrzymuje tylko
  // 5 znaków prefiksu SHA-1, nigdy hasło. Odbiór potwierdza, że trasa nie jest
  // martwa i nie wymaga sesji użytkownika.
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const passwordCheck = await publicClient.functions.invoke('sprawdz-haslo', {
    body: { prefix: '5BAA6' },
  });
  if (passwordCheck.error) fail('Edge Function sprawdz-haslo', passwordCheck.error);
  if (typeof passwordCheck.data?.suffixes !== 'string' && passwordCheck.data?.unavailable !== true) {
    fail('Edge Function sprawdz-haslo', 'nieoczekiwany format odpowiedzi');
  }
  ok('sprawdz-haslo działa przed logowaniem bez wysyłania hasła');

  const signupStarted = Date.now();
  const signupClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const signup = await signupClient.auth.signUp({
    email,
    password: oldPassword,
    options: { emailRedirectTo: redirectTo, data: { display_name: 'D04 Test' } },
  });
  if (signup.error || !signup.data.user) fail('rejestracja', signup.error ?? 'brak użytkownika');
  userId = signup.data.user.id;
  if (signup.data.session) throw new Error('Oczekiwano potwierdzenia e-mail, ale rejestracja od razu utworzyła sesję.');
  ok('nowe konto wymaga potwierdzenia e-mail');

  const confirmationMail = await getMailMessage(email, signupStarted);
  const confirmRedirect = await consumeEmailLink(verificationLink(confirmationMail));
  if (confirmRedirect.origin !== new URL(redirectTo).origin) {
    throw new Error(`Potwierdzenie wróciło do nieoczekiwanej domeny: ${confirmRedirect.origin}`);
  }
  ok('mail potwierdzający został dostarczony i wraca na dozwoloną domenę');

  const loginClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const firstLogin = await loginClient.auth.signInWithPassword({ email, password: oldPassword });
  if (firstLogin.error || !firstLogin.data.session) fail('logowanie po potwierdzeniu', firstLogin.error ?? 'brak sesji');
  oldAccessToken = firstLogin.data.session.access_token;
  ok('logowanie po potwierdzeniu działa');

  const resetStarted = Date.now();
  const resetRequest = await loginClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetRequest.error) fail('wysłanie resetu hasła', resetRequest.error);

  const recoveryMail = await getMailMessage(email, resetStarted);
  const recoveryRedirect = await consumeEmailLink(verificationLink(recoveryMail));
  if (recoveryRedirect.origin !== new URL(redirectTo).origin) {
    throw new Error(`Recovery wróciło do nieoczekiwanej domeny: ${recoveryRedirect.origin}`);
  }
  ok('mail recovery został dostarczony i ma poprawny powrót');

  const recoverySession = sessionFromRedirect(recoveryRedirect);
  const recoveryClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const setSession = await recoveryClient.auth.setSession(recoverySession);
  if (setSession.error || !setSession.data.session) fail('ustanowienie sesji PASSWORD_RECOVERY', setSession.error ?? 'brak sesji');

  const update = await recoveryClient.auth.updateUser({ password: newPassword });
  if (update.error) fail('updateUser(new password)', update.error);
  ok('nowe hasło zapisane przez updateUser');

  await recoveryClient.auth.signOut();

  const oldLogin = await createClient(url, anonKey, { auth: { persistSession: false } })
    .auth.signInWithPassword({ email, password: oldPassword });
  if (!oldLogin.error) throw new Error('Stare hasło nadal pozwala się zalogować.');
  ok('stare hasło przestało działać');

  const currentClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const newLogin = await currentClient.auth.signInWithPassword({ email, password: newPassword });
  if (newLogin.error || !newLogin.data.session) fail('logowanie nowym hasłem', newLogin.error ?? 'brak sesji');
  ok('logowanie nowym hasłem działa');

  const write = await currentClient.from('vaults').upsert({
    user_id: userId,
    data: { d04: 'delete-me' },
    version: '1',
  });
  if (write.error) fail('przygotowanie danych przed usunięciem', write.error);

  const deleteResult = await currentClient.functions.invoke('usun-konto');
  if (deleteResult.error || deleteResult.data?.success !== true) {
    fail('Edge Function usun-konto', deleteResult.error ?? JSON.stringify(deleteResult.data));
  }
  ok('usun-konto usuwa konto przez zweryfikowaną sesję');

  const authRecord = await admin.auth.admin.getUserById(userId);
  if (!authRecord.error && authRecord.data?.user) throw new Error('Konto nadal istnieje w Auth po usunięciu.');

  const leftovers = await admin.from('vaults').select('*').eq('user_id', userId);
  if ((leftovers.data ?? []).length !== 0) throw new Error('Po usunięciu konta pozostał vault.');
  ok('po usunięciu nie ma konta ani jego vaultu');

  const stale = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${oldAccessToken}` } },
  });
  const staleUser = await stale.auth.getUser(oldAccessToken);
  if (!staleUser.error) throw new Error('Stary token nadal potwierdza użytkownika po usunięciu konta.');

  const staleRead = await stale.from('vaults').select('*').eq('user_id', userId);
  if ((staleRead.data ?? []).length !== 0) throw new Error('Stary token odczytał dane po usunięciu konta.');

  const staleInsert = await stale.from('vaults').insert({
    user_id: userId,
    data: { d04: 'stale-token' },
    version: '1',
  });
  if (!staleInsert.error) throw new Error('Stary token odtworzył dane usuniętego konta.');
  ok('stary token nie daje dostępu ani możliwości odtworzenia danych');

  userId = null;
  console.log('\n✓ Pełny cykl D04 zakończony powodzeniem.\n');
} catch (error) {
  console.error(`\n✗ D04 auth lifecycle: ${error instanceof Error ? error.message : String(error)}\n`);
  await cleanup();
  process.exit(1);
}
