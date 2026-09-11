# D07 — Signal → Engine → UI → Source of Truth Map

Data: 2026-09-11  
Status: normatywna mapa migracyjna przed przełączeniem UI na Audit Core

## Cel

CVelocity ma dziś dwa równoległe zestawy procentów w `AtsLabView`. Oba są lokalnymi heurystykami, ale mierzą inne rzeczy i używają innych wzorów. D07 ustanawia jednoznaczną zasadę migracji: po wdrożeniu D08–D17 produkcyjnym źródłem score jest wyłącznie Audit Core i jego `ScoreLedger` / `GlobalConsensusResult`.

Frontend nie może zestawiać dwóch różnych liczb tak, jakby były alternatywnymi pomiarami tego samego wymiaru.

## 1. Obecny przepływ A — `simulateMultiEngineATS`

### Wejście

```text
MasterVault + jobOfferText + targetRole
```

### Silnik

```text
src/lib/atsSimulator.ts
simulateMultiEngineATS(...)
```

### Konsumenci UI

`src/features/ats/AtsLabView.tsx` używa tego wyniku do:

- `consensus.medianScore` jako „Mediana modułów”,
- `meanScore`, `minScore`, `maxScore`,
- kart poszczególnych `consensus.engines`,
- `summaryJustification`,
- `careerFitAdvice`.

### Status D07

`LEGACY_HEURISTIC`.

Nie jest źródłem prawdy Audit Core. Nie posiada pełnego `Evidence Graph`, `MissingEvidence`, canonical `Applicability`, centralnego confidence, anti-double-dipping, domenowego consensus ani Score Ledgera.

### Zidentyfikowane problemy wzorów

Przykłady z aktualnego kodu:

- `struktura_ocr` łączy strukturę z binarnym bonusem/karą za ostrzeżenia OCR;
- moduł formalny ma dodatnie floor-y za brakujące klasy danych;
- `metryki_liczbowe` daje istotny wynik za samo wykrycie tokenów liczbowych;
- `naturalnosc_jezyka` ma dyskretny próg `hardCoverage > 95 && !hasMetrics`, który może wywołać duży skok wyniku;
- `spojnosc_profilu` nie jest wynikiem pełnego consistency engine, mimo takiej etykiety komponentu;
- `przesiew_wymagan` ponownie wykorzystuje część tych samych sygnałów, co zwiększa ryzyko cross-module double counting.

Te formuły są migrowane moduł po module w D08–D17. D07 ich nie „naprawia po cichu”.

## 2. Obecny przepływ B — `buildAtsTelemetryReport`

### Wejście

```text
MasterVault + jobDescription + opcjonalny cvRawText
```

### Silnik

```text
src/lib/atsScorer.ts
buildAtsTelemetryReport(...)
```

### Konsumenci UI

`AtsLabView` pokazuje oddzielnie:

- `telemetry.overallScore` jako „Wynik telemetrii”,
- breakdown: pokrycie lematów 40%, doświadczenie/metryki 25%, struktura 20%, sprawczość języka 15%,
- knockout penalties,
- telemetry językową,
- telemetry strukturalną,
- trzy profile heurystyczne.

### Status D07

`TRANSITIONAL_DIAGNOSTIC`.

Ten silnik jest bardziej mierzalny niż stary consensus, ale nadal nie jest canonical Audit Core. Nie powinien być przedstawiany jako drugi „równoległy global score” po wdrożeniu nowego core.

Dane diagnostyczne, które są wartościowe, mogą zostać zachowane jako extractors/signals pod warunkiem migracji ich provenance i ownership do kontraktu D07.

## 3. Docelowy przepływ C — Audit Core 1.0

### Wejście

```text
raw CV / Vault / JD
  ↓
extractors + normalizers
  ↓
scoped canonical signals
  ↓
Evidence Graph + MissingEvidence
  ↓
pure module scorers D08–D16
  ↓
domain aggregation
  ↓
D17 GlobalConsensusResult
```

### Source of Truth

```text
AuditModuleResult
DomainResult
GlobalConsensusResult
ScoreLedger
```

Status: `CANONICAL_SOURCE_OF_TRUTH`.

Frontend renderuje wynik zwrócony przez core. Nie liczy median, wag, penalties ani capów samodzielnie.

## 4. Mapa migracji modułów

| Obecny sygnał / karta | Dzisiejszy silnik | Docelowy owner Audit Core | Docelowa domena | Status przejściowy |
|---|---|---|---|---|
| struktura / OCR / reading order | `struktura_ocr` + telemetry structure | D08 `MOD_STRUCTURAL_READABILITY` | DOCUMENT_QUALITY | legacy score → diagnostic only |
| słowa kluczowe / lematy | `slowa_kluczowe_fleksja` + telemetry lemmas | D09 `MOD_KEYWORDS_REQUIREMENTS` | JOB_FIT | migracja później |
| kryteria formalne | `kryteria_formalne` + knockouts | D10 `MOD_FORMAL_REQUIREMENTS` | FORMAL_READINESS | migracja później |
| świeżość umiejętności | `swiezosc_umiejetnosci` | D11 `MOD_SKILL_RECENCY` | JOB_FIT | migracja później |
| tytuł / seniority | `zgodnosc_tytulu` | D12 `MOD_ROLE_SENIORITY` | JOB_FIT | migracja później |
| liczby / KPI | `metryki_liczbowe` | D13 `MOD_METRICS_EVIDENCE` | EVIDENCE_QUALITY | migracja później |
| naturalność / stuffing | `naturalnosc_jezyka` | D14 `MOD_LANGUAGE_NATURALNESS` | DOCUMENT_QUALITY | migracja później |
| spójność | `spojnosc_profilu` | D15 `MOD_CONSISTENCY` | INTEGRITY | migracja później |
| quick readiness | `przesiew_wymagan` | D16 orchestration | FORMAL_READINESS | nie może być drugim pełnym głosem |
| mediana/średnia wszystkich kart | `simulateMultiEngineATS` | D17 domain consensus | GLOBAL | do usunięcia jako score source |

## 5. Zasada D08

Po migracji D08:

- `MOD_STRUCTURAL_READABILITY.score` jest jedynym score struktury;
- `atsScorer.structuralTelemetry` może istnieć wyłącznie jako źródło diagnostyczne/extractor, jeśli zostanie jawnie wpięte w D08;
- `struktura_ocr.score` nie może równolegle występować jako drugi wynik „struktury”;
- każdy widoczny wynik D08 musi mieć Score Ledger i Evidence IDs.

## 6. Zasada UI podczas migracji

Dopóki pełny Audit Core nie zastąpi legacy UI:

1. legacy wyniki muszą być jawnie opisane jako lokalne heurystyki;
2. nie wolno nazywać ich prawdopodobieństwem przejścia ATS/rekrutacji;
3. nowy moduł DXX po odbiorze zastępuje odpowiadający mu legacy score zamiast dokładać trzeci procent;
4. diagnostyka może pozostać, ale bez udawania niezależnego głosu scoringowego;
5. po D17 globalny wynik pochodzi tylko z `GlobalConsensusResult`.

## 7. Kryterium migracji źródła prawdy

Legacy source może zostać usunięte ze scoring UI dopiero, gdy odpowiadający mu moduł Audit Core ma:

- scoped signals,
- Evidence Graph,
- applicability,
- confidence,
- Score Ledger,
- corpus tests,
- drift report,
- zielone CI.

D07 ustanawia mapę. D08 rozpoczyna faktyczne przepinanie pierwszego wymiaru.