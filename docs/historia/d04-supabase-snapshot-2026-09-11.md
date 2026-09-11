# D04 — snapshot Supabase przed odbiorem kont i RLS

Data: 2026-09-11  
Projekt sprawdzony: `cvelocity-prod` (`sahohpnhkpnippcayihr`)  
Cel: bezpieczny punkt odniesienia przed D04. Dokument nie zawiera kluczy, haseł, tokenów ani danych użytkowników.

## Historia migracji widoczna w środowisku hostowanym

Supabase zgłasza następujące zastosowane rekordy migracji:

1. `20260817195634 core_schema_with_rls`
2. `20260817195701 revoke_trigger_function_from_api`
3. `20260823050555 quota_atomic`
4. `20260824085457 reset_public_do_schematu_repo`
5. `20260824085655 init_z_repo_0001`
6. `20260824085712 quota_atomic_z_repo_0002`
7. `20260824085913 pytania_i_korpus_0003`
8. `20260824090040 revoke_handle_new_user_z_api`
9. `20260829060030 runtime_backend_tables`
10. `20260829060049 explicit_data_api_grants`
11. `20260829064035 disable_gamification_api`

## Pliki migracji na `main` przed D04

- `0001_init.sql`
- `0002_quota_atomic.sql`
- `0003_pytania_i_korpus.sql`
- `0004_karnet_aplikacyjny.sql`
- `0008_client_errors.sql`
- `0009_karnet_pool.sql`
- `20260828225511_runtime_backend_tables.sql`
- `20260828225522_explicit_data_api_grants.sql`
- `20260829090000_disable_gamification_api.sql`

## Porównanie: applied / missing / drift

Nie wolno utożsamiać istnienia pliku z jego zastosowaniem. Dlatego status jest rozdzielony na historię migracji i faktyczny stan schematu.

| Repo | Rekord w historii hostowanej | Efekt widoczny w schemacie | Status |
| --- | --- | --- | --- |
| `0001_init.sql` | `init_z_repo_0001` | tak | zastosowanie potwierdzone semantycznie i historią pod inną nazwą |
| `0002_quota_atomic.sql` | `quota_atomic_z_repo_0002` | tak | zastosowanie potwierdzone semantycznie i historią pod inną nazwą |
| `0003_pytania_i_korpus.sql` | `pytania_i_korpus_0003` | tak | zastosowanie potwierdzone semantycznie i historią pod inną nazwą |
| `0004_karnet_aplikacyjny.sql` | brak bezpośredniego rekordu | `profiles.plan_expires_at` i RPC istnieją | **drift historii** — efekt obecny, brak dowodu zastosowania tego konkretnego pliku |
| `0008_client_errors.sql` | brak bezpośredniego rekordu | `client_errors` i `record_client_errors` istnieją | **drift historii** — efekt obecny, brak dowodu zastosowania tego konkretnego pliku |
| `0009_karnet_pool.sql` | brak bezpośredniego rekordu | kolumny puli i aktualne RPC istnieją | **drift historii** — efekt obecny, brak dowodu zastosowania tego konkretnego pliku |
| `20260828225511_runtime_backend_tables.sql` | `runtime_backend_tables` | tak | zastosowanie potwierdzone semantycznie |
| `20260828225522_explicit_data_api_grants.sql` | `explicit_data_api_grants` | częściowo | rekord jest w historii, lecz legacy granty nadal są szersze niż zamierzone |
| `20260829090000_disable_gamification_api.sql` | `disable_gamification_api` | tak | zastosowanie potwierdzone semantycznie |

D04 dodaje `20260911070000_harden_data_api_grants.sql`, która najpierw odbiera stare prawa `anon/authenticated`, a następnie nadaje jawnie tylko operacje potrzebne klientowi. Migracja ma zostać odebrana w izolowanej bazie przed jakimkolwiek zastosowaniem na produkcji.

## Backup stanu bezpieczeństwa przed D04

Snapshot logiczny, wystarczający do odtworzenia decyzji audytowej:

- wszystkie aktualne tabele domenowe `public` mają RLS włączone,
- `vaults`: właściciel ma polityki SELECT/INSERT/UPDATE/DELETE oparte o `auth.uid() = user_id`,
- `applications`: właściciel ma polityki SELECT/INSERT/UPDATE/DELETE oparte o `auth.uid() = user_id`,
- `profiles`: odczyt/zapis ograniczony przez `auth.uid() = id`,
- `subscriptions`, `usage_counters`, `user_quotas`, `template_entitlements`, `ai_usage_events`: odczyt właścicielski,
- `delete_user_data`, `consume_quota`, `reserve_ai_quota` i pozostałe wrażliwe RPC nie mają EXECUTE dla `anon/authenticated`; wykonuje je `service_role`,
- produkcyjne Edge Functions `usun-konto` i `sprawdz-haslo` są aktywne,
- `usun-konto`: weryfikacja JWT włączona,
- `sprawdz-haslo`: JWT wyłączony świadomie, ponieważ działa przed rejestracją; wejściem jest wyłącznie 5-znakowy prefiks SHA-1,
- Security Advisor zgłasza wyłączoną wbudowaną ochronę leaked-password. Projekt używa własnego kanału k-anonimowego `sprawdz-haslo`; nie wysyła hasła do funkcji.

## Istotne odstępstwo znalezione przez audyt

Hostowany projekt odziedziczył szerokie prawa tabel dla `anon` i `authenticated` z wcześniejszego modelu grantów. Polityki RLS nadal blokują dostęp do cudzych wierszy, ale jest to zbędnie szeroka pierwsza warstwa uprawnień. D04 naprawia to przez jawne `REVOKE` przed listą wymaganych `GRANT`.

## Środowisko testów D04

Nie używamy `cvelocity-prod` do destrukcyjnego `npm run test:rls`.

Odbiór odbywa się na świeżym lokalnym stosie Supabase uruchamianym przez GitHub Actions z migracji z gałęzi PR. Test tworzy i usuwa tylko losowe konta `@example.test`, a cały stos jest niszczony po jobie. `scripts/test-rls.mjs` odmawia pracy na zdalnym URL bez jawnego, długiego opt-in.
