# Kierivo Public Pre-Beta — odbiór ADR-152 / ADR-125

Stan roboczy 14.10.2026: **BLOCKED — odbiór trwa; brak zgody na publikację**.

Aktualizacja 17:35 CEST: środowisko Supabase `kierivo` jest **ACTIVE_HEALTHY**.
Odczyt `client_errors` działa: 1 grupa OPEN, 8 wystąpień błędu importu modułu,
ostatnie 06.10; nie zamknięto bez odtworzenia/wyjaśnienia. Advisor potwierdza
ADR-127 (ochrona ujawnionych haseł wyłączona) oraz 4 INFO o RLS bez polityk.
Nie zmieniano ustawień, polityk, sekretów ani danych produkcyjnych.
Strona kierivo.com została odczytana w przeglądarce, bez zalogowanej sesji;
to nie jest odbiór uwierzytelnionego PDF ani dostępności AI.

GitHub CI i pełny Release Gate **PASS** dla `ae75bda8db995c7fa18295a1c98bc7746338f610`,
merge `a9e2c0af816d64d5662aa777489f5e76af89c18f`, run 38589383082.
Lokalny Gate tego SHA: FAIL w testach przeglądarkowych przy drugim serwerze dev
(konflikt transportu Vite na 24678). Naprawa wiąże WebSocket z właściwym HTTP
serwerem aplikacji; test obok istniejącego dev PASS bez ignorowania błędów strony.
Nowa rewizja wymaga ponownego Gate. Lokalny lint/build i Vitest 2732 PASS /
1 SKIPPED po poprawce serwera; wszystkie dotychczasowe asercje pozostają.

Najnowszy zakres poprawek: brakująca wymagana umiejętność ogranicza pozytywną
interpretację, tak jak brak formalny. Reprodukcja: Python/AWS bez Terraform,
oferta wymaga wszystkich trzech; wcześniej 80% i „Wysokie dopasowanie”. Teraz
laboratorium i pełny onboarding wskazują konkretny brak, bez tej etykiety.
Wynik liczbowy nie został sztucznie obniżony ani przeliczony przez frontend.
Atuty opcjonalne nadal nie są brakami, a niewiadome są przechowywane osobno.
Test RED → GREEN; Vitest 2732 PASS / 1 SKIPPED (239 plików). Browser PASS:
laboratorium, onboarding z Terraform oraz dotychczasowa regresja SEP G1.
Dowody: `docs/evidence/ats-independent-aggregation.png` i
`docs/evidence/ats-mandatory-skill-onboarding.png`. Nowa rewizja wymaga własnego CI.

Ostatni potwierdzony pełny CI: HEAD `d5e7fa269bff41538a730cae29b89c933e19902a`,
merge `bbd0f0d05bfe0143c4e8817dac47cc7d1ab3f475`, Release Gate 38553579369 PASS.
Późniejszy `f28c4b802eff43dce47fc17b762d7e6ce47abde8`, merge
`550f74de099a8d3c8ca5cc50cfa841b93110e05d`: Gate 38554289239 FAIL w smoke
onboardingu (dev i built). Komunikat o braku ServiceNow wypierał informację
o tylko jednym wymaganiu. Poprawiono UI tak, aby zachować oba ustalenia;
stara asercja pozostała, dodano wymaganie konkretnego braku. Lokalny przejazd
desktop/mobile 375 px PASS. Nowy CI nadal wymagany.

PDF: test trzech rzeczywistych wariantów wykazał raport 1/1/3 strony przy
faktycznych plikach 2/2/2. Pipeline wybierał wynik compact/ultra_compact, lecz
zapisywał bajty normal oraz wcześniejszy raport pominięć; powtórnie renderował
stanową instancję w wariancie overflow. Naprawiono wybór jednego przebiegu dla
bajtów, semantyki, JSON-LD i raportu. RED → GREEN: teraz 1/1/2 strony zgodne
z plikami. Python 46/46 PASS, integracja API PDF 19/19 PASS, rzeczywisty
podgląd/API zachowuje 31 kontrolowanych faktów i wyłącznie podaną klauzulę zgody.
Obejrzano PDF po skróceniu oraz obie strony overflow; druga strona zawiera
tylko języki (ograniczenie składu). Zrzut: `docs/evidence/pdf-selected-render-2026-10-14.png`.
To nie jest odbiór pełnej zgodności wizualnej podglądu HTML i PDF.

Pozostałe blokery odbioru: pełne kryteria D17/D20 i ADR-143, zgodność podglądu/PDF,
końcowy CI oraz uwierzytelniony odbiór zależności na przywróconym środowisku.
Nie wykonano merge/deploy ani zmiany produkcyjnych sekretów. Historyczne wyniki
poniżej odnoszą się wyłącznie do podanych SHA, nie do bieżącego checkoutu.

## Zakres i punkt odniesienia

Main pobrany 13.10: `00a4ccb4590d754a90e8a5e65e5e31f39a3ad63f`.
PR #138 (011f694), #139 (f5ba973), #140 (763338b), #141 (00a4ccb) są scalone;
potwierdzono przez GitHub API. Przy rozpoczęciu brak otwartych PR.
Gałąź prac: `codex/adr-152-release-hardening`. Nie wykonano merge ani deploy.

Zakres: parser CV/JD → MasterVault → deterministyczna diagnoza i dowody →
generator/podgląd → eksport PDF, izolacja kont/logout/delete, regresje i proces wydania.
Audit Core D07–D20 oceniany w zakresie zachowania publicznego produktu.
Poza zakresem: Gigs, Hunter Autofill, Jobs, publiczny Trust, Kotlin, CzyToTy,
nowa komercjalizacja i przebudowa UI. Nie deklarujemy pełnej kalibracji matematycznej.
S0/S1 blokują; S2/S3 wymagają udokumentowanej akceptacji ryzyka.

## Mapa zależności

- Oferta: scraper/net safeFetch → parser/normalizacja/sekcje MUST/NICE → canonicalAts/knockouts.
- CV: cvUniversalParser → MasterVault → canonicalAts (konsument głównej ścieżki),
  atsSimulator (diagnostyka), Audit Core D07/D08/D09… (kontrakty i ledger).
- Fakty: localProfile/storage/IndexedDB lub AuthContext/cloudVault/outbox/RLS →
  projekcje CV/HUD/Pitch → consistencyEngine/consistencyGuard.
- Eksport: DocumentRenderer/docVault → CVExportModal → API → pdf.routes →
  Python mvcv; wymagany token w ścieżce UI. Podgląd i pobrany plik to oddzielne kontrole.
- Wydanie: CI Fast Gate + pełny Release Gate + izolowany AUTH/RLS/PDF →
  ręczny workflow deploy z produkcyjną bramką telemetryczną → uwierzytelniony smoke.

## Aktualnie potwierdzone wyniki

### Historyczny odbiór — 13.10.2026, 23:06 CEST

**Decyzja: BLOCKED.** PR: https://github.com/krymszuch-stack/Kierivo/pull/142.
Nie wykonano merge ani deploy. `main` ponownie pobrano po wznowieniu: nadal
`00a4ccb4590d754a90e8a5e65e5e31f39a3ad63f`.

| Dowód | SHA | Stan |
|---|---|---|
| Lokalny Release Gate, wszystkie wymagane kontrole | `7e0e44a428bf7d41c4cd6151b1282e548a9b56fe` | PASS |
| Vitest / osobne PDF / Python | to samo SHA | 2722 PASS + 1 SKIPPED w zwykłym Vitest; osobno PDF 19/19 PASS; Python 45/45 PASS |
| 24 smoke przeglądarkowe + zbudowana aplikacja | to samo SHA | PASS |
| GitHub Fast Gate, Docker, D04, D05, D09 | PR merge `be8f0546cf434c8c3e6f853463b20fdb16b96439` | PASS |
| Rzeczywiste auth/RLS + pobranie PDF z zalogowanego UI w izolowanym D04 | ten sam PR merge | PASS; PDF 1 strona |
| GitHub Release Gate | ten sam PR merge | FAIL: wyścig kolejności zdarzeń w harnessie recovery |
| Poprawiony recovery + rzeczywisty modal/API PartWork | nowszy roboczy checkout | PASS: recovery 3/3 powtórzeń; preflight 400, brak download, fakty bez zmian |
| Produkcyjny Supabase | odczyt metadanych projektu `kierivo` | INACTIVE; odbiór funkcjonalny UNKNOWN |
| Produkcyjne zgłoszenia i advisors | odczyt nie został potwierdzony | UNKNOWN |

Pełny raport lokalny: [release-7e0e44a-report.json](docs/evidence/release-7e0e44a-report.json).
CI: https://github.com/krymszuch-stack/Kierivo/actions/runs/38414098013.
Nowa synchronizacja testu czeka na potwierdzenie CI kolejnego commitu; wcześniejszy
FAIL pozostaje historią. Test czeka na rzeczywisty commit nowego właściciela/linku
przez React przed rozwiązaniem starej operacji, zachowując wszystkie asercje.

Potwierdzone poprawki mają dowody RED → GREEN: brak/uszkodzenie magazynu błędów,
nawrót po `resolved`, oraz eksport `PartWork` bez roli/dat. Cloud count bada także
101 otwartych grup, zamiast okna 100 rekordów. Test UI PartWork używa syntetycznego
kontekstu auth; autoryzację potwierdza odrębny D04, nie ten test.

Blokery odbioru nie są równoznaczne z nowymi zgłoszeniami S1:

- Pełny Release Gate w GitHub musi przejść na końcowym commit/merge SHA.
- Produkcyjne zależności są niepotwierdzone; projekt Supabase jest INACTIVE.
- Pełny odbiór D17/D20 (ledger, niezależność sygnałów) oraz ADR-143 nie został
  zakończony. Mediana legacy jest w UI oznaczona jako wskaźnik kontrolny, nie
  dopasowanie; to nie dowodzi pełnego spełnienia kryteriów tych issues.
- D18: poprawiono eksport PDF niepełnego doświadczenia; nie odebrano wszystkich
  stanów pól ani eksportu drukiem. Nie zamykamy ADR-121 ani ADR-125.

Ograniczenie PDF (S2 do decyzji, bez akceptacji w tej sesji): długi dokument ma
2 strony, 11/31 markerów zachowanych, 20 pominiętych przy limicie i dokładne
ostrzeżenie wymagające potwierdzenia w modalu. Obejrzano obie strony: czytelny
tekst, projekt podzielony między stronami. Nie jest to dowód bezstratnego eksportu
ani pełnej zgodności z wizualnym podglądem. Nie obniżano progów/assertów PDF.

Decyzje właściciela potrzebne później: udostępnienie działającego środowiska do
odbioru produkcyjnych zależności; dedykowana sesja smoke w wymaganym sekrecie;
osobno merge i ręczny deploy dopiero po domknięciu kryteriów. Nie wznowiono
Supabase i nie zmieniono sekretów ani danych produkcyjnych.

## Checkpoint kontynuacji

14.10: CI dla HEAD `152dbd6d0f62441f96cbb4f61f32df0fcb68fdca`, merge SHA
`9eebd6c9921a501ce5518e5dab09b841fec06e1e`: Fast Gate, D04/D05/D09 PASS.
Release Gate [38467971605](https://github.com/krymszuch-stack/Kierivo/actions/runs/38467971605)
FAIL tylko w `browser-cloud-logout-race`; recovery i preflight PDF PASS.
Przyczyna: test sprawdzał DOM po zakończeniu Promise, przed renderem React.
Log błędu potwierdza już konto B i odmowę wymazania nowszej sesji. Test teraz
czeka na wyrenderowany wynik operacji; nie zmienia kolejności zdarzeń sesji
ani asercji ochrony danych. Lokalnie 3/3 powtórzenia PASS; nowy CI wymagany.
Produkcyjny odczyt zgłoszeń zakończył się timeoutem; advisors zwrócił pustą
listę przy nieaktywnym projekcie, co nie potwierdza konfiguracji produkcyjnej.

14.10 D18: odtworzono obejście preflight przez opcję „Drukuj CV” w modalu
(RED: `window.print` wywołane dla PartWork bez roli/dat). Wspólna walidacja
`cvExportPreflight` zabezpiecza teraz API PDF i druk; syntetyczny test realnego
modalu/API GREEN, bez modyfikacji faktów. Vitest 239 plików, 2727 PASS / 1 SKIPPED;
lint 0 błędów / 202 wcześniejsze ostrzeżenia. Pełny D18 nadal nieodebrany.

Następny krok: potwierdzić CI poprawionego logout i drukowania, następnie
zweryfikować nieodebrane kryteria ADR-120/143/123/121 bez rozszerzania funkcji.
ADR-152/125/121 mają aktualizacje Linear; nie ustawiono Done.

### Aktualizacja 14.10, 06:28 CEST

Release Gate **PASS** dla HEAD `d70d577c1657654fa8a97e36d5d0eeac74ab6f49`,
testowanego merge SHA `40feec2353c780314ad23178799afc872e81349c`:
[CI 38511006492](https://github.com/krymszuch-stack/Kierivo/actions/runs/38511006492).
Wszystkie trzy wymagane joby oraz końcowy verdict przeszły, włącznie z Docker,
izolowanym AUTH/RLS i download PDF. Raport: `docs/evidence/release-40feec2-report.json`.
To nie jest odbiór produkcji ani późniejszych zmian kodu.

Kolejna potwierdzona usterka ADR-143: dodanie samego kontaktu podnosiło wynik
kompetencji 62 → 69. Regresja RED, poprawka `canonical-v3`: struktura pozostaje
diagnostyką z wagą zero; proporcje pozostałych wag 40:25:15 zachowano
(0.5 / 0.3125 / 0.1875). V1/V2 pozostają historyczne bez przepisywania wyników.
Regresja GREEN; główny onboarding z/bez kontaktu pokazuje identyczne 78%,
zrzuty `fit-contact-*-2026-10-14.png`. Lokalnie 239 plików / 2728 PASS / 1 SKIPPED,
lint i build PASS przed ostatnią korektą nagłówka wskazówek. Nowe CI wymagane.
Nie jest to pełna kalibracja D17 ani pełny odbiór trzech diagnoz/ledgera D20.

Właściciel wskazał obecne środowisko po przywróceniu go przez siebie.
Nie przywrócono usług i nie zmieniono sekretów. Produkcyjny odbiór nadal UNKNOWN.
Następny krok: CI canonical-v3, następnie odbiór pozostałych kryteriów diagnozy
i źródeł dowodów; po udostępnieniu środowiska test rzeczywistych zależności.

### Aktualizacja 14.10, 11:40 CEST

Cały CI, w tym [Release Gate 38511678096](https://github.com/krymszuch-stack/Kierivo/actions/runs/38511678096),
PASS dla HEAD `dbff67148d03ba3446c5cb941010d1bbdba3c3db` / merge
`829d3af8a054afe23a2754883d4ea37c71ce0421`. Obejmuje canonical-v3 i regresję
niezależności kompetencji od danych kontaktowych.

D18: następne regresje RED ujawniły przepuszczanie doświadczenia bez pracodawcy,
pustej edukacji i projektu bez nazwy. Rozszerzono ten sam preflight API/druk.
Puste sekcje pozostają dozwolone; edukacja trwająca nie wymaga uzyskanego stopnia,
projekt nie wymaga zmyślonej roli. Realny modal/API: 400, brak download/print,
źródło bez zmian — PASS. Lokalny Vitest: 2731 PASS / 1 SKIPPED, 239 plików.
Nowa rewizja wymaga własnego CI; nie dziedziczy powyższego PASS.

### Aktualizacja 14.10, 13:00 CEST

HEAD `31b02d95440ce85c0994163c3ddf0b1ec50cd68d`: wszystkie workflowy PASS,
w tym [Release Gate 38544174600](https://github.com/krymszuch-stack/Kierivo/actions/runs/38544174600)
na merge SHA `83a1dbd01e84e4978098680df5d681950d6e5b5f`.
Opis ADR-125 uzgodniono ze scalonymi PR 138–141; status pozostaje In Progress.

D17: regresja RED wykazała 8 ocen zamiast 6 niezależnie agregowanych modułów.
Mediana/średnia/min/max pomijają teraz dwa pochodne podsumowania, zachowane
w diagnostyce. Nie oznacza to udowodnienia niezależności wszystkich pozostałych
sygnałów. Testowy adapter semantyczny otrzymał pierwszeństwo SIGNIFICANT_GAPS
przed pasmem mediany; zachowano dotychczasowe asercje LOW i progi scenariuszy.
65 testów celowanych PASS; cały Vitest 2731 PASS / 1 SKIPPED (239 plików),
lint 0 błędów / 202 ostrzeżenia, build PASS. Rzeczywisty AtsLabView w Chromium:
mediana 92% z 5 modułów źródłowych, dwa agregaty bez dodatkowego głosu — PASS.
Dowód: `docs/evidence/ats-independent-aggregation.png`; test włączono do Release Gate.

Ten sam ekran wykazuje brak Terraform, a mimo tego pokazuje „Wysokie dopasowanie”.
To kolejny konkretny przypadek do naprawy interpretacji wymagań, nie dowód odbioru
diagnozy. Następny krok: regresja obligatoryjnej umiejętności i spójny komunikat
we wszystkich konsumentach kanonicznego wyniku. Nowy commit wymaga własnego CI.
Decyzja nadal BLOCKED; produkcyjny odbiór i pełna zgodność podglądu/PDF niepotwierdzone.
