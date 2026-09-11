# D07 — Score Ledger / Explainability UI Contract

Status: **normatywny addendum do D07 FINAL SPEC v2**  
Data: 2026-09-11  
Cel: każdy wynik CVelocity ma być możliwy do rozłożenia przez użytkownika na jawny rachunek punktów, dowodów, kar i ograniczeń.

---

## 1. Zasada produktu

Użytkownik nie może otrzymać wyłącznie liczby typu `73/100`.

Każdy moduł audytu musi być klikalny i otwierać **Rozliczenie wyniku** (`Score Ledger`).

Ledger odpowiada na pytania:

1. Za co zdobyłem punkty?
2. Czego nie zdobyłem?
3. Za co realnie odjęto mi punkty?
4. Czy zadziałał hard cap?
5. Z jakiego fragmentu CV / Vaultu / JD pochodzi decyzja?
6. Jak powstał wynik końcowy?
7. Jak pewny jest ten pomiar?
8. Co mogę poprawić, aby wynik wzrósł?

**Zakaz:** UI nie może sprowadzać całej matematyki do nieobjaśnionego progress bara.

---

# 2. Cztery klasy wizualne

## 2.1. EARNED — zielone

Punkty faktycznie zdobyte przez komponent dodatni.

Przykład:

```text
Czytelna kolejność dokumentu      +22.5 / 25.0
Rozpoznane sekcje                 +14.0 / 20.0
Poprawna hierarchia nagłówków     +11.0 / 15.0
```

Kolor: zielony.

## 2.2. UNREALIZED — neutralne / szare

Punkty możliwe do zdobycia, ale nieuzyskane.

To **nie jest kara**.

Przykład:

```text
Metryki osiągnięć                  4.0 / 20.0
Niezdobyty potencjał              16.0 pkt
```

UI nie może przedstawiać tego jako `-16`, ponieważ matematycznie nie nastąpiło odjęcie 16 punktów. Kandydat po prostu zdobył 4/20.

Kolor: neutralny / szary, opcjonalnie delikatny czerwony akcent diagnostyczny, ale bez znaku minus.

## 2.3. PENALTY — czerwone

Jawna kara za rozpoznaną wadę, która nie jest już zawarta w komponencie dodatnim.

Przykład:

```text
Keyword stuffing                  -8.0
Sprzeczna data                    -12.0
Powtórzenie tej samej frazy       -3.0
```

Kolor: czerwony.

Każda kara musi mieć `Penalty.ruleCode`, `defectFingerprint` i Evidence IDs.

## 2.4. HARD CAP — pomarańczowe

Hard cap nie jest karą punktową. Jest logicznym sufitem.

Przykład:

```text
Wynik po komponentach i karach: 72.4
Hard cap: uszkodzona kolejność odczytu
Maksymalny dozwolony wynik: 60.0
Wynik końcowy: 60.0
```

Kolor: pomarańczowy / bursztynowy.

UI nie może przedstawiać hard capu jako `-12.4`, ponieważ jego semantyka to `min(score, cap)`, nie subtraction.

---

# 3. Kanoniczne równanie modułu

Każdy moduł prezentuje pełny rachunek:

```text
S_components = Σ contribution_i
S_penalized  = max(0, S_components - Σ appliedPenalty_j)
S_final      = min(S_penalized, effectiveModuleCap)
```

Jeżeli brak aktywnego hard capu:

```text
S_final = S_penalized
```

Wagi komponentów muszą sumować się do 1.0.

Każdy `contribution_i`:

```text
contribution_i = normalizedValue_i × weight_i × 100
```

---

# 4. Przykład pełnego Ledgera

```text
STRUKTURA I ODCZYT

ZDOBYTE PUNKTY
────────────────────────────────────
Kolejność odczytu             +22.5 / 25
Rozpoznanie sekcji            +14.0 / 20
Nagłówki                      +11.0 / 15
Daty                           +8.0 / 10
Kontakt                        +9.0 / 10
Bezpieczny layout              +7.0 / 10
Kodowanie                      +4.0 / 5
Spójność punktorów             +3.5 / 5
────────────────────────────────────
SUMA KOMPONENTÓW                    79.0

KARY
────────────────────────────────────
Nietypowy separator              -3.0
Powielony nagłówek               -4.0
────────────────────────────────────
SUMA KAR                           -7.0

79.0 - 7.0 = 72.0

OGRANICZENIA
────────────────────────────────────
⚠ Hard cap HC_READING_ORDER
Powód: parser wykrył niespójną kolejność dwóch bloków
Sufit modułu: 65.0

min(72.0, 65.0) = 65.0
════════════════════════════════════
WYNIK KOŃCOWY                 65 / 100
PEWNOŚĆ POMIARU                 82%
════════════════════════════════════
```

---

# 5. Klikalne dowody

Każda pozycja Ledgera musi mieć przycisk / disclosure `Pokaż dowód`.

Przykład:

```text
Keyword stuffing    -8 pkt       [Pokaż dowód]
```

Po rozwinięciu:

```text
Reguła: PENALTY_KEYWORD_STUFFING
Źródło: CV > Podsumowanie
Wykryto: 6 powtórzeń frazy „Microsoft 365” w 74 słowach
Próg referencyjny: wynik funkcji density = 0.81
Confidence ekstrakcji: 0.98
```

Jeżeli źródło zawiera PII, UI pokazuje zredagowany fragment lub pointer, zgodnie z D07 FINAL SPEC v2.

---

# 6. Confidence jako osobny panel

Confidence nigdy nie jest dodawany ani odejmowany od score.

Kliknięcie `Pewność pomiaru 82%` pokazuje:

```text
Pokrycie dowodów          0.88
Jakość provenance        0.81
Jakość ekstrakcji        0.97
Niezależność próbki      0.72

C = C_cov^0.40 × C_prov^0.25 × C_ext^0.20 × C_sample^0.15
C = 0.82
```

Parametry i zaokrąglenia prezentowane w UI muszą zgadzać się z wartościami użytymi przez silnik.

---

# 7. Brak danych i N/A

## NOT_APPLICABLE

UI:

```text
Nie dotyczy tego audytu.
Ten moduł wymaga ogłoszenia o pracę, a uruchomiono tryb GENERAL_CV.
```

Bez czerwieni i bez `0/100`.

## INSUFFICIENT_DATA

UI:

```text
Za mało danych do uczciwego wyniku.
Brakuje 3 z 5 wymaganych klas dowodów.
```

Nie pokazujemy fikcyjnego procentu.

---

# 8. Rekomendacje powiązane z matematyką

Każda rekomendacja może pokazać **potencjalny przedział poprawy**, ale nie obiecuje dokładnego wyniku przed ponownym audytem.

Dopuszczalne:

```text
Dodaj mierzalny rezultat do 3 opisów stanowisk.
Potencjalnie wzmacnia komponent „Dowody wpływu” o ok. 6–14 pkt.
```

Niedopuszczalne:

```text
Dodaj 3 liczby, a wynik wzrośnie dokładnie o 11 pkt.
```

chyba że funkcja scoringowa rzeczywiście gwarantuje dokładnie taki efekt niezależnie od pozostałych sygnałów.

---

# 9. Widok globalnego konsensusu

Globalny wynik również musi być klikalny.

Pierwszy poziom pokazuje domeny:

```text
JAKOŚĆ DOKUMENTU       78   confidence 0.91
JOB FIT                61   confidence 0.84
EVIDENCE QUALITY       54   confidence 0.76
INTEGRITY              92   confidence 0.95
FORMAL READINESS       70   confidence 0.88
```

Następnie równanie agregatora, np. dla baseline geometrycznego:

```text
S_global = exp(Σ w_d × ln(S_d) / Σ w_d)
```

UI pokazuje efektywne wagi po legalnej renormalizacji `NOT_APPLICABLE`.

`INSUFFICIENT_DATA` nie znika po cichu i musi zostać pokazane jako problem kompletności zgodnie z D07 FINAL SPEC v2.

---

# 10. Drill-down UX

Hierarchia kliknięć:

```text
GLOBAL SCORE
  ↓
DOMAIN
  ↓
MODULE
  ↓
COMPONENT / PENALTY / HARD CAP
  ↓
EVIDENCE
  ↓
SOURCE POINTER
```

Każdy poziom ma breadcrumb, np.:

```text
Audyt > Evidence Quality > Twarde liczby > Metric validity > EXP_2_BULLET_3
```

---

# 11. Kontrakt danych dla UI

UI nie może ponownie liczyć wyniku według własnych reguł.

Silnik zwraca ledger razem z wynikiem albo dane wystarczające do jego deterministycznego odtworzenia.

```ts
export interface ScoreLedger {
  moduleId: string;
  componentTotal: number;
  penaltyTotal: number;
  scoreAfterPenalties: number;
  effectiveCap: number | null;
  finalScore: number | null;
  equationText: string;
  componentRows: ScoreLedgerComponentRow[];
  penaltyRows: ScoreLedgerPenaltyRow[];
  capRows: ScoreLedgerCapRow[];
  confidenceBreakdown: ConfidenceBreakdown;
}
```

Frontend ma być rendererem źródła prawdy z Audit Core, nie drugim silnikiem scoringowym.

---

# 12. Zasady kolorów i dostępności

Kolor nie może być jedynym nośnikiem informacji.

Każdy stan ma również ikonę i etykietę tekstową:

- `+` / `Zdobyte` — zielony,
- `Brak zdobycia` — neutralny,
- `−` / `Kara` — czerwony,
- `CAP` / `Ograniczenie` — pomarańczowy,
- `N/A` — szary,
- `?` / `Niewystarczające dane` — neutralny/żółty.

Wymagana zgodność z dark mode i czytelnością bez rozpoznawania kolorów.

---

# 13. Testy explainability

Każdy moduł od D08 musi mieć testy:

1. suma `componentRows` == `componentTotal`;
2. suma faktycznie zastosowanych penalties == `penaltyTotal`;
3. `scoreAfterPenalties = max(0, componentTotal - penaltyTotal)`;
4. `finalScore = min(scoreAfterPenalties, effectiveCap)` gdy cap istnieje;
5. finalScore w ledgerze == score zwrócony przez moduł;
6. każdy component ma >=1 Evidence ID albo jawny diagnostic code uzasadniający brak;
7. każda penalty ma Evidence ID;
8. każdy triggered hard cap ma Evidence ID / MissingEvidence ID;
9. równanie prezentowane użytkownikowi wykorzystuje dokładnie te same liczby, co runtime;
10. frontend nie implementuje alternatywnej matematyki wyniku.

---

# 14. Kryterium odbioru D07

D07 nie jest gotowe, jeśli kontrakt scoringowy pozwala zwrócić wynik, którego nie da się przedstawić użytkownikowi w Score Ledger.

**Invariant:**

> Jeżeli Audit Core pokazuje wynik X, musi istnieć skończony, deterministyczny i czytelny dla człowieka ślad obliczeniowy prowadzący od dowodów do X.

To jest obowiązkowy kontrakt wszystkich D08–D17.
