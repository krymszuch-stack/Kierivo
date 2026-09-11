# Plan odbioru D08 — Struktura i odczyt maszynowy

Data: 2026-09-11
Linear: ADR-111
Branch: `d08-structural-readability`

## Cel

D08 ma zastąpić obecny uproszczony pomiar `struktura_ocr` rygorystycznym, deterministycznym modułem jakości dokumentu opartym na kontraktach D07.

D08 nie jest modułem kompletności profilu ani dopasowania do oferty.

## Etap 1 — Spec

Wymagane dokumenty:

- `docs/audit-core/D08_FINAL_SPEC_V2.md`
- `docs/audit-core/D08_CALIBRATION_MATRIX.md`

Spec review musi potwierdzić:

- brak darmowych punktów za brak danych;
- brak kar za samą liczbę kolumn;
- brak hard capów za brak doświadczenia / telefonu / LinkedIna;
- rozróżnienie złego dokumentu od awarii pomiaru;
- confidence z centralnego D07 calculatora;
- Score Ledger jako źródło explainability.

## Etap 2 — Implementacja

Po implementacji D07 canonical contracts:

1. `DocumentGeometryAndTextExtractor`;
2. canonical D08 signals;
3. pure scorer;
4. penalties/adversarial registry;
5. module hard caps;
6. Score Ledger;
7. evidence mapping;
8. D07 confidence integration.

## Etap 3 — Golden corpus

Minimum 20 fixture'ów wymienionych w `D08_FINAL_SPEC_V2.md`.

Fixture musi przechowywać źródło/AST oraz realny plik PDF/DOCX, jeśli dotyczy.

## Etap 4 — Testy

Wymagane:

- unit;
- monotonicity;
- perturbation;
- independence;
- missingness;
- metamorphic;
- adversarial;
- PDF/DOCX integration;
- ledger equality.

## Etap 5 — Ręczny odbiór

Na minimum 5 reprezentatywnych dokumentach:

- zaznaczenie tekstu w PDF;
- kopiowanie do TXT;
- porównanie kolejności;
- porównanie z extraction stream CVelocity;
- sprawdzenie wskazanych Evidence IDs w UI/ledgerze.

## Krytyczne przypadki odbioru

1. Jednokolumnowe czyste CV.
2. Dwukolumnowe czyste CV bez interleavingu.
3. Dwukolumnowe CV z faktycznym interleavingiem.
4. Skan bez natywnej warstwy tekstowej.
5. PDF z polskimi znakami i ligaturami.
6. PDF z ukrytym keyword stuffingiem.
7. PDF z clippingiem i textbox overlap.
8. CV bez punktorów.
9. CV bez LinkedIna.
10. CV studenta bez doświadczenia.

Przypadki 8–10 nie mogą być automatycznie karane przez D08 za samą nieobecność tych elementów.

## Odbiór matematyczny

D08 jest odebrane tylko jeśli:

- wszystkie score są odtwarzalne z ledgeru;
- nie ma nieudokumentowanych progów;
- parametry initial priors mają drift report;
- żadna poprawka izolowanego sygnału nie pogarsza score bez jawnego cross-effect;
- safe 2-column nie jest automatycznie gorszy od 1-column;
- hard caps wyzwalają się tylko dla katastrofalnych, potwierdzonych technicznych stanów.

## Status

Na etapie utworzenia dokumentu: **SPEC READY FOR IMPLEMENTATION AFTER D07 CONTRACTS**.

Nie oznacza to jeszcze `D08: ODEBRANE`.
