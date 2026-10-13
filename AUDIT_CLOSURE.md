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

Aktualizacja 13.10, 16:28 CEST: **BLOCKED / kandydat roboczy**. Lint/TypeScript,
pełne Vitest (238 plików, 2722 PASS, 1 SKIPPED) i build ponownie przeszły po
preflight PDF. Actionlint 1.7.12: PASS. Nie jest to jeszcze odbiór czystego SHA.

Naprawy w bieżącym PR: telemetria fail-closed + pełny count + ponowne otwarcie
nawrotu; preflight wpisu doświadczenia bez stanowiska/dat (ADR-121, RED → GREEN);
powtarzalny runner, golden 24 PL/EN, konfiguracja syntetycznych smoke i izolowany
uwierzytelniony eksport PDF. Druga próba przeglądarkowa wykryła konflikt HMR;
runner używa teraz istniejącego DISABLE_HMR i losowych portów. Błędy strony
pozostają asercją, nie są ignorowane.

Release Gate uruchamia się ręcznie, dla PR zmieniającego ten raport/workflow,
oraz jako wymagana zależność ręcznego deploy. Zwykły PR zachowuje Fast Gate i D04.
Lokalne workflow_call korzystają z tego samego commitu; deploy wymaga ich sukcesu.
Przed zmianą Azure wymagana jest też produkcyjna telemetria i sekret
`RELEASE_SMOKE_STORAGE_STATE` dedykowanego konta syntetycznego. Nie utworzono
tego sekretu ani nie zmieniono uprawnień produkcji. Sesja ma odpowiadać docelowemu
origin i zachować ważność podczas wdrożenia; jej brak blokuje deploy przed zmianą.

Otwarte kryteria odbioru: rzeczywisty D04/PDF w CI, czysty SHA Release Gate,
pełna zgodność wizualnego podglądu i PDF, rozdzielenie diagnoz/ledger D17/D20
(ADR-120/143/123) oraz pozostałe kryteria kompletności D18. Obecny legacy
`simulateMultiEngineATS` nadal liczy medianę ocen skorelowanych modułów i ich
agregatu. Nie uznajemy pełnej matematyki audytu za odebraną na podstawie samych
testów regresyjnych. Produkcja/OAuth/AI pozostają UNKNOWN.

| Kontrola | Status | Zakres |
|---|---|---|
| Bazowe Vitest na main | PASS | 235 plików, 2686 testów |
| Bazowa integracja PDF w zwykłym npm test | SKIPPED | Wymaga osobnego RUN_PDF_INTEGRATION=1 |
| Bramka telemetryczna przed poprawką | FAIL | 4 nowe regresje: brak pliku/źródła, uszkodzony JSONL, fałszywa deklaracja gotowości |
| Bramka telemetryczna po poprawce | PASS | 4/4; dalsze przypadki w toku |
| Golden CV/JD PL/EN | PASS | 24 scenariusze; brak halucynowanych faktów, negacje, MUST/NICE, SEP/UDT/spawacz, deterministyczność |
| Pierwszy Fast Gate w roboczym checkout | FAIL | Nieaktualny selector aria oraz fixture niezgodny z obecnym schematem w starym E2E |
| Zalogowany eksport z lokalnego trybu anonimowego | UNKNOWN | UI celowo wymaga cloud tokenu; nie obchodzimy uwierzytelniania |
| Produkcyjna telemetria / OAuth / AI | UNKNOWN | Nie badano w tej sesji |

Nowe wyniki runnera znajdują się w `artifacts/<fast|release>-<sha>/report.json`
oraz logach obok. Brudny checkout jest UNKNOWN; dopiero czysty commit nadaje się
do odbioru SHA. Są to wyniki syntetyczne, nie certyfikat produkcji.

## Checkpoint dla kontynuacji

Wykonano rozpoznanie AGENTS.md, reguł, architektury, workflow, ADR-152/125/143/121/120
i listy projektu Linear. ADR-152 ustawiono In Progress; ADR-125 dostał korektę stanu PR.

W toku (nieodebrane): runner scripts/release-gate.mjs, workflow release-gate.yml,
same-commit zależność deploy, read-only telemetry fail-closed, golden corpus,
naprawa starego smoke bez obniżania wymagań, prawdziwy download UI w izolowanym D04.

Najbliższe kroki:
1. Odczytać log `../release-initial.log` i `artifacts/release-00a4ccb...`; naprawić
   rzeczywiste błędy, odróżniając stare testy od regresji produktu.
2. Dokończyć regresje telemetrii (cloud count, starszy otwarty błąd, nawrót).
3. Zwalidować workflow (YAML/actionlint i test zależności deploy), ograniczyć powielanie
   wywołań CI/D04 oraz zadbać o smoke produkcyjny z dedykowaną sesją testową.
4. Ustalić rzeczywisty wielostronicowy PDF i obejrzeć artefakt. Obecny long-CV script
   testuje też jawne skracanie; to nie jest dowód zachowania całej treści.
5. Zweryfikować ADR-121/143/120 i macierz D07–D20 względem obecnego kodu/testów.
6. Lint/test/build, commit, gate na czystym SHA, push wyłącznie gałęzi i PR, wyniki CI.
7. Uzupełnić dowody w docs/04.09.2026.md, ten raport i Linear. Done wyłącznie po odbiorze.

Lokalne środowisko: Node 24.19.0, Python 3.14.7 w `.venv`, Playwright przypięty
1.58.2. CI: Node 22 / Python 3.11. Docker nie był dostępny przez PATH; izolowany
Supabase i rzeczywisty login/PDF będą wymaganym jobem CI, nie lokalnym PASS.

## Pozostałe decyzje właściciela

Brak prośby o zatwierdzenie na obecnym etapie. Najpierw kończymy dozwolone prace.
Merge i produkcyjny deploy pozostają osobnymi, zastrzeżonymi akcjami.
