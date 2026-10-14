# Kierivo Public Pre-Beta — odbiór ADR-152 / ADR-125

Stan roboczy 13.10.2026: **BLOCKED — odbiór trwa; brak zgody na publikację**.

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

### Najnowszy odbiór — 13.10.2026, 23:06 CEST

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
