# Kierivo Public Pre-Beta — ADR-152 / ADR-125

Stan 15.10.2026: **BLOCKED z przyczyn operacyjnych**. Kandydat przeszedł
końcowy odbiór CI; nie ma zgody na merge do main, migrację produkcyjną ani wdrożenie.

Kod aplikacji: `53d4c6b7b3b7d8bd4ff111fc6561e99cd69dfb43`;
odebrany pakiet testów i dowodów: `e2ee63826616cd23f82f70dfb628195cb534844c`.
Późniejszy commit tego raportu nie zmienia kodu ani bramek. Wiążący wynik
wydania musi pochodzić z Release Gate dla pełnego SHA publikowanego w PR.
[Zbiorczy PR #142 i jego checks](https://github.com/krymszuch-stack/Kierivo/pull/142/checks).
Workflow PR testuje syntetyczny merge GitHuba; pełny SHA wykonania zapisuje
artefakt Gate. Dla odebranego HEAD `e2ee638` był to
`5b083d41c7090160cba4b949e65dd87e25005f68`; sprawdzono identyczne drzewo
`933e51c78516399623339081ed087ab49c1d5720`.
Deploy ponawia cały wymagany Gate już dla faktycznego commitu main.
Main ponownie pobrany: `00a4ccb4590d754a90e8a5e65e5e31f39a3ad63f`.
PR #138–#141 są scalone; #141 od 09.10.2026. Nie opieramy statusów na starych opisach.

## Zakres i granice

Parser CV/JD → MasterVault → diagnoza poparta danymi → generator/podgląd →
PDF; uwierzytelnianie, izolacja, logout/delete, regresje i bezpieczne wydanie.
D07–D20: zachowanie dostępnego produktu; bez deklaracji pełnej kalibracji ATS.
Poza wydaniem: Gigs, Hunter Autofill, Jobs, publiczny Trust, Kotlin, CzyToTy,
nowe funkcje komercyjne i przebudowa UI. Pełny przyszły ledger D20 pozostaje
ADR-123; nie przedstawiamy go jako zaimplementowanego.

S0/S1 blokują wydanie. S2/S3 wymagają opisanego ryzyka i akceptacji właściciela.
Brak danych, N/A i INSUFFICIENT_DATA nie są pozytywną oceną. Wynik dopasowania
nie jest szansą zatrudnienia ani symulacją prywatnego ATS. Dane użytkownika
nie stają się niezależnie zweryfikowane przez samo użycie AI.

## Potwierdzone naprawy

| Obszar | Przyczyna i zmiana | Dowód |
| --- | --- | --- |
| Diagnoza / D17 | Brak MUST ogranicza pozytywny komunikat; agregaty nie głosują ponownie w medianie; aktualność i tytuł nie liczą drugi raz pokrycia | Regresje jednostkowe, golden corpus, prawdziwy onboarding i AtsLab; etykieta liczby uwag nie udaje liczby odjęć |
| Import CV/JD | ADR-152 nie tworzy umiejętności ADR; wieloliniowa edukacja zachowuje szkołę i daty | FAIL → PASS, rzeczywisty modal importu → różnice → Vault; niezmienione surowe wklejki |
| PDF runtime | Obraz nie miał fontów fallback; dodano fonts-dejavu-core i eksport/weryfikację wewnątrz obrazu jako node | CI Docker PASS na d1cc1e7 i kolejnych odebranych SHA; produkcja jeszcze bez poprawki |
| Podgląd PDF | Przygotowany Blob renderowany na stronach PDF.js; pobierany ten sam Blob po decyzji; zmiana źródła/konta unieważnia plik | FAIL → PASS; 2 strony, równe SHA-256, jedno wywołanie renderera, brak automatycznego pobrania |
| S0 / ADR-153 | docVault pozostawał po zmianie lokalnego konta; edytor należy teraz do właściciela, także przy logout i opóźnionym odczycie | #144: A → B → reload → A, widok i rzeczywisty schowek; pełny CI 112e2a8 PASS |
| S1 / ADR-154 | Konflikt wysyłki A nadpisywał nowszy pending B i odtwarzał usunięty wpis; catch zachowuje najnowszy istniejący snapshot | #145: dwie regresje FAIL → PASS, 52 testy sąsiednie, prawdziwy outbox → ponowny odczyt UI → wybór B → zapis B |
| Limit AI | Pierwsze równoległe wywołania nie blokowały nieistniejącego wiersza; INSERT ON CONFLICT DO NOTHING przed SELECT FOR UPDATE | #146: D04 0bd76a0 FAIL (1/0), feb4c1b PASS (dokładnie 5/5), bez retry i zmiany limitu |

Szczegółowe małe PR: [#144](https://github.com/krymszuch-stack/Kierivo/pull/144),
[#145](https://github.com/krymszuch-stack/Kierivo/pull/145),
[#146](https://github.com/krymszuch-stack/Kierivo/pull/146).
Migracja zastępuje istniejącą funkcję, zachowuje ACL i dalszą politykę;
bez zmian tabel, GRANT/REVOKE i kasowania danych. Nie wykonano jej na produkcji.

## Sprawdzenia i ich rzeczywisty zakres

| Kontrola | Status i SHA |
| --- | --- |
| Końcowy wspólny odbiór e2ee638 / merge 5b083d4 | [Release Gate 38677631038](https://github.com/krymszuch-stack/Kierivo/actions/runs/38677631038) PASS, wszystkie 6 workflowów SUCCESS. Vitest 2742 PASS / 3 SKIPPED; osobny PDF API 21/21 obejmuje te trzy integracje; Python 46/46, 31/31 browser checks, build i built smoke PASS. Zależne CI/Docker oraz Auth/RLS/PDF PASS. Oryginalny artefakt: release-gate-5b083d41c7090160cba4b949e65dd87e25005f68 |
| Lokalny lint/TS, build, pełny Vitest kandydata kodu | PASS; 239 plików, 2742 PASS / 3 SKIPPED; 202 wcześniejsze ostrzeżenia, 0 błędów |
| Trzy integracje PDF pomijane w zwykłym Vitest | Wykonane osobno z RUN_PDF_INTEGRATION=1; DOCX/PDF 34/34 PASS na 112e2a8; później eksporty niezmienione |
| Pełny lokalny Release Gate | 4eb4ca0 PASS: 29 przeglądarkowych, Python 46/46, PDF API, build, built smoke; artifacts/release-4eb4ca0d98a7ac45460cda1c41fcabda6553bdb6/report.json |
| Pełny CI izolacji i eksportów | [112e2a8 / 38674580531](https://github.com/krymszuch-stack/Kierivo/actions/runs/38674580531) PASS: release-acceptance, CI, Auth/RLS, verdict |
| CI outboxu | [0bd76a0 / 38675032473](https://github.com/krymszuch-stack/Kierivo/actions/runs/38675032473) FAIL: quota D04; release-acceptance i CI PASS. Nie zamaskowano tego wyniku |
| D04 po migracji | [feb4c1b / 38675814638](https://github.com/krymszuch-stack/Kierivo/actions/runs/38675814638) PASS: quota 5/5, RLS, usunięcie konta/stary token, zalogowane CV → diagnoza → podgląd → PDF |
| Historyczny CI HEAD 28f9a36 / merge 3a9d397 | 5 workflowów PASS; [Release Gate 38676502658](https://github.com/krymszuch-stack/Kierivo/actions/runs/38676502658) FAIL na wyścigu harnessu chronologii. Bootstrap App po odczycie IDB próbował użyć kontenera usuniętego przez własny widok testu. Harnessy izolują teraz własny start, bez ignorowania pageerror; trzy próby chronologii lokalnie PASS. Poprawiony Gate odebrano na e2ee638 powyżej |
| Niepełna chronologia | Istniejące e2e-ats-timeline-status i e2e-consistency-timeline-unknown PASS; null i jawny zakres zamiast fikcyjnej oceny. Włączone do końcowego Gate (łącznie 31 scenariuszy) |
| Bajty eksportów | PDF standard/dual-layer: tekst wszystkich stron, metadane, brak załączników; DOCX: wszystkie wpisy ZIP; dwa mechanizmy TXT. Pominięte markery nie występują, źródło zachowane |
| PDF po zmianie właściciela | Rozszerzono istniejący test rzeczywistego podglądu: po A przygotowuje i pobiera nowy plik B; marker B obecny, nazwisko A nie występuje w tekście/metadanych, brak załączników, hash zgodny z podglądem. PASS lokalnie; syntetyczny kontekst auth, prawdziwy modal/API/Python |
| Surowy korpus parsera | 6 sum zgodnych z README; duży schowek: 2985 fragmentów / 126 różnych treści; Aplikuj: dokładnie 300 fragmentów; praktyczny: 33 sekcje; PL/EN i negatywne C/UDT |
| Produkcyjna telemetria | FAIL: 1 OPEN d1a27e2fbc8aa52a, 8 ui-crash/AppErrorBoundary, ostatni 06.10.2026 20:54:21 UTC. Brak dowodu przyczyny/powiązania z obecnym SHA; nie ustawiono resolved |
| Produkcyjne OAuth/AI | Ostatni rzeczywisty smoke: zapis syntetycznego Vaultu i AI verify-cv 200. Nie stanowi pełnej kalibracji ani odbioru nowego kandydata |
| Produkcyjny eksport kandydata | UNKNOWN — kandydat niewdrożony. Obecna strona miała HTTP 500 brakujących fontów. Wymagany smoke po osobno zatwierdzonym wydaniu |
| Lokalna baza / Docker | SQL i kontener lokalnie UNKNOWN; rzeczywisty odbiór w izolowanym CI. Niczego nie testowano destrukcyjnie na produkcji |
| Konfiguracja wdrożenia | PASS konfiguracji dwóch zatwierdzonych sekretów wyłącznie w GitHub production: RELEASE_SMOKE_STORAGE_STATE (15.10.2026 10:02:54 UTC) i SUPABASE_SERVICE_ROLE_KEY (10:06:55 UTC). Oba HTTP 201 i ponowny odczyt metadanych. Szyfrowanie sealed box kluczem środowiska; stan logowania właściwego konta testowego dla kierivo.com bez lokalnego CV; sprawdzono projekt/rolę istniejącego klucza Supabase. Bez jawnych wartości na dysku/w dowodach, bez zmiany kluczy Supabase. Rzeczywista istniejąca bramka --required --cloud z tym kluczem odczytała źródło i zwróciła FAIL / exit 1: jedna otwarta grupa; artifacts/production-telemetry-secret-check.json. To nie jest test dostępu sekretu wewnątrz runnera ani smoke po deploy. Azure nie uruchamiano |

N/A: kontrakt nie ma flag private/visible. Testowano faktycznie usunięte dane
z projekcji i pominięte pola wewnętrzne claims/subRoleId; nie deklarujemy funkcji
prywatnych pól. Globalny Word z palety eksportuje MasterVault, edytor własną projekcję.
Nie potwierdzono równoczesnej edycji jednego profilu w dwóch kartach;
serializacja outboxu dotyczy jednej karty, serwer używa CAS i jawnego konfliktu.

## Release Gate i decyzja

FAST: lint/TS, krytyczne regresje ATS/faktów i zmienione moduły, build,
krótki smoke, kontrola znanych wzorców sekretów w bundlu (nie pełnej historii).
RELEASE: pełne testy, Python/PDF API i wielostronicowy dokument, PL/EN golden,
negatywne scenariusze, 31 istniejących E2E, built smoke i osobny Auth/RLS/PDF.
Raporty zawierają SHA oraz PASS/FAIL/SKIPPED/UNKNOWN; lokalne UNKNOWN usług
zewnętrznych i SKIPPED produkcyjnej telemetrii nie są PASS tych kontroli.

Deploy jest ręczny i zależy od wymaganych workflowów dla tego samego commitu;
ma własną bramkę telemetrii oraz uwierzytelniony smoke po wdrożeniu.
HTTP 200 / health nie wystarcza. Merge do main oraz produkcyjne wdrożenie
pozostają zastrzeżone właścicielowi. PR #143 dotyczy instrukcji agentów i pozostaje osobny.

Zatwierdzona konfiguracja dwóch sekretów została wykonana; rzeczywisty odczyt
telemetrii potwierdzony. Nie ma już blokera braku tych sekretów.
Sesja smoke zawiera refresh token; jej trwałość po rotacji/wylogowaniu nie jest gwarantowana,
a obecność sekretu nie oznacza wykonanego smoke po wdrożeniu. Następnie trzeba
rozstrzygnąć historyczną otwartą telemetrię bez fikcyjnego resolved i zaakceptować ograniczenia.
Długi PDF nadal wymaga jawnej zgody na skrócenie: istniejąca próbka zachowuje
11/31 markerów i jawnie zgłasza 20 pominięć, a rzeczywisty podgląd pokazuje wynik.
ADR-127 (ochrona ujawnionych haseł) pozostaje otwarte; ustawień nie zmieniono.
ADR-152 i ADR-125 nie są Done. Decyzja wydania pozostaje BLOCKED z powodów
nierozstrzygniętej telemetrii i braku odbioru kandydata na produkcji; pozytywny
odbiór kodu nie potwierdza stanu produkcji.

Historia, macierz race/revision, szczegółowe SHA i wcześniejsze ograniczenia:
[AUDIT_CLOSURE_HISTORY.md](docs/evidence/AUDIT_CLOSURE_HISTORY.md).
