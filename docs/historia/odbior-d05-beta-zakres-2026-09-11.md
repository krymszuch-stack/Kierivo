# Odbiór D05 — uczciwy zakres bezpłatnej bety

**Data:** 2026-09-11  
**PR:** #112 `D05: uczciwie określ zakres bezpłatnej bety`  
**Gałąź:** `d05-beta-scope`  
**Stan dokumentu:** automatyczny odbiór zaliczony; ręczny smoke test produkcji wymagany przed końcowym `D05: ODEBRANE`.

## Decyzje właściciela produktu

Adrian potwierdził przed finalnym odbiorem:

1. Nazwy Workday, Taleo, Greenhouse, Lever, eRecruiter i Traffit mają zniknąć także z wewnętrznego `atsScorer.ts`; profile mają nazywać rzeczywiście mierzone cechy.
2. Beta jest całkowicie bezpłatna: cena 0 zł i zero aktywnych CTA do Stripe, Pro, triala, Karnetu lub płatnych szablonów.
3. Historyczne uprawnienia Pro/Karnet **nie odblokowują** funkcji ani podwyższonych limitów podczas bezpłatnej bety.
4. Lokalny moduł porad ma być nazywany **Doradcą regułowym**, bez brandingu „AI”, dopóki nie wywołuje modelu językowego.
5. Funkcje poza zakresem bety mogą pozostać widoczne, ale muszą jasno informować o niedostępności i nie prowadzić do zakupu.
6. Automatyczny browser test i screenshoty są dowodem technicznym, ale nie zastępują ręcznego przejścia wdrożonej wersji produkcyjnej.

## R11 — wynik ATS bez podszywania się pod zewnętrzne systemy

Główny wynik CVelocity jest opisany jako własna ocena regułowa, a nie wynik zewnętrznego ATS ani gwarancja przejścia rekrutacji.

W `src/lib/atsScorer.ts` profile heurystyczne zostały nazwane według mierzonych cech:

- `Struktura_Odczyt` — układ i parsowalność,
- `Frazy_Gestosc` — frazy i sygnały tekstowe,
- `Jezyk_Formularz` — polska fleksja i formularze.

Plik nie zawiera nazw Workday, Taleo, Greenhouse, Lever, eRecruiter ani Traffit. Test `betaTruth.test.ts` pilnuje, żeby vendorowe nazwy nie wróciły do tej warstwy.

## R12 — walidator spójności

`ConsistencyLockBadge` nie używa fallbacku „100% zgodności”. Przy braku wykrytych alarmów opisuje wyłącznie brak rozbieżności w **sprawdzanym zakresie** i, gdy liczba jest znana, liczbę sprawdzonych faktów.

## R13 — bezpłatna beta i brak martwego checkoutu

Jednym źródłem stanu bety jest `src/lib/beta.ts`:

- `FREE_BETA_ACTIVE = true`,
- `FREE_BETA_PRICE_PLN = 0`,
- `BETA_PURCHASES_ENABLED = false`.

Backend nie tworzy checkoutu w aktywnej becie. UI nie prowadzi do Stripe Portal, Pro, triala, płatnych szablonów ani Karnetu. Po wyczerpaniu limitu importu pliku tester dostaje działającą ścieżkę wklejenia tekstu CV bez płatności.

Historyczne uprawnienia nie omijają bety:

- `useEntitlements` zwraca `isPro=false` i `hasActivePass=false` podczas `FREE_BETA_ACTIVE`, nawet jeżeli konto ma stary status płatny,
- `ApplicationPassGate` nie odblokowuje Telepromptera historycznym Karnetem,
- `executeAiOperation` stosuje w becie limit darmowy również dla kont `active/trialing`,
- parser pliku nie ma już ścieżki „Legacy Pro = bez limitu”.

Funkcje poza zakresem pozostają możliwe do zobaczenia jako informacja, ale bez CTA zakupowego.

## R15 — opisy odpowiadają implementacji

Doradca jest opisany jako lokalny **Doradca regułowy**. Dostaje tylko wpisane pytanie lub szybki prompt, nie czyta automatycznie Master Vaultu ani aplikacji i nie wysyła rozmowy do zewnętrznego modelu językowego.

README i NOTATKI nie opisują gamifikacji, triala, stałej liczby testów ani absolutnego „100% client-side” jako bieżącej oferty produktu.

## Automatyczny odbiór

**Commit sprawdzony:** `2ff2e8f873e379dd30ff7a9b9072e5d22eb9dfb9`  
**Workflow:** `D05 BETA SCOPE`  
**Run:** `34576903536`

Przebieg zaliczył:

- lint i TypeScript — **PASS**,
- testy jednostkowe — **PASS**, 86 plików / 837 testów,
- build klienta i serwera — **PASS**,
- instalację Chromium/Playwright — **PASS**,
- browser acceptance nowego testera — **PASS**,
- zapis artefaktu dowodowego — **PASS**.

Artefakt `d05-beta-proof` ma ID `10190033862`, rozmiar 1 504 552 B i digest `sha256:91e734d87f452fd9c5307fcdf682248e06ff63ad42f139a4b00301201c9f45ca`.

Scenariusz browser acceptance:

1. czysty tester otwiera ekran startowy i widzi „Bezpłatna beta” oraz `0 zł`,
2. nie widzi aktywnych CTA zakupowych,
3. wkleja przykładowe CV i ogłoszenie,
4. wybiera `Policz wynik CVelocity`,
5. dostaje wynik oznaczony jako CVelocity wraz z ograniczeniem, że to nie prognoza decyzji rekrutera,
6. przechodzi do zakresu bety,
7. widzi `0 zł` i informację, że podstawowy przepływ nie wymaga płatności,
8. nadal nie trafia do checkoutu.

Zapisane dowody graficzne:

- `01-start-bezplatna-beta.png`,
- `02-wynik-cvelocity-bez-platnosci.png`,
- `03-zakres-bety-0-zl.png`,
- `proof.txt`.

## Stan migracji D04 przed wdrożeniem produkcyjnym

Produkcyjny projekt Supabase: `cvelocity-prod` (`sahohpnhkpnippcayihr`). Przed wdrożeniem D04 historia produkcyjna kończy się na `20260829064035_disable_gamification_api`; migracja repo `20260911070000_harden_data_api_grants.sql` nie figuruje jeszcze jako zastosowana. Nie uruchamiać `test:rls` na produkcji.

## Ręczny odbiór produkcyjny — PENDING

Po merge D04 i D05 oraz wdrożeniu na bieżący hosting należy ręcznie przejść `https://cvelocity.oathcry.com` i potwierdzić:

- ekran startowy: bezpłatna beta / 0 zł,
- szybki wynik CVelocity bez płatności,
- ekran zakresu bety bez checkoutu,
- menu konta bez Pro/Stripe Portal,
- Doradca nazwany „Doradca regułowy” i zgodnie opisany,
- Audyt ATS nie prezentuje vendorowych wyników,
- funkcja poza zakresem, np. Teleprompter, pokazuje komunikat o niedostępności zamiast zakupu.

Dopiero po tym ręcznym przejściu i potwierdzonym wdrożeniu dokument może otrzymać końcowy status:

**D05: ODEBRANE**.
