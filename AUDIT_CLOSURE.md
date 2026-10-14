# Kierivo Public Pre-Beta — odbiór ADR-152 / ADR-125

Stan 14.10.2026: **BLOCKED — odbiór trwa; brak zgody na publikację**.

Potwierdzony S1 na stronie publicznej po rzeczywistym logowaniu: eksport
`POST /api/cv/export-pdf` zwraca HTTP 500. Renderer zgłasza brak Georgia,
Georgia-Bold i SegoeUI/Bold/Semibold. Obraz runtime nie instaluje fontów DejaVu,
których wymaga istniejący fallback na Linuksie. Obraz instaluje teraz
`fonts-dejavu-core`. Wymagany CI po zbudowaniu obrazu wykonuje rzeczywisty
eksport i ścisłą weryfikację PDF jako użytkownik node. Lokalny eksport/
weryfikacja CLI PASS (2 strony, 37 elementów semantycznych). Docker nie jest
dostępny lokalnie; poprawkę kontenera odebrano w GitHub CI wskazanym poniżej.
Eksport obecnej produkcji pozostaje FAIL do zatwierdzonego wdrożenia i smoke.

Ostatni kompletny odbiór kodu: `d1cc1e7cba6c263ba58c4e5629bbee47dda21aba`.
Lokalny Release Gate PASS, Vitest 2736 PASS / 1 SKIPPED, Python 46/46,
PDF API 19/19, 28 scenariuszy przeglądarkowych i built smoke PASS.
Raport: `artifacts/release-d1cc1e7cba6c263ba58c4e5629bbee47dda21aba/report.json`.
Wszystkie sześć workflowów GitHub PASS; [Release Gate 38636624103](https://github.com/krymszuch-stack/Kierivo/actions/runs/38636624103).
Funkcjonalny eksport i ścisła weryfikacja PDF wewnątrz obrazu runtime PASS
w [CI 38636624084](https://github.com/krymszuch-stack/Kierivo/actions/runs/38636624084), job 116101321304, krok 12.
Nie oznacza to odbioru późniejszych zmian ani produkcji.

Kolejna poprawka D17: dodanie brakującego Terraform do oferty z Python
obniżało świeżość ze 100 do 85 mimo niezmienionych dat. Pokrycie wymagań było
ponownie ważone w modułach aktualności (30%) i tytułu (25%). Te moduły mierzą
teraz wyłącznie własny sygnał; pokrycie ma osobny moduł. RED → GREEN;
2733 testy PASS / 1 SKIPPED, lint/TypeScript i build PASS. Rzeczywisty AtsLabView
oraz onboarding PASS, zrzuty `docs/evidence/ats-independent-aggregation.png`
i `ats-mandatory-skill-onboarding.png`. CI/Gate powyżej obejmuje tę poprawkę.
Nie zmieniono progów ani oczekiwań wcześniejszych testów.

Smoke działającej strony ujawnił dwa błędy importu tekstu: z „ADR-152”
powstawała umiejętność ADR, a daty po nazwie uczelni i stopniu tworzyły drugą,
pustą edukację. Reprodukcje RED → GREEN. Wspólny matcher pomija identyfikator
ze skrótem i numerem; osobny prawdziwy dowód nadal liczy się. Parser zachowuje
jedną szkołę z datami także przy kolejności zakres → uczelnia → stopień.
Lokalnie 2736 PASS / 1 SKIPPED, lint/TS i build PASS. Rzeczywisty modal importu
przez ekran różnic do MasterVault PASS; dowód `docs/evidence/cv-import-source-facts.png`.
Dodano go jako 28. scenariusz Release Gate; odbiór `d1cc1e7` powyżej go obejmuje.

Wcześniejsze wklejki: ponownie potwierdzono sumy wszystkich sześciu plików.
Duży schowek zawiera 2985 fragmentów, lecz 126 różnych treści po pominięciu
samego nagłówka kopii. Stały test bada wszystkie 126, bez dawnego limitu 300
fragmentów; tekst nie może zniknąć do pustego wyniku. Zbiór praktyczny ma
dokładnie 33 sekcje. Dodatkowe kontrole ofert 2/16 w pełnym potoku przygotowania
potwierdzają wymagane C/UDT i blokadę profilu z negacją uprawnień. Wklejek nie
zmieniono. Regresje korpusu 26/26 PASS; cały Vitest 2739 PASS / 1 SKIPPED.
To pokrycie wybranych kontraktów, nie dowód idealnego odczytu wszystkich ofert.
Wyniki nowych testów nie są wynikiem CI nowego commitu. Następny krok:
potwierdzić CI rozszerzonego korpusu, następnie odebrać zgodność widoku pliku
PDF z pobieranym artefaktem oraz sprawdzić, które pozostałe kryteria D20 są
przyszłym rozwojem, a które są potwierdzonym błędem bieżącego produktu.

Supabase **ACTIVE_HEALTHY**. Odczyt telemetrii: 1 OPEN / 8 wystąpień błędu
importu modułu, ostatnie 06.10; przyczyna nieustalona, nie zamknięto zgłoszenia.
ADR-127: ochrona ujawnionych haseł nadal wyłączona. Polityki właścicielskie
profiles/vaults/applications odczytano; to nie jest test izolacji dwóch kont.
Właściciel zalogował konto i zezwolił na zastąpienie CV danymi syntetycznymi.
Konflikt lokalnej/chmurowej wersji rozwiązano wyborem chmury; UI potwierdził
zapis. AI `/api/ai/verify-cv` odpowiedział 200; bez JD UI wstrzymał dopasowanie
i jawnie wykluczył ocenę pliku PDF. Eksport publiczny FAIL opisano wyżej.
Testowana strona publiczna nie zawiera
jeszcze PR #142. Nie zmieniono produkcyjnych sekretów ani uprawnień.

Pozostałe kryteria odbioru: D17/D20 i ADR-143, pełna zgodność podglądu/PDF,
końcowy Gate oraz rzeczywiste zależności. Długi PDF wymaga jawnej zgody na
skrócenia i nie dowodzi bezstratnej zgodności z podglądem. Nie wykonano merge
ani deploy. ADR-152/125 pozostają otwarte; bieżące dowody uzupełniono w Linear.
Historia poniżej odnosi się wyłącznie do podanych SHA.

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
