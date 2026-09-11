# Plan odbioru D07 — Audit Core 1.0

Data: 2026-09-11

D07 jest fundamentem matematycznym i architektonicznym dla D08–D17. Sam dokument specyfikacji nie kończy D07. Etap zostanie odebrany dopiero po implementacji kontraktów oraz testów wynikających z Final Spec v2.

## Bramy odbioru

- canonical contracts w TypeScript;
- scoped signals i brak bezpośredniego dostępu scorerów do raw Vault/CV/JD;
- Evidence Graph + MissingEvidence;
- provenance bez fałszywego `GROUND_TRUTH` dla danych deklaratywnych użytkownika;
- MonthIndex + jawny referenceMonth;
- applicability: rozdzielone N/A i insufficient data;
- confidence v2: coverage/provenance/extraction/effective sample;
- penalty anti-double-dipping przez defect fingerprint;
- hard caps MODULE/DOMAIN/GLOBAL;
- SignalOwnershipMap;
- domenowy consensus z raportem porównującym agregatory;
- golden corpus;
- monotonicity, perturbation, missingness, independence, adversarial i metamorphic tests;
- calibration drift report;
- pusty profil nie generuje dobrego wyniku;
- lint/typecheck/test/build zielone.

## Kolejność

1. Final Spec v2 review.
2. Implementacja D07 core bez zmiany produkcyjnej kalibracji D08–D17.
3. Golden corpus + matematyczne gates.
4. Formalny odbiór D07.
5. Dopiero potem D08, jeden moduł na PR.
