# D07 FINAL SPEC v2 — Audit Core 1.0

Status: **normatywna specyfikacja przed implementacją**  
Data: 2026-09-11  
Zakres: D07, fundament dla D08–D17 oraz wejściowy kontrakt dla D18–D19

---

## 0. Cel D07

D07 nie ma „poprawiać wyniku ATS”. Ma zbudować matematycznie i logicznie poprawny fundament, który uniemożliwi powstawanie efektownych, ale nieuzasadnionych procentów.

Audit Core ma być:

- deterministyczny,
- audytowalny,
- odporny na brak danych,
- odporny na gaming,
- rozdzielający score od confidence,
- jawny co do evidence i provenance,
- pozbawiony vendorowego udawania zewnętrznych ATS,
- skalibrowany na golden corpus,
- testowany relacyjnie, a nie tylko przez oczekiwanie „ładnego wyniku”.

**Główna zasada:** jeżeli nie umiemy uzasadnić, skąd pochodzi punkt, punkt nie może istnieć.

---

# 1. Architektura przepływu

```text
RAW INPUTS
  ├─ Target CV Document AST
  ├─ Master Vault
  └─ Job Specification / JD (opcjonalne zależnie od trybu)
        ↓
EXTRACTORS
        ↓
CANONICAL NORMALIZED SIGNALS
        ↓
EVIDENCE GRAPH + MISSING EVIDENCE
        ↓
PURE MODULE SCORERS
        ↓
PENALTY ENGINE
        ↓
MODULE / DOMAIN / GLOBAL HARD CAPS
        ↓
MODULE RESULTS
        ↓
DOMAIN AGGREGATORS
        ↓
GLOBAL CONSENSUS
```

Scorer **nigdy** nie czyta bezpośrednio `MasterVault`, surowego CV ani JD. Otrzymuje wyłącznie jawnie typowany pakiet sygnałów swojej domeny.

To jest twarda granica architektoniczna.

---

# 2. Tryby audytu

D07 wprowadza jawny `AuditMode`, ponieważ brak JD nie może być raz traktowany jako N/A, a innym razem jako brak danych.

```ts
export type AuditMode =
  | 'GENERAL_CV'
  | 'TARGETED_APPLICATION';
```

## GENERAL_CV

Ocena jakości samego dokumentu i profilu.

Moduły wymagające JD mogą być `NOT_APPLICABLE` i ich wagi można legalnie wyłączyć z konsensusu.

## TARGETED_APPLICATION

Ocena CV względem konkretnego ogłoszenia.

Brak JD nie jest `NOT_APPLICABLE`. Jest błędem danych wejściowych dla tego trybu i prowadzi do `INSUFFICIENT_DATA` dla domeny dopasowania.

Dzięki temu brak danych nigdy nie podnosi wyniku przez przypadkową renormalizację wag.

---

# 3. Źródła danych i provenance

Master Vault jest źródłem kanonicznym dla aplikacji, ale **nie jest automatycznie ground truth**.

D07 rozróżnia:

```ts
export type EvidenceProvenance =
  | 'USER_ASSERTED_CANONICAL'
  | 'EXPLICIT_DOCUMENT_FACT'
  | 'CROSS_SOURCE_CONSISTENT'
  | 'DERIVED_DETERMINISTIC'
  | 'EXTERNALLY_VERIFIED'
  | 'INFERRED_HEURISTIC'
  | 'CONTRADICTION'
  | 'ADVERSARIAL_SIGNAL';
```

`USER_ASSERTED_CANONICAL` oznacza: użytkownik podał fakt i CVelocity traktuje go jako własne źródło referencyjne, ale nie twierdzi, że fakt został zweryfikowany zewnętrznie.

`EXTERNALLY_VERIFIED` można użyć dopiero, gdy produkt faktycznie posiada mechanizm weryfikacji.

---

# 4. Kanoniczne daty

Nie używamy dat zakodowanych jako liczby typu `2022.25`.

Wszystkie operacje miesięczne wykorzystują całkowity indeks miesiąca:

```ts
export type MonthIndex = number;

export function toMonthIndex(year: number, month1to12: number): MonthIndex {
  return year * 12 + (month1to12 - 1);
}
```

D07 wymaga jawnego `referenceDate` / `referenceMonth` w każdym przebiegu audytu.

```ts
export interface AuditRunContext {
  auditRunId: string;
  engineVersion: string;
  mode: AuditMode;
  referenceMonth: MonthIndex;
}
```

Dzięki temu test wykonany dziś i za rok daje identyczny rezultat dla tego samego `referenceMonth`.

---

# 5. Evidence Graph

Każdy score component, penalty i hard cap musi wskazywać dowody.

```ts
export interface SourcePointer {
  source: 'CV' | 'VAULT' | 'JOB';
  jsonPath: string;
  charStart?: number;
  charEnd?: number;
}

export interface Evidence {
  id: string;
  provenance: EvidenceProvenance;
  pointer: SourcePointer;
  description: string;
  normalizedPayload?: Record<string, string | number | boolean | null>;
  extractionConfidence: number; // 0..1
}
```

## 5.1. PII

Evidence Graph nie zapisuje automatycznie pełnych `rawSnippet` zawierających e-mail, telefon, nazwisko lub inne PII.

Do diagnostyki preferujemy:

- pointer,
- znormalizowany payload,
- opcjonalny zredagowany snippet,
- hash treści.

## 5.2. Deterministyczne ID

Nie używamy losowego ani rotowanego saltu do identyfikatorów regresyjnych.

```text
EvidenceId = SHA256(
  engineSchemaVersion || source || jsonPath || canonicalPayload || provenance
).slice(0, 20)
```

Ten sam sygnał w tej samej wersji schematu ma zawsze ten sam identyfikator.

---

# 6. Missing Evidence

```ts
export interface MissingEvidence {
  id: string;
  requirementCode: string;
  targetScope: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expectedEvidenceWeight: number;
  suggestedAction: string;
}
```

Brak dowodu nie jest automatycznie karą.

Może:

1. obniżyć coverage,
2. obniżyć confidence,
3. zmienić applicability,
4. uruchomić hard cap, jeżeli brak dotyczy krytycznego warunku.

---

# 7. Applicability

```ts
export type ApplicabilityState =
  | 'APPLICABLE'
  | 'PARTIALLY_APPLICABLE'
  | 'NOT_APPLICABLE'
  | 'INSUFFICIENT_DATA';
```

## APPLICABLE

Moduł posiada wystarczające dane do pełnej oceny.

## PARTIALLY_APPLICABLE

Moduł można policzyć, ale brakuje części oczekiwanych dowodów. Score może istnieć, confidence musi uwzględnić brak.

## NOT_APPLICABLE

Moduł definicyjnie nie dotyczy danego trybu lub przypadku.

Przykład: Job Fit w `GENERAL_CV`.

`score = null`.

Taką wagę wolno renormalizować.

## INSUFFICIENT_DATA

Moduł powinien być oceniony, ale brak danych uniemożliwia uczciwy pomiar.

`score = null`.

Tego stanu **nie wolno po prostu usunąć z mianownika** tak jak `NOT_APPLICABLE`.

INSUFFICIENT_DATA wpływa na confidence domeny, może blokować wynik domeny i może uruchomić hard cap zgodnie z polityką domeny.

---

# 8. Score i Confidence są niezależne

Nigdy:

```text
confidence = score / 100
```

ani żadna funkcja równoważna.

Score mówi: **jak dobry jest zmierzony wymiar**.

Confidence mówi: **jak bardzo ufamy, że ten pomiar reprezentuje rzeczywisty wymiar**.

---

# 9. Nowy rachunek Confidence v2

Pierwotna funkcja zależna głównie od liczby stanowisk została odrzucona. Kandydat z jednym pięcioletnim stanowiskiem nie może mieć automatycznie niższego confidence niż job hopper z dziesięcioma krótkimi rolami.

Confidence opiera się na czterech niezależnych czynnikach.

## 9.1. Evidence Coverage

```text
C_cov = Σ fulfilledEvidenceWeight / Σ expectedEvidenceWeight
```

`C_cov ∈ [0,1]`.

Oczekiwane dowody wynikają z kontraktu modułu, nie z liczby pracodawców.

## 9.2. Provenance Quality

Każdy evidence atom otrzymuje wagę wiarygodności źródła.

Wartości startowe są **parametrami do kalibracji**, nie prawdą empiryczną:

```text
EXTERNALLY_VERIFIED         1.00
CROSS_SOURCE_CONSISTENT     0.90
USER_ASSERTED_CANONICAL     0.75
EXPLICIT_DOCUMENT_FACT      0.70
DERIVED_DETERMINISTIC       0.70
INFERRED_HEURISTIC          0.45
```

```text
C_prov = weightedMean(provenanceReliability_i, evidenceImportance_i)
```

## 9.3. Extraction Quality

```text
C_ext = 1 - normalizedParsingUncertainty
```

Uwzględnia m.in.:

- nierozpoznane sekcje,
- niejednoznaczne daty,
- zepsute kodowanie,
- konflikty parserów,
- tekst po złej ekstrakcji PDF.

## 9.4. Effective Sample Sufficiency

Nie liczymy stanowisk. Liczymy **niezależne, relewantne atomy dowodowe**.

```text
C_sample = 1 - exp(-n_eff / k)
```

`n_eff` oznacza efektywną liczbę niezależnych evidence atoms po deduplikacji korelacji.

`k` jest parametrem specyficznym dla modułu i musi być kalibrowany na corpus.

## 9.5. Łączenie confidence

Proponowany model bazowy:

```text
C = C_cov^0.40
  * C_prov^0.25
  * C_ext^0.20
  * C_sample^0.15
```

Czyli ważona średnia geometryczna w przestrzeni [0,1].

Wagi `0.40/0.25/0.20/0.15` są **initial priors**. D17 nie może traktować ich jako empirycznie potwierdzonych, dopóki nie przejdą kalibracji.

## 9.6. Polityka prezentacji

- `C < 0.35`: score domyślnie ukrywamy jako `INSUFFICIENT_EVIDENCE`, chyba że moduł posiada twardy negatywny dowód.
- `0.35 ≤ C < 0.55`: score może być pokazany jako niski-confidence.
- `0.55 ≤ C < 0.80`: standardowy confidence.
- `C ≥ 0.80`: wysoki confidence.

Confidence nigdy nie służy do kosmetycznego podbijania wyniku.

---

# 10. Score Components

```ts
export interface ScoreComponent {
  id: string;
  name: string;
  rawValue: number;
  normalizedValue: number; // 0..1
  weight: number;          // >0, suma = 1
  contribution: number;    // normalizedValue * weight * 100
  evidenceIds: string[];
}
```

```text
S_raw = Σ normalizedValue_i × weight_i × 100
```

Każda funkcja normalizująca musi być jawna i testowana.

---

# 11. Ciągłość funkcji scoringowych

Preferujemy funkcje ciągłe lub odcinkowo ciągłe z uzasadnionymi punktami zmiany.

Zakazane są przypadkowe klify typu:

```text
x = 0.95 → score 83
x = 0.96 → score 38
```

bez logicznego hard blockera.

Dla skal nasycenia rekomendowane klasy funkcji:

### Saturation

```text
f(x) = 1 - exp(-x / τ)
```

### Logistic

```text
f(x) = 1 / (1 + exp(-k(x - x0)))
```

### Smoothstep

```text
f(x) = 3x² - 2x³, dla x∈[0,1]
```

Wybór funkcji musi być udokumentowany per komponent.

---

# 12. Penalty Engine v2

Penalties służą do reprezentowania negatywnych sygnałów, które nie są naturalnie odwrotnością komponentu pozytywnego.

```ts
export interface Penalty {
  id: string;
  ruleCode: string;
  defectFingerprint: string;
  targetModuleId: string;
  targetComponentId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requestedDeduction: number;
  appliedDeduction: number;
  evidenceIds: string[];
  explanation: string;
}
```

## 12.1. Anti-double-dipping

Nie deduplikujemy tylko po `evidenceId`, ponieważ jeden evidence może opisywać kilka różnych wad, a ta sama wada może generować kilka evidence atoms.

Wprowadzamy `defectFingerprint`:

```text
SHA256(ruleFamily || canonicalEntityId || canonicalDefectType)
```

Rejestr kontroluje łączny budżet kary dla jednej wady.

## 12.2. Penalty budget

Kara nie może zredukować więcej punktów niż matematyczny budżet komponentu, którego dotyczy, chyba że jest jawnie zdefiniowanym cross-component hard capem.

---

# 13. Hard Caps v2

Hard cap nie jest karą. Jest logicznym ograniczeniem sufitu wyniku.

```ts
export type HardCapScope = 'MODULE' | 'DOMAIN' | 'GLOBAL';

export interface HardCap {
  id: string;
  ruleCode: string;
  scope: HardCapScope;
  targetId: string;
  capLimit: number;
  triggered: boolean;
  reason: string;
  evidenceIds: string[];
}
```

## MODULE

Dotyczy pojedynczego modułu.

Przykład: uszkodzony reading order ogranicza moduł struktury.

## DOMAIN

Dotyczy domeny, np. FORMAL_READINESS.

## GLOBAL

Tylko dla warunków rzeczywiście przekreślających sens całego wyniku w danym trybie.

Przykłady potencjalnych globalnych capów:

- krytyczna sprzeczność tożsamości/faktów,
- brak danych uniemożliwiający TARGETED_APPLICATION,
- niespełniony mandatory knockout w trybie gotowości aplikacji.

**Brak metryk ilościowych nie jest uniwersalnym globalnym hard capem.**

---

# 14. Kontrakt modułu

```ts
export interface AuditModuleResult {
  moduleId: string;
  moduleName: string;
  domainId: AuditDomainId;

  score: number | null;
  confidence: number;
  applicability: ApplicabilityState;

  evidence: Evidence[];
  missingEvidence: MissingEvidence[];
  breakdown: ScoreComponent[];
  penalties: Penalty[];
  hardCaps: HardCap[];

  verdictCode: string;
  verdict: string;
  recommendations: Recommendation[];
}
```

---

# 15. Domeny Audit Core

D08–D17 nie są bezpośrednio wrzucane do jednej średniej.

Najpierw trafiają do domen semantycznie niezależnych:

```ts
export type AuditDomainId =
  | 'DOCUMENT_QUALITY'
  | 'JOB_FIT'
  | 'EVIDENCE_QUALITY'
  | 'INTEGRITY'
  | 'FORMAL_READINESS';
```

Proponowane przypisanie startowe:

```text
D08 Structure                  → DOCUMENT_QUALITY
D09 Keywords/requirements      → JOB_FIT
D10 Formal requirements        → FORMAL_READINESS
D11 Skill recency              → JOB_FIT
D12 Role/seniority             → JOB_FIT
D13 Metrics/evidence           → EVIDENCE_QUALITY
D14 Language/naturalness       → DOCUMENT_QUALITY
D15 Consistency                → INTEGRITY
D16 Application readiness      → FORMAL_READINESS / orchestration result
D17 Consensus                  → aggregator, nie moduł wejściowy
```

D16 nie może podwójnie liczyć tych samych sygnałów. Jeżeli jest agregatem readiness, jego wynik nie wchodzi drugi raz do globalnej średniej jako niezależny moduł.

---

# 16. Korelacja i double counting między modułami

Każdy sygnał ma `signalFamily`.

```ts
export type SignalFamily =
  | 'STRUCTURE'
  | 'CONTACT'
  | 'TEMPORAL'
  | 'SKILL_PRESENCE'
  | 'SKILL_CONTEXT'
  | 'FORMAL_REQUIREMENT'
  | 'ROLE_ALIGNMENT'
  | 'METRIC_IMPACT'
  | 'LANGUAGE_QUALITY'
  | 'FACT_CONSISTENCY';
```

Jeden evidence atom może być używany w kilku modułach diagnostycznie, ale D17 musi znać rodzinę sygnału i unikać nadawania tej samej informacji wielokrotnej pełnej wagi.

D07 wymaga `SignalOwnershipMap`:

```ts
interface SignalOwnership {
  family: SignalFamily;
  primaryModuleId: string;
  secondaryConsumers: string[];
}
```

Primary owner odpowiada za scoring. Secondary consumer może używać sygnału do explanation/hard capu, ale nie może ponownie naliczać pełnej wartości bez jawnego uzasadnienia.

---

# 17. Domain Aggregation v2

Najpierw liczymy score wewnątrz domeny.

Do D07 przyjmujemy jako bazę **ważoną średnią geometryczną** dla semantycznie niezależnych modułów.

Aby poprawnie obsłużyć zero bez `ln(0)`, stosujemy przesuniętą średnią geometryczną:

```text
Gδ(S) = exp( Σ w_i ln(S_i + δ) / Σw_i ) - δ
```

z `δ = 1` punktem jako regularyzatorem numerycznym.

Po agregacji wynik clampujemy do `[0,100]`.

`δ` nie ma znaczenia semantycznego i musi pozostać małe względem skali 0–100.

## Dlaczego nie p = 0.65

Power mean `p=0.65` jest tylko nieznacznie surowsza od średniej arytmetycznej i pozwala zbyt łatwo kompensować jeden słaby filar kilkoma wysokimi wynikami.

Geometryczna agregacja domenowa jest bardziej zgodna z filozofią Audit Core: mocna wada w niezależnym filarze ma realnie ciągnąć wynik w dół.

## Kalibracja

Geometric mean jest hipotezą bazową D07, nie świętym dogmatem.

D17 ma porównać na corpus co najmniej:

- arithmetic mean,
- geometric mean,
- generalized mean dla `p ∈ {-1, -0.5, 0, 0.5}`,

oraz wybrać agregator na podstawie zachowania relacyjnego i stabilności, nie „ładności” wyników.

---

# 18. Global Consensus v2

Global consensus agreguje **domeny**, nie wszystkie moduły bezpośrednio.

```ts
export interface DomainResult {
  domainId: AuditDomainId;
  score: number | null;
  confidence: number;
  applicability: ApplicabilityState;
  contributingModules: string[];
  hardCaps: HardCap[];
}
```

```ts
export interface GlobalConsensusResult {
  auditRunId: string;
  engineVersion: string;
  mode: AuditMode;

  overallScore: number | null;
  overallConfidence: number;

  domainResults: Record<AuditDomainId, DomainResult>;
  moduleResults: Record<string, AuditModuleResult>;

  effectiveHardCaps: HardCap[];
  criticalMissingEvidence: MissingEvidence[];
  blockingIssues: string[];

  auditIntegritySignature: string;
}
```

## 18.1. Missing-domain policy

### NOT_APPLICABLE

Można usunąć z agregacji i renormalizować pozostałe domeny.

### INSUFFICIENT_DATA

Nie usuwamy bezkarnie.

Polityka zależy od trybu i krytyczności domeny:

- w `GENERAL_CV` brak JOB_FIT może być N/A,
- w `TARGETED_APPLICATION` brak JOB_FIT oznacza brak końcowego targeted score,
- brak INTEGRITY przy zbyt ubogim profilu może prowadzić do `overallScore = null`, jeśli nie umiemy uczciwie ocenić dokumentu.

---

# 19. Global Confidence

Global confidence nie jest prostą średnią wszystkich modułów.

Najpierw confidence domeny liczony jest jako ważona średnia geometryczna confidence aktywnych modułów, z uwzględnieniem brakujących wymaganych modułów.

Następnie:

```text
C_global = geometricMean(C_domain_j, domainWeight_j)
```

Dodatkowo `criticalMissingEvidence` może obniżać maksymalny confidence.

Nie stosujemy reguły „niskie confidence = niski score”. Score i confidence pozostają osobne.

---

# 20. Skala wyników

Startowa skala interpretacyjna:

```text
0–29    krytyczne
30–49   słabe
50–64   wymaga pracy
65–74   solidne
75–84   bardzo dobre
85–91   świetne
92–96   wyjątkowe
97–100  referencyjne
```

Ta skala nie jest jeszcze kalibracją statystyczną.

D17 ma zweryfikować rozkład wyników na corpus oraz później na anonimowych realnych dokumentach.

Warunek produktu:

- 90+ ma być rzadkie,
- 95+ bardzo rzadkie,
- 100 ma wymagać praktycznie referencyjnego przypadku bez istotnych braków.

Nie ustawiamy progów tak, by sztucznie osiągnąć ten rozkład. Najpierw prawidłowy model, potem empiryczna kalibracja.

---

# 21. Golden Corpus v2

Golden corpus jest wersjonowany i składa się z syntetycznych, kontrolowanych przypadków.

Minimum przed D08:

```text
EMPTY_PROFILE
MINIMAL_VALID_PROFILE
JUNIOR_UNQUANTIFIED
JUNIOR_GOOD_EVIDENCE
MID_AVERAGE
SENIOR_HIGH_IMPACT
LONG_SINGLE_EMPLOYMENT
JOB_HOPPER_GOOD_EVIDENCE
CAREER_PIVOT
RETURNING_WORKER
NON_IT_OFFICE
PHYSICAL_WORKER
SALES
CUSTOMER_SUPPORT
FINANCE
STUDENT
EMPLOYMENT_GAP_JUSTIFIED
EMPLOYMENT_GAP_UNEXPLAINED
OVERLAPPING_PART_TIME_VALID
OVERLAPPING_FULL_TIME_SUSPICIOUS
DATE_INVERSION
KEYWORD_STUFFING
JD_COPY_PASTE
FAKE_SENIOR_TITLE
SKILLS_LIST_NO_CONTEXT
METRIC_TOKEN_NO_RESULT
STRONG_METRIC_EVIDENCE
FORMAL_REQUIREMENT_MISSING
FORMAL_REQUIREMENT_UNKNOWN
VAULT_CV_CONTRADICTION
BROKEN_PDF_EXTRACTION
MULTICOLUMN_READING_ORDER
PROMPT_INJECTION_TEXT
EXTREME_LONG_TEXT
```

Każdy archetyp posiada:

- CV input,
- Vault input,
- opcjonalny JD,
- AuditMode,
- expected applicability,
- expected relations,
- expected hard caps,
- expected score ranges tylko tam, gdzie istnieje uzasadnienie,
- max/min confidence tam, gdzie istnieje uzasadnienie.

---

# 22. Relacyjne testy są ważniejsze od magicznych liczb

Preferujemy:

```text
score(CV_B) > score(CV_A)
```

kiedy B jest kontrolowaną poprawą A.

Przykłady:

- metryka z poprawnym cause-effect > ta sama treść bez metryki,
- skill w doświadczeniu > ten sam skill tylko w skills list,
- wyjaśniona luka > identyczna niewyjaśniona luka,
- zgodny Vault/CV > ta sama para z konfliktem dat,
- naturalne użycie frazy > stuffing tej samej frazy.

Nie wymagamy `score = 73`, jeżeli nie posiadamy empirycznego powodu, dla którego ma być dokładnie 73.

---

# 23. Testy matematyczne D07

Każdy przyszły moduł musi przejść poniższe klasy testów.

## 23.1. Bounds

```text
0 ≤ score ≤ 100
0 ≤ confidence ≤ 1
no NaN
no Infinity
```

## 23.2. Weight conservation

```text
Σ componentWeights = 1
Σ effectiveDomainWeights = 1 dla domen aktywnych
```

## 23.3. Monotonicity

Kontrolowana poprawa pojedynczego mierzonego sygnału nie może pogarszać wyniku modułu bez jawnego konfliktu.

## 23.4. Continuity / perturbation

Mała zmiana wejścia powinna powodować małą zmianę score, chyba że przekroczony został jawny logiczny hard blocker.

Testujemy lokalną różnicę:

```text
|S(x+ε)-S(x)| ≤ Δ_max
```

dla zdefiniowanych perturbacji.

## 23.5. Missingness

Usunięcie danych nie może poprawić score lub confidence tylko dlatego, że zniknął negatywny sygnał.

## 23.6. Independence

Zmiana sygnału spoza domeny modułu nie może zmieniać jego score.

## 23.7. Anti-gaming

- keyword stuffing,
- kopiowanie JD,
- sztuczne liczby,
- lista 200 technologii,
- fałszywy senior title,
- duplikacja certyfikatów,
- prompt injection jako tekst,
- powielanie tego samego osiągnięcia.

## 23.8. Metamorphic tests

Transformacje zachowujące semantykę powinny zachowywać wynik w tolerancji:

- zmiana kolejności równoważnych bulletów,
- zmiana wielkości liter,
- bezpieczna normalizacja whitespace,
- równoważny format dat,
- synonim rozpoznany jako ten sam canonical skill.

## 23.9. Calibration drift

Zmiana configu wag/progów musi raportować różnicę na całym golden corpus.

PR zmieniający scoring nie może przejść bez snapshotu driftu.

---

# 24. Audit Integrity Signature

Każdy przebieg otrzymuje deterministyczną sygnaturę:

```text
SHA256(
  engineVersion
  || auditMode
  || referenceMonth
  || canonicalSignals
  || moduleConfigVersions
  || corpusSchemaVersion
)
```

Nie używamy `auditRunId` jako treści sygnatury.

Sygnatura ma odpowiadać faktycznej konfiguracji i wejściom.

---

# 25. Konfiguracja: TypeScript + dane deklaratywne

Logika wykonywalna pozostaje w TypeScript.

```text
TypeScript
  ├─ extractors
  ├─ normalizers
  ├─ scorers
  ├─ penalty logic
  ├─ hard-cap logic
  ├─ confidence calculus
  └─ aggregation
```

Konfiguracja może być deklaratywna:

```text
Typed TS config / validated JSON
  ├─ weights
  ├─ thresholds
  ├─ provenance priors
  ├─ skill aliases
  ├─ license hierarchies
  └─ calibration parameters
```

Corpus pozostaje w JSON.

Nie przechowujemy formuł wykonywalnych jako stringów typu:

```json
{ "formula": "coverage*0.4 + recency*0.3" }
```

Nie budujemy własnego interpretera matematycznego ukrytego w JSON.

Każdy JSON config musi być walidowany runtime schema (np. Zod) i mieć `configVersion`.

---

# 26. Proponowana struktura kodu

```text
src/lib/audit-core/
  core/
    types.ts
    auditContext.ts
    applicability.ts
    confidence.ts
    evidence.ts
    penalties.ts
    hardCaps.ts
    domains.ts
    consensus.ts
    signature.ts

  signals/
    types.ts
    ownership.ts
    extractors/
    normalizers/

  modules/
    structure/
    requirements/
    formal/
    recency/
    role/
    metrics/
    language/
    consistency/
    readiness/

  config/
    defaults.ts
    provenance.ts
    validation.ts

  corpus/
    schema.ts

src/lib/__tests__/audit-core/
  golden/
  monotonicity/
  perturbation/
  adversarial/
  metamorphic/
```

---

# 27. D07 a D18 Master Vault

D07 nie implementuje jeszcze pełnej kompletności Vaultu, ale kontrakt uwzględnia cztery semantyczne stany pola:

```ts
export type FieldKnowledgeState<T> =
  | { state: 'VALUE'; value: T }
  | { state: 'NOT_APPLICABLE' }
  | { state: 'UNKNOWN' }
  | { state: 'DECLINED' };
```

Puste pole bez decyzji użytkownika nie może być niejawnie utożsamione z żadnym z tych stanów.

D18 implementuje preflight i UI dla tego kontraktu.

---

# 28. D07 a D19 Smart Helpers

Helpers mogą proponować dane, ale nie tworzą evidence typu `USER_ASSERTED_CANONICAL` przed zatwierdzeniem użytkownika.

Przykład:

```text
country = Polska
→ suggestion: callingCode = +48
```

Dopiero zatwierdzenie powoduje zapis faktu.

---

# 29. Zasady implementacji przyszłych D08–D17

Każdy PR modułu musi zawierać:

1. definicję celu,
2. explicit non-goals,
3. pakiet scoped signals,
4. evidence contract,
5. formułę matematyczną,
6. wszystkie normalizacje,
7. confidence contract,
8. applicability,
9. penalties,
10. hard caps,
11. testy bounds,
12. testy monotoniczności,
13. testy perturbation,
14. testy missingness,
15. testy adversarial,
16. testy independence,
17. przypadki corpus,
18. raport calibration drift względem poprzedniej wersji.

Bez kompletu moduł nie jest odbierany.

---

# 30. Kryteria odbioru D07

D07 jest zakończone dopiero, gdy:

- istnieją canonical TypeScript contracts,
- scorery nie mogą kompilacyjnie czytać raw Vault/CV/JD,
- istnieje Evidence Graph,
- istnieje MissingEvidence,
- istnieje Field Provenance,
- istnieje Applicability State Machine,
- confidence używa coverage/provenance/extraction/sample sufficiency,
- data temporalna używa MonthIndex,
- penalties mają defect fingerprint,
- hard caps mają scope MODULE/DOMAIN/GLOBAL,
- istnieje SignalOwnershipMap,
- consensus agreguje domeny, nie ślepo moduły,
- NOT_APPLICABLE i INSUFFICIENT_DATA mają różne zachowanie,
- istnieje wersjonowany golden corpus,
- istnieją testy monotoniczne, perturbacyjne, adversarial i metamorphic,
- istnieje drift report,
- puste wejście nigdy nie generuje „dobrego” score,
- brak danych nigdy nie jest zamieniany w 100%,
- CI przechodzi lint/typecheck/test/build.

---

# 31. Parametry wymagające późniejszej kalibracji

Poniższych wartości **nie wolno traktować jako prawd empirycznych**:

- provenance reliability priors,
- wagi confidence 0.40/0.25/0.20/0.15,
- parametr `k` dla effective sample sufficiency,
- wagi domen,
- geometric vs generalized mean,
- granice skali 65/75/85/92/97,
- wartości hard capów,
- tolerancje perturbacyjne.

Każda z tych wartości ma własny `CALIBRATION_REQUIRED` marker w dokumentacji/configu do czasu walidacji na corpus i realnych, zanonimizowanych dokumentach.

---

# 32. Finalna zasada matematyczna Audit Core

**Score nie jest opinią. Score jest wynikiem funkcji z jawnych sygnałów.**

**Confidence nie jest ozdobnikiem. Confidence opisuje jakość epistemiczną tego wyniku.**

**Missing data nie jest sukcesem.**

**Hard cap nie jest karą za estetykę, tylko logicznym ograniczeniem wynikającym z krytycznego warunku.**

**Consensus nie może pozwalać kilku wysokim, skorelowanym wynikom przykryć jednej fundamentalnej słabości.**

Jeżeli nie potrafimy wskazać:

```text
input
→ normalized signal
→ evidence
→ component
→ contribution
→ penalty/cap
→ module score
→ domain score
→ consensus
```

wynik nie jest dopuszczony do produktu.

---

## Decyzja D07 v2

Ta specyfikacja zastępuje wcześniejszy szkic matematyczny D07 jako dokument normatywny dla implementacji Audit Core 1.0.

D08 nie może rozpocząć kalibracji produkcyjnej przed implementacją i odbiorem tego kontraktu.
