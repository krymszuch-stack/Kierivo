# Plan odbioru D08 — Struktura i odczyt maszynowy

Data: 2026-09-11  
Linear: ADR-111  
Branch: `d08-structural-readability`

## Cel

D08 ma zastąpić uproszczony pomiar `struktura_ocr` rygorystycznym, deterministycznym modułem jakości dokumentu opartym na kontraktach D07.

D08 nie jest modułem kompletności profilu ani dopasowania do oferty.

## Etap 1 — Spec

Dokumenty normatywne:

- `docs/audit-core/D08_FINAL_SPEC_V2.md`
- `docs/audit-core/D08_CALIBRATION_MATRIX.md`
- `docs/audit-core/D08_CALIBRATION_DRIFT_BASELINE.md`

Spec potwierdza:

- brak darmowych punktów za brak danych;
- brak kar za samą liczbę kolumn;
- brak hard capów za brak doświadczenia / telefonu / LinkedIna;
- rozróżnienie złego dokumentu od awarii pomiaru;
- confidence z centralnego D07 calculatora;
- Score Ledger jako źródło explainability.

**Stan: wykonane.**

## Etap 2 — Implementacja

Zaimplementowane:

1. deterministyczne sygnały geometrii i tekstu PDF;
2. canonical D08 signals;
3. pure scorer 8 komponentów;
4. adversarial penalties;
5. module hard caps;
6. canonical D07 Score Ledger i PenaltyBudget;
7. Evidence IDs i SOURCE_AWARE reference comparison;
8. D07 confidence integration;
9. evidence gate dla reading-order o niewystarczającym confidence;
10. deterministyczny adapter warstwy tekstowej realnego DOCX.

**Stan: wykonane technicznie, podlega końcowym bramkom CI.**

## Etap 3 — Golden corpus

Syntetyczny corpus D08 zawiera 20 kontrolowanych przypadków z jawnie zdefiniowanymi wadami i przypadkami N/A.

Dodatkowo test integracyjny tworzy w runtime rzeczywiste binarne PDF i DOCX, aby przejść przez parser pliku, a nie przez atrapę tekstową.

Runtime snapshot syntetycznego corpus został zamrożony w `syntheticBaseline.ts`. Baseline służy wyłącznie ochronie przed niezamierzonym driftem i **nie jest empiryczną kalibracją na prawdziwych CV**.

Prawdziwe CV zostaną później dołączone jako osobny corpus empiryczny z ręcznym ground truth. Nie zastępuje on syntetycznych inwariantów.

## Etap 4 — Testy

Pokrycie obejmuje:

- unit;
- monotonicity;
- perturbation;
- independence;
- missingness / N/A;
- adversarial;
- reading-order evidence gate;
- SOURCE_AWARE reference comparison;
- real-binary PDF integration;
- real-binary DOCX text extraction;
- ledger equality;
- calibration drift;
- hard-cap drift;
- rank-inversion gate.

**Stan: w toku końcowego CI.**

## Etap 5 — Ręczny odbiór

Pozostaje celowo niezastąpiony automatem.

Na minimum 5 reprezentatywnych prawdziwych dokumentach trzeba sprawdzić:

- zaznaczenie tekstu w PDF;
- kopiowanie do TXT;
- kolejność tekstu;
- porównanie z extraction stream CVelocity;
- Evidence IDs / ledger;
- zgodność sygnałów technicznych z ręczną oceną dokumentu.

Ten etap najlepiej wykonać na planowanym real-CV corpus. Do jego wykonania D08 nie może być oznaczone jako formalnie `ODEBRANE`.

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
- initial priors mają jawny drift report;
- żadna poprawka izolowanego sygnału nie pogarsza score bez jawnego cross-effect;
- safe 2-column nie jest automatycznie gorszy od 1-column;
- hard caps wyzwalają się tylko dla katastrofalnych, potwierdzonych technicznych stanów;
- zmiana score/confidence/hard-cap przekraczająca drift gate wymaga jawnej rekalibracji baseline;
- real-CV corpus nie jest mieszany z syntetycznym baseline w sposób udający walidację rynkową.

## Status

**IMPLEMENTATION + SYNTHETIC CALIBRATION GATES IN FINAL CI.**

D08 pozostaje **NIEODEBRANE** do zielonego focused/full CI oraz ręcznego real-document smoke.
