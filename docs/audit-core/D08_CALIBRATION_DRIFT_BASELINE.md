# D08 — Synthetic Calibration Drift Baseline

Data: 2026-09-11  
Engine: `D08.structural-readability.v2`  
Config: `D08.priors.2026-09-11`  
Corpus: `D08.synthetic-corpus.v1`

## Status tego baseline

Ten dokument opisuje **techniczny baseline regresyjny**, a nie empiryczną kalibrację D08.

Baseline został wygenerowany z runtime `scoreStructuralReadability` na 20 kontrolowanych przypadkach syntetycznych. Jego zadaniem jest wykrywać niezamierzone zmiany matematyki, confidence, hard capów i relacji porządkowych podczas dalszego rozwoju.

Nie wolno na jego podstawie twierdzić, że:

- wagi D08 są skalibrowane rynkowo;
- progi odpowiadają rzeczywistym zachowaniom ATS;
- wynik przewiduje przejście rekrutacji;
- rozkład score odpowiada rozkładowi prawdziwych CV.

Initial priors pozostają `CALIBRATION_REQUIRED` do czasu walidacji na kontrolowanym korpusie prawdziwych dokumentów.

## Zamrożony snapshot

| Case | Score | Confidence | Hard cap |
|---|---:|---:|---|
| D08_01_CLEAN_SINGLE_COLUMN | 100.000000 | 0.977757 | — |
| D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE | 100.000000 | 0.977757 | — |
| D08_03_TWO_COLUMN_INTERLEAVED | 40.000000 | 0.977757 | `HC_D08_READING_ORDER_CRITICAL` |
| D08_04_THREE_COLUMN_ORDER_SAFE | 100.000000 | 0.977757 | — |
| D08_05_SCAN_NO_NATIVE_TEXT | 25.000000 | 0.977757 | `HC_D08_TEXT_LAYER_CRITICAL` |
| D08_06_OCR_LAYER_CORRECT | 100.000000 | 0.977757 | — |
| D08_07_MOJIBAKE_POLISH | 90.677562 | 0.977757 | — |
| D08_08_NFKC_LIGATURE_CLEAN | 100.000000 | 0.977757 | — |
| D08_09_NESTED_TABLE_LAYOUT | 98.189204 | 0.977757 | — |
| D08_10_FLOATING_BOX_OVERLAP | 95.541609 | 0.977757 | — |
| D08_11_CLIPPED_TEXT | 96.630637 | 0.977757 | — |
| D08_12_MIXED_DATES_PARSEABLE | 99.883333 | 0.977757 | — |
| D08_13_AMBIGUOUS_DATES | 96.966667 | 0.977757 | — |
| D08_14_MINIMALIST_HEADINGS_PARSEABLE | 99.058500 | 0.977757 | — |
| D08_15_INCONSISTENT_LIST_INDENTS | 98.240000 | 0.977757 | — |
| D08_16_NO_LISTS_VALID | 100.000000 | 0.977757 | — |
| D08_17_HIDDEN_WHITE_TEXT | 88.028448 | 0.977757 | — |
| D08_18_OFF_PAGE_TEXT | 94.134551 | 0.977757 | — |
| D08_19_DUPLICATE_TEXT_LAYER_CONFIRMED | 90.497871 | 0.977757 | — |
| D08_20_POLISH_DIACRITICS_CLEAN | 100.000000 | 0.977757 | — |

Snapshot został odczytany bezpośrednio z CI/runtime przed zamrożeniem w `syntheticBaseline.ts`. Nie został ręcznie dobrany do oczekiwanego rozkładu.

## Bramka driftu

D08 sprawdza co najmniej:

- medianę bezwzględnego driftu score ≤ 0.25;
- P95 driftu score ≤ 1.0;
- maksymalny drift score ≤ 2.0;
- P95 driftu confidence ≤ 0.02;
- brak niezaakceptowanych zmian hard capów;
- brak inwersji zdefiniowanych relacji semantycznych.

Zmiana przekraczająca bramkę nie jest automatycznie błędem algorytmu. Oznacza jednak, że PR zmienił semantykę pomiaru i wymaga jawnej decyzji oraz nowego baseline zamiast cichego przesunięcia liczb.

## Następny poziom kalibracji: real-CV corpus

Po dostarczeniu prawdziwych CV powstaje osobna warstwa korpusu empirycznego. Powinna obejmować co najmniej:

1. dokument źródłowy oraz finalny PDF/DOCX;
2. anonimowy identyfikator przypadku, bez PII w repo;
3. ręcznie opisaną oczekiwaną kolejność i znane wady techniczne;
4. niezależny extraction stream lub ręcznie zweryfikowany TXT;
5. etykiety ground truth dla text loss, order inversion, encoding, clipping, overlap i adversarial text;
6. wersję generatora / edytora, jeśli dokument pochodzi z CVelocity.

Ten korpus nie ma zastępować baseline syntetycznego. Synthetic corpus chroni inwarianty; real-CV corpus służy kalibracji parametrów i sprawdzaniu trafności w rzeczywistych dokumentach.
