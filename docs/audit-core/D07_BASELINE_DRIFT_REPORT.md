# D07 — Baseline Calibration Drift Report

Data: 2026-09-11  
Engine: `audit-core-1.0.0-precalibration`  
Config: `audit-core-config-v2.0.0-precalibration`  
Corpus: `audit-core-corpus-v2-2026-09-11`

## Status

To jest **baseline**, a nie porównanie dwóch skalibrowanych silników. D07 ustanawia kontrakt, corpus i mechanizm driftu przed uruchomieniem produkcyjnych scorerów D08–D17.

Dlatego wartości delta dla baseline wynoszą zero z definicji. Nie oznacza to, że wagi lub progi zostały empirycznie zwalidowane. Konfiguracja pozostaje jawnie oznaczona `calibrationRequired: true`.

```text
engineVersion: audit-core-1.0.0-precalibration
configVersion: audit-core-config-v2.0.0-precalibration
corpusVersion: audit-core-corpus-v2-2026-09-11
casesChanged: 0
medianAbsoluteDelta: 0
p95AbsoluteDelta: 0
maxAbsoluteDelta: 0
rankInversions: 0
newHardCaps: 0
removedHardCaps: 0
confidenceDeltaSummary: baseline / 0
```

## Bramka dla kolejnych scoring PR

Każdy PR od D08, który zmienia funkcję score, confidence, penalties, hard caps, wagi lub progi, ma dostarczyć snapshot `before` i `after` dla tego samego corpus oraz raport wygenerowany przez `buildCalibrationDriftReport()`.

Niewyjaśniona inwersja relacji z corpus jest błędem stop-the-line. Sam fakt, że median delta jest mała, nie legalizuje inwersji semantycznej.

## Co jest jeszcze do kalibracji

- provenance reliability priors,
- wagi confidence `0.40 / 0.25 / 0.20 / 0.15`,
- `sampleScaleK` per moduł,
- wagi domen,
- wybór agregatora z benchmarku `p ∈ {-1,-0.5,0,0.5,1}`,
- wartości hard capów,
- progi interpretacyjne wyniku,
- tolerancje perturbacyjne.

Baseline ma być punktem odniesienia, nie certyfikatem jakości modelu.
