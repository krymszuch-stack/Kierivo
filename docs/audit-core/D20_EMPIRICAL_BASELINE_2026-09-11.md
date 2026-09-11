# D20 — Empirical Adaptive Learning Baseline (2026-09-11)

## Źródła

Przeanalizowano trzy klasy danych dostarczonych poza repozytorium:

- 27 zanonimizowanych realnych ekstrakcji OCR + wyniki legacy audit;
- 200 syntetycznych CV z kontrolowanymi defektami;
- 100 akademickich CV kalibracyjnych w tierach PERFECT / AVERAGE / FATAL.

Surowe CV i teksty realnych kandydatów **nie są commitowane do repozytorium**. Repo przechowuje wyłącznie kod, agregaty, bezpieczne testy syntetyczne i wersjonowane modele po przejściu bramek prywatności.

Fingerprinty wejścia SHA-256:

- legacy audit results: `6c22162bf720b5e5c41a3b8f862571287dc6243fc813df1d7b6cbac2bf8593e1`
- OCR anonymized corpus: `8aba559d9d8d5f8d7c4729b861450185f04c926ea46b1e8c74a97280b8a07b5c`
- academic corpus ZIP: `9f9842b3d20f280071e33423747c6557bab0c9ef04b1601bba2874e9d28f2da8`
- synthetic corpus ZIP: `93a1689b265617aa111a3a969914db1415cf8b1652fab4c4b77b6bdad93984df`
- CV input corpus ZIP: `eda32bfc6c8fa32b7a78d724f5b3fca8ad8a53e68241070265c9bb72ec035585`

## Najważniejsze wyniki

### Real OCR corpus

Po deduplikacji: 26 unikalnych dokumentów z 27 wejść. Jeden dokument występował dwa razy identycznie, więc adaptive learner musi liczyć document frequency po deduplikacji, a nie liczbę plików.

Rozkład legacy score:

| Moduł | min | mediana | max | liczba unikalnych wartości | odchylenie populacyjne |
|---|---:|---:|---:|---:|---:|
| D08 document quality | 90 | 97 | 100 | 10 | 2.539 |
| D10 formal requirements | 40 | 70 | 100 | 3 | 24.394 |
| D12 seniority alignment | 65 | 88 | 88 | 3 | 9.816 |
| D13 quantified impact | 0 | 0 | 48 | 4 | 16.448 |
| D14 linguistic naturalness | 90 | 90 | 90 | 1 | 0.000 |
| D15 fact consistency | 100 | 100 | 100 | 1 | 0.000 |

Interpretacja:

1. D08 ma silną kompresję w górnym zakresie. W korpusie istnieją teksty wyraźnie uszkodzone przez OCR, a legacy D08 nadal daje 90+.
2. D14 jest zdegenerowany na realnym korpusie: 27/27 = 90. Taki moduł nie rozróżnia przypadków.
3. D15 jest zdegenerowany jeszcze mocniej: 27/27 = 100. Brak wykrytych niespójności nie jest dowodem pełnej spójności.
4. D10 i D12 są silnie skwantyzowane do trzech poziomów. To może być świadoma skala, ale obecnie ogranicza kalibrację i wykrywanie przypadków granicznych.
5. D13 wykazał false-positive numeric evidence. Wśród legacy przykładów znalazły się m.in. rok przy sekcji (`2022`), staż (`3 lata`), czas (`2 lata`) oraz fragment nazwy/ceny (`99 Zł`). Liczba bez relacji akcja → rezultat → skala nie może automatycznie być metryką wpływu.

### Synthetic corpus

- 200 przypadków;
- legacy calibration pass rate: 84.0%;
- 32 przypadki nie przeszły oczekiwanego zakresu/verdictu.

Najczęstsze klasy porażek:

| Defekt | liczba nieudanych przypadków |
|---|---:|
| OVERQUALIFIED_ACADEMIC_DRIFT | 9 |
| IMPOSSIBLE_TECH_AGE | 4 |
| CIRCULAR_DEPENDENCY_ROLE | 4 |
| OCR_GARBLED_CHARS | 3 |
| CAREER_PIVOT_DISCONNECT | 3 |
| FOREIGN_LANGUAGE_HALLUCINATION | 3 |
| ZERO_QUANTIFICATION_PASSIVE | 3 |
| MISSING_MANDATORY_CONTACT | 3 |

To bezpośrednio wskazuje moduły wymagające największej ilości adaptive evidence: D08, D10, D12, D13, D15/D16.

### Academic corpus

- 100 przypadków;
- deklarowany pass rate 100%.

Ten korpus jest przydatny jako controlled benchmark, ale **nie może samodzielnie być gold truth dla uczenia**, jeżeli expected labels zostały skonstruowane według tych samych reguł, które później mierzymy. D20 rozdziela `HUMAN_GOLD`, `INJECTED_SYNTHETIC`, `LEGACY_ENGINE` i `UNLABELED_DISCOVERY`, aby uniknąć self-confirming calibration.

## Architektura samouczenia

D20 nie wykonuje niekontrolowanego online learningu. Cykl jest wersjonowany:

`corpus -> dedupe -> PII filter -> feature extraction -> document-level counts -> log-odds + z-score + lift -> SHADOW snapshot -> holdout -> drift/rank gate -> VALIDATED -> jawna promocja -> ACTIVE`

### Matematyka leksemów

Dla każdego feature i label liczymy obecność na poziomie dokumentu, nie częstotliwość tokenu w jednym CV. To blokuje keyword stuffing jako sposób uczenia modelu.

Stosowany jest wygładzony log-odds:

`L = log((a + alpha)/(A-a+alpha)) - log((b+alpha)/(B-b+alpha))`

oraz przybliżony z-score z wariancji komórek tabeli 2x2. Feature może zostać propozycją dopiero po spełnieniu minimalnego support, |z| i lift.

## Własność modułów

- D08: char/OCR patterns, nie merytoryka.
- D09: aliasy i relacje kompetencji; related-tech nigdy samo nie spełnia MUST.
- D10: słownik uprawnień, certyfikatów, języków i edukacji.
- D11: wzorce temporalne i krzywe recency.
- D12: słownik tytułów/seniority + kontekst odpowiedzialności.
- D13: pozytywne i negatywne konteksty liczb.
- D14: repetition/buzzword/stuffing; OCR tylko jako uncertainty.
- D15: daty, nakładanie zatrudnień, anachronizmy technologiczne i sprzeczności.
- D16: kalibracja READY / READY_WITH_WARNINGS / NOT_READY, bez udawania probability of hire.
- D17: wyłącznie calibration/aggregation; nie uczy leksemów bezpośrednio.

## Privacy gate

Baza adaptacyjna nie przechowuje surowych CV ani user IDs. Lexeme statistics wymagają minimalnego support i przechodzą PII filter. Tabele adaptive są niedostępne dla `anon` i `authenticated`; zapis/aktywacja należą do kontrolowanego procesu administracyjnego.
