# D07 — Calibration Matrix & Mathematical Review Gates

Ten dokument uzupełnia `D07_FINAL_SPEC_V2.md` i definiuje, które parametry są stałą kontraktową, a które hipotezą do kalibracji.

## 1. Parametry kontraktowe

Nie podlegają kalibracji przez „ładność” wyniku:

- score ∈ [0,100],
- confidence ∈ [0,1],
- NOT_APPLICABLE ≠ INSUFFICIENT_DATA,
- brak danych ≠ 100%,
- scorer nie czyta raw Vault/CV/JD,
- każdy contribution wskazuje evidence,
- każdy penalty wskazuje defect fingerprint i evidence,
- każdy hard cap ma scope MODULE/DOMAIN/GLOBAL,
- daty miesięczne używają integer MonthIndex,
- D17 agreguje domeny, nie ślepo wszystkie moduły,
- D16 nie może być jednocześnie agregatem readiness i niezależnym pełnoprawnym głosem w konsensusie,
- wynik musi być deterministyczny dla identycznego inputu, referenceMonth i wersji konfiguracji.

## 2. Parametry kalibracyjne

| Parametr | Startowa hipoteza | Jak kalibrujemy | Warunek odbioru |
|---|---:|---|---|
| confidence coverage weight | 0.40 | ablation + corpus | brak patologii missing-data |
| confidence provenance weight | 0.25 | corpus z konfliktami źródeł | verified > asserted > inferred |
| confidence extraction weight | 0.20 | perturbacje parsera | degradacja monotoniczna |
| confidence sample weight | 0.15 | różna liczba niezależnych evidence | brak dyskryminacji krótkiej kariery |
| effective-sample k | per module | curve fitting do corpus | brak skoków i saturation za wcześnie |
| domain weights | TBD | pairwise ranking + expert review | brak dominacji jednej domeny |
| domain aggregator | geometric baseline | porównanie p∈{-1,-0.5,0,0.5,1} | najlepsza zgodność relacyjna |
| hard-cap limits | TBD | adversarial + edge cases | tylko logiczne blokery |
| interpretation thresholds | 29/49/64/74/84/91/96 | empirical distribution | bez sztucznego targetowania rozkładu |

## 3. Benchmark agregatorów

Każdy kandydat na agregator musi być liczony na tym samym corpus.

Testujemy:

```text
M_p(x,w) = (Σ w_i x_i^p / Σw_i)^(1/p), p ≠ 0
M_0(x,w) = exp(Σ w_i ln(x_i) / Σw_i)
```

Dla score=0 stosujemy w implementacji wersję numerycznie stabilną z małym δ, a raport kalibracyjny pokazuje wpływ δ.

Porównujemy co najmniej:

- p=1.0 arithmetic,
- p=0.5,
- p=0 geometric,
- p=-0.5,
- p=-1 harmonic.

Nie wybieramy parametru dlatego, że „wyniki są niższe”. Wybieramy model, który najlepiej zachowuje oczekiwane relacje i odpowiednio reaguje na niezależny słaby filar.

## 4. Obowiązkowe archetypy matematyczne

### A. Jedna słaba domena

```text
[90, 90, 90, 90, 40]
```

Cel: słaba niezależna domena ma być widoczna w consensus, ale nie może automatycznie oznaczać katastrofy bez hard blockera.

### B. Jedna krytyczna domena

```text
[90, 90, 90, 90, 10]
```

Cel: agregator powinien silnie reagować. Jeżeli 10 wynika z logicznego blockera, hard cap decyduje niezależnie od agregatora.

### C. Same przeciętne

```text
[65, 65, 65, 65, 65]
```

Consensus powinien pozostać około 65, bez magicznego boosta.

### D. Brak jednej domeny N/A

```text
GENERAL_CV: JOB_FIT = NOT_APPLICABLE
```

Pozostałe domeny mogą być renormalizowane.

### E. Brak jednej domeny wymaganej

```text
TARGETED_APPLICATION: JOB_FIT = INSUFFICIENT_DATA
```

Nie wolno zwrócić pozornie wysokiego targeted score po usunięciu tej domeny.

## 5. Inwarianty confidence

1. Dodanie relewantnego, niezależnego i dobrze wyekstrahowanego dowodu nie obniża confidence bez konfliktu.
2. Dodanie duplikatu tego samego dowodu nie zwiększa `n_eff` jak nowy niezależny evidence.
3. Większa liczba stanowisk sama w sobie nie zwiększa confidence.
4. Jedno dobrze udokumentowane długie zatrudnienie może mieć wysoki confidence.
5. Corrupted parsing obniża C_ext nawet wtedy, gdy score liczony z pozostałych sygnałów jest wysoki.
6. Master Vault bez external verification nie może dostać provenance=1.0 tylko dlatego, że jest Vaultem.

## 6. Inwarianty score

1. Brak wymagania nie daje automatycznie 100.
2. Brak wykrytego błędu nie daje automatycznie 100.
3. `UNKNOWN` nie jest `SATISFIED`.
4. `NOT_APPLICABLE` nie jest pozytywnym evidence.
5. Usunięcie negatywnego sygnału razem z całą informacją nie może paradoksalnie poprawić wyniku poprzez missingness.
6. Jedna liczba nie oznacza osiągnięcia.
7. Jedno słowo kluczowe nie oznacza kompetencji.
8. Tytuł stanowiska nie może sam udowodnić seniority.

## 7. Drift report wymagany w każdym scoring PR

Raport zawiera:

```text
engineVersion
configVersion
corpusVersion
casesChanged
medianAbsoluteDelta
p95AbsoluteDelta
maxAbsoluteDelta
rankInversions
newHardCaps
removedHardCaps
confidenceDeltaSummary
```

Każda inwersja oczekiwanej relacji A>B musi być wyjaśniona w PR.

## 8. Zasada stop-the-line

Jeżeli zmiana:

- powoduje NaN/Infinity,
- daje pustemu profilowi wynik „solidny” lub lepszy,
- pozwala brakowi danych zwiększyć score,
- tworzy niewyjaśnioną inwersję monotoniczności,
- zwiększa wynik przez keyword stuffing,
- ukrywa obowiązkową domenę jako N/A,
- nalicza ten sam sygnał jako kilka niezależnych pełnych głosów,

to PR scoringowy jest blokowany niezależnie od tego, że pozostałe testy są zielone.
