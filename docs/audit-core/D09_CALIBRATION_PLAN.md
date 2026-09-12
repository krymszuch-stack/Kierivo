# D09 — Calibration Plan

Status: **pre-calibration implementation contract**  
Module: `MOD_JOB_ALIGNMENT`  
Domain: `JOB_FIT`

## 1. Cel kalibracji

D09 ma porządkować kandydatów według rzeczywistego dopasowania do konkretnego JD. Nie optymalizujemy modelu pod „ładne” liczby ani pod średnią 70+.

Kalibracja ma ustalić:

- jakość ekstrakcji wymagań z JD;
- rozróżnienie `CORE_MUST / MUST / NICE`;
- siłę kierunkowych relacji ontologicznych;
- wpływ głębokości evidence;
- udział średniej geometrycznej w indeksie MUST;
- kształt monotonicznej funkcji `F_M`;
- próg/gładkość bramki NICE;
- wykładnik NICE;
- próg CORE_MUST hard cap;
- politykę uncertainty i confidence.

## 2. Parametry, które są dziś priors

```text
geometricShare                  0.45
geometricEpsilon                0.05
depthFloor                      0.50
niceWeightWhenMustExists        0.20
niceExponent                    2.40
niceGateStart                   0.45
niceGateFull                    0.85
coreMustMissingThreshold        0.20
coreMustCap                     35
sourceCompletenessKnownAbsence  0.75
maxUncertaintyWidth             30
maxUnknownMustWeightShare       0.30
```

Te wartości NIE są jeszcze parametrami empirycznie zatwierdzonymi.

## 3. Metryki parsera JD

Na ręcznie oznaczonym zbiorze ofert mierzymy osobno:

- entity precision;
- entity recall;
- entity F1;
- exact priority precision/recall/F1;
- macierz pomyłek `CORE_MUST / MUST / NICE / MISSING`.

Błąd klasyfikacji priority jest ważniejszy niż zwykły brak synonimu, ponieważ asymetryczna matematyka wzmacnia jego wpływ.

## 4. Ground truth dopasowania

Preferowane etykiety są relacyjne:

```text
dla JD X:
CV_A > CV_B
CV_B > CV_C
```

Nie wymagamy od anotatora wymyślania dokładnego `73/100`, jeśli nie ma podstaw do takiej precyzji.

Dodatkowo można oznaczać:

- spełnienie każdego requirementu;
- siłę dowodu 0..1;
- typ relacji semantycznej;
- `UNKNOWN`;
- jawne knockout CORE_MUST;
- opcjonalny zakres eksperckiego wyniku, np. 65–75.

## 5. Funkcja celu

Dobór parametrów nie może minimalizować wyłącznie MSE. Docelowy loss ma charakter wielokryterialny:

```text
L = λ1 * ranking_loss
  + λ2 * requirement_match_loss
  + λ3 * blocker_loss
  + λ4 * calibration_loss
  + λ5 * uncertainty_loss
  + λ6 * complexity_penalty
```

Priorytet:

1. poprawny ranking;
2. brak fałszywego spełnienia CORE_MUST;
3. dobra kalibracja requirement-level;
4. dopiero później kosmetyka końcowej skali 0–100.

## 6. Ranking gate

Wbudowany evaluator `evaluateD09PairwiseRanking` mierzy:

- comparable pairs;
- correct pairs;
- ties;
- inversions;
- pairwise accuracy.

Każda zmiana parametrów musi raportować ranking inversions względem zaakceptowanego baseline.

## 7. Parser gate

Wbudowany `evaluateD09RequirementParser` raportuje TP/FP/FN i priority confusion.

Nie wolno poprawiać recall kosztem niekontrolowanego wzrostu FP w MUST/CORE_MUST. Fałszywy MUST jest szczególnie niebezpieczny.

## 8. Uncertainty gate

D09 publikuje pojedynczy score tylko wtedy, gdy uncertainty mieści się w zaakceptowanej granicy.

Na oznaczonym corpusie mierzymy:

- coverage rate eksperckiego reference score/range;
- mean interval width;
- false-certainty rate.

Wąski przedział, który regularnie nie obejmuje ground truth, jest gorszy niż uczciwe `INSUFFICIENT_DATA`.

## 9. Directional ontology gate

Obowiązkowe inwarianty:

```text
PostgreSQL -> relational database    mocny dowód
relational database -> PostgreSQL    słaby dowód
React -> Vue                         NIE spełnia konkretnego MUST
Spring Boot -> Spring Framework      może spełnić szerszy wymóg
Spring Framework -> Spring Boot      nie jest pełnym dowodem
```

Relacje są kierunkowe i muszą być oznaczane ręcznie / walidowane na corpusie.

## 10. Evidence depth gate

Sprawdzamy relacje porządkowe:

```text
work experience evidence > project evidence > summary > skills list
```

Ale kalibracja może zmienić odległości pomiędzy poziomami.

Wielokrotne powtórzenie tego samego faktu nie może liniowo zwiększać score.

## 11. Semantic inference

Wnioskowanie typu:

```text
„obsługa sieci 16 000 detalistów” -> Key Account Management
```

musi mieć:

- canonical entity;
- provenance `INFERRED_HEURISTIC`;
- rationale;
- `claimStrength`;
- osobne extraction confidence;
- źródłowy evidence pointer.

`claimStrength < 1` nie może punktować jak literalny fakt.

## 12. Train / validation / holdout

Realny corpus dzielimy przed strojeniem parametrów.

Minimalnie:

```text
60% calibration/train
20% validation
20% untouched holdout
```

Podział powinien być grupowany po kandydacie i/lub rodzinie JD tak, aby podobne kopie tego samego CV nie przeciekały między zbiorami.

## 13. Zasada stop-the-line

Merge parametrów jest blokowany, jeżeli:

- rośnie liczba fałszywych CORE_MUST;
- spada holdout pairwise accuracy poza przyjętą tolerancję;
- parser precision dla MUST/CORE_MUST spada istotnie;
- uncertainty staje się nadmiernie pewne;
- nowy parametr jest dobrany wyłącznie po to, aby jedna próbka dostała oczekiwany „ładny” score.

## 14. Odbiór D09

D09 można oznaczyć jako empirycznie odebrane dopiero po:

1. zielonym focused CI;
2. zielonym pełnym suite + build;
3. oznaczonym real-CV/JD corpusie;
4. parser precision/recall/F1 report;
5. pairwise ranking report;
6. uncertainty coverage report;
7. holdout bez strojenia po wyniku;
8. review hard capów CORE_MUST;
9. Score Ledger audit na reprezentatywnych przypadkach;
10. potwierdzeniu braku double counting z D10/D11/D12/D14/D16.
