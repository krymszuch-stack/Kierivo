# D08 FINAL SPEC v2 — Structural Readability & Machine Extraction

Status: **normatywna specyfikacja modułu przed implementacją**  
Data: 2026-09-11  
Moduł: `MOD_STRUCTURAL_READABILITY`  
Domena: `DOCUMENT_QUALITY`  
Zależność: D07 Audit Core 1.0 / Score Ledger  
Linear: ADR-111

---

## 0. Cel

D08 mierzy **techniczną czytelność i determinizm strukturalny finalnego dokumentu CV**.

Pytanie modułu brzmi:

> Czy treść, która rzeczywiście znajduje się w dokumencie, może zostać jednoznacznie odczytana, zrekonstruowana i podzielona na logiczne jednostki przez deterministyczny parser dokumentów?

D08 **nie ocenia wartości kandydata, jakości doświadczenia ani kompletności kariery**.

Surowość D08 ma wynikać z dowodów technicznych, a nie z arbitralnego zaniżania wyniku.

---

# 1. Granice odpowiedzialności

## In scope

D08 ocenia:

- integralność natywnej warstwy tekstowej,
- zgodność tekstu źródłowego z tekstem po ekstrakcji,
- kolejność odczytu,
- granice i rozpoznawalność istniejących sekcji,
- topologię layoutu,
- nakładanie, clipping i niejednoznaczność warstw,
- jakość kodowania Unicode po normalizacji,
- rozróżnialność nagłówków,
- parsowalność **obecnych** pól strukturalnych, np. dat i kontaktu,
- strukturę istniejących list/punktorów,
- ukryty/off-page/duplikowany tekst mogący zaburzyć ekstrakcję.

## Out of scope

D08 świadomie **nie ocenia**:

- czy kandydat ma doświadczenie zawodowe,
- czy ma telefon, LinkedIn, GitHub lub zdjęcie,
- jakości merytorycznej doświadczenia,
- dopasowania do JD,
- poziomu kompetencji,
- jakości języka,
- liczby osiągnięć,
- prawdziwości faktów względem Master Vault,
- obowiązkowych pól profilu,
- regionalnej zgodności zdjęcia/PII,
- „szans przejścia ATS”.

Brak doświadczenia należy do D18/D16, nie do D08.
Brak telefonu lub LinkedIna nie może obniżyć D08.

---

# 2. Fundamentalna zasada pomiarowa

D08 odróżnia trzy sytuacje:

1. **element istnieje i jest czytelny** → zdobywa punkty;
2. **element istnieje, ale jest technicznie uszkodzony** → traci jakość w swoim komponencie;
3. **element definicyjnie nie występuje** → `NOT_APPLICABLE` dla tego podpomiaru, a nie 0 i nie 100.

Przykład:

- CV bez list wypunktowanych nie jest strukturalnie gorsze tylko dlatego, że nie ma punktorów;
- CV z listą, której wcięcia są popsute, powinno stracić punkty w komponencie list.

D08 może renormalizować **wyłącznie wagi komponentów definicyjnie nieaplikowalnych**. Braku lub awarii danych, które powinny istnieć dla aktywnego pomiaru, nie wolno usuwać z mianownika.

---

# 3. Rurociąg danych

```text
DOCUMENT INPUT
  ├─ generated CV AST / renderer tree (gdy dostępne)
  ├─ PDF/DOCX layout objects
  └─ extracted text streams
        ↓
DocumentGeometryAndTextExtractor
        ↓
CanonicalDocumentStructureSignals
        ↓
Evidence Graph (D07)
        ↓
StructuralReadabilityScorer
        ↓
Score Ledger
        ↓
AuditModuleResult
```

Scorer D08 nie czyta surowego PDF/DOCX ani Master Vault.

---

# 4. Źródła referencyjne i dwa profile pomiaru

## 4.1. `SOURCE_AWARE`

CVelocity wygenerowało dokument i posiada źródłowy AST/render tree.

Możemy wtedy porównać:

- tekst oczekiwany z tekstem wyekstrahowanym,
- oczekiwaną kolejność bloków z kolejnością ekstrakcji,
- oczekiwane granice sekcji z wykrytymi.

To jest najwyższy poziom confidence D08.

## 4.2. `EXTERNAL_DOCUMENT`

Dokument został dostarczony z zewnątrz i nie posiadamy źródłowego AST.

Pomiar opiera się na:

- porównaniu niezależnych deterministycznych strumieni ekstrakcji, jeśli dostępne,
- geometrii layoutu,
- strukturze fontów i bloków,
- lokalnych relacjach kolejności,
- spójności kodowania i parsera.

Brak referencyjnego AST obniża confidence, ale nie musi unieważniać score.

```ts
export type D08ReferenceProfile =
  | 'SOURCE_AWARE'
  | 'EXTERNAL_DOCUMENT';
```

---

# 5. Wektory komponentów

D08 używa 8 komponentów.

Wagi poniżej są **initial priors do kalibracji na golden corpus**, nie wartościami empirycznie potwierdzonymi.

| Komponent | Base weight |
|---|---:|
| Text Layer Integrity | 0.20 |
| Reading Order Integrity | 0.22 |
| Section Topology | 0.15 |
| Layout Topology Safety | 0.13 |
| Encoding & Lexical Integrity | 0.12 |
| Heading Distinguishability | 0.07 |
| Structured Field Parseability | 0.07 |
| List Structure Consistency | 0.04 |
| **Suma** | **1.00** |

Jeżeli komponent jest definicyjnie `NOT_APPLICABLE`, jego `baseWeight` nie jest przyznawany jako darmowe punkty.

Dla zbioru aktywnych komponentów `A`:

```text
w_i_effective = w_i_base / Σ(j∈A) w_j_base
```

Taka renormalizacja jest legalna tylko dla prawdziwego N/A.

---

# 6. Komponent 1 — Text Layer Integrity (`w=0.20`)

## Cel

Sprawdzić, czy tekst dokumentu zachowuje treść podczas ekstrakcji.

Ten komponent nie ocenia kolejności. Kolejność należy do komponentu 2.

## SOURCE_AWARE

Po normalizacji Unicode NFKC, whitespace i tokenizacji porównujemy multizbiory tokenów źródła i ekstrakcji.

```text
P_text = matchedTokenMass / extractedTokenMass
R_text = matchedTokenMass / sourceTokenMass
F1_text = 2 * P_text * R_text / (P_text + R_text)
```

Jeżeli mianownik = 0, stan jest rozstrzygany przez applicability, a nie sztuczne `1.0`.

Bazowo:

```text
φ_text = F1_text
```

Nie dokładamy tu arbitralnej transformacji tylko po to, aby wynik był niższy. Surowość zapewniają hard capy przy realnej utracie tekstu.

## EXTERNAL_DOCUMENT

Jeśli są dwa niezależne deterministyczne extractory, liczymy ich zgodność tokenową analogicznie do F1.

Przy tylko jednym extractorze komponent może być policzony częściowo, ale jego evidence/provenance obniża confidence.

## Ważne

- duplikowany text layer obniża precision;
- brakujące fragmenty obniżają recall;
- kolejność tokenów nie wpływa na ten komponent.

---

# 7. Komponent 2 — Reading Order Integrity (`w=0.22`)

## Cel

Zmierzyć, czy kolejność bloków/linii po ekstrakcji odpowiada logicznemu porządkowi czytania.

Nie używamy prostego liczenia przejść `linia lewa → linia prawa`.

## SOURCE_AWARE

Budujemy zbiór porównywalnych par bloków `P` na podstawie źródłowego AST i semantycznej kolejności renderera.

Dla każdej pary `(a,b)` określamy wagę `q_ab`, zależną od znaczenia relacji. Relacja między nagłówkiem a własną sekcją ma większą wagę niż relacja między dwiema dekoracyjnymi liniami.

Weighted Kendall discordance:

```text
d_order = Σ q_ab * I(order_extracted(a,b) ≠ order_expected(a,b))
          / Σ q_ab
```

`d_order ∈ [0,1]`.

Bazowa funkcja ciągła:

```text
φ_order = exp(-ln(2) * d_order / h_order)
```

`h_order` jest half-life błędu kolejności.

Initial prior:

```text
h_order = 0.12
```

Czyli około 12% ważonej niezgodności redukuje komponent do 0.5. Parametr **musi zostać skalibrowany** na corpus, nie wolno traktować go jako prawdy rynkowej.

## EXTERNAL_DOCUMENT

Gdy nie znamy źródłowej kolejności, expected order buduje deterministyczny DAG geometrii:

- page order,
- vertical bands,
- containment,
- section headers,
- local column bands,
- logical list nesting.

Scorer używa odsetka konfliktów/cykli i lokalnych inversions. Confidence jest niższy niż SOURCE_AWARE.

---

# 8. Komponent 3 — Section Topology (`w=0.15`)

## Cel

Ocenić, czy **istniejące** sekcje są rozpoznawalne i mają stabilne granice.

D08 nie wymaga sekcji Experience/Skills/Education tylko dlatego, że są typowe.

## SOURCE_AWARE

Mamy referencyjne typy i granice sekcji.

```text
φ_sections = 0.65 * macroF1_label
           + 0.35 * boundaryF1
```

`macroF1_label` mierzy poprawność przypisania typu sekcji.
`boundaryF1` mierzy poprawność początku/końca bloków.

## EXTERNAL_DOCUMENT

Nie nazywamy wyniku klasyfikatora „prawdopodobieństwem”, jeżeli model nie jest skalibrowany probabilistycznie.

Używamy:

- deterministic match score,
- top-1/top-2 margin,
- boundary consistency,
- alias dictionary confidence.

Entropy można stosować wyłącznie do rzeczywiście skalibrowanego rozkładu probabilistycznego.

---

# 9. Komponent 4 — Layout Topology Safety (`w=0.13`)

## Cel

Ocenić ryzyko geometryczne niezależne od samego reading order.

**Liczba kolumn sama w sobie nie jest karą.**

Dwie kolumny, które ekstraktują się idealnie, nie mogą automatycznie dostać 0.85 tylko dlatego, że są dwiema kolumnami.

Mierzymy:

- unrelated text overlap ratio `r_overlap`,
- clipped text ratio `r_clip`,
- ambiguous z-order ratio `r_z`,
- nested layout complexity `r_nested`.

Każdy sygnał normalizujemy do jakości `q∈[0,1]` funkcją ciągłą.

Przykładowo:

```text
q_overlap = exp(-k_overlap * r_overlap)
q_clip    = exp(-k_clip * r_clip)
q_z       = exp(-k_z * r_z)
q_nested  = exp(-k_nested * r_nested)
```

Łączenie bazowe:

```text
φ_layout = Π q_i ^ α_i
```

czyli ważona średnia geometryczna jakości topologicznych.

Initial priors `k_*` i `α_i` są parametrami kalibracyjnymi.

## Anti-double-counting

Błąd kolejności wynikający z kolumn należy do `Reading Order Integrity`.

Ten sam `defectFingerprint` nie może ponownie ukarać layoutu, jeżeli layout component nie mierzy niezależnej właściwości, np. overlap/clipping.

---

# 10. Komponent 5 — Encoding & Lexical Integrity (`w=0.12`)

## Cel

Mierzyć **nierozwiązane** uszkodzenia tekstu po normalizacji.

Najpierw stosujemy Unicode NFKC.

Ligatura, którą NFKC poprawnie rozbije, nie jest błędem.

## Wagi anomalii — initial priors

```text
U+FFFD replacement char                  1.00
mojibake inside lexical token            1.00
private-use char inside lexical token    0.80
unresolved broken ligature               0.70
invalid control char                     0.60
private-use decorative icon outside word 0.10
```

Dodatkowy scope multiplier może podnieść wagę anomalii w:

- nagłówku sekcji,
- nazwie technologii,
- adresie e-mail,
- URL.

Weighted damage mass:

```text
d_enc = Σ severity_i * scopeMultiplier_i / max(1, lexicalCharacterCount)
```

Bazowa funkcja:

```text
φ_encoding = exp(-d_enc / τ_enc)
```

Initial prior:

```text
τ_enc = 0.008
```

`τ_enc` podlega obowiązkowej kalibracji.

Nie wolno liczyć dekoracyjnych ikon tak samo jak uszkodzonych liter w słowach.

---

# 11. Komponent 6 — Heading Distinguishability (`w=0.07`)

## Cel

Nagłówek ma być deterministycznie odróżnialny od body text, ale D08 nie narzuca jednego stylu wizualnego.

Odrzucamy regułę:

```text
Name > Section > Role > Body * 1.15
```

jako zbyt estetyczną i zależną od szablonu.

Dla każdego nagłówka budujemy cechy:

- relative font-size delta,
- font-weight delta,
- whitespace before/after,
- capitalization/lexical header pattern,
- alignment/block separation.

`separationScore(h)∈[0,1]` mówi, jak dobrze nagłówek odróżnia się od sąsiedniego body.

`levelConsistency∈[0,1]` mówi, czy nagłówki tego samego poziomu używają spójnych cech.

```text
φ_heading = 0.65 * mean(separationScore)
          + 0.35 * levelConsistency
```

Wagi 0.65/0.35 są initial priors do corpus.

Minimalistyczny nagłówek może dostać 1.0 bez dużego fontu, jeżeli jest jednoznacznie separowany innymi cechami.

---

# 12. Komponent 7 — Structured Field Parseability (`w=0.07`)

## Cel

Ocenić parsowalność **pól, które istnieją**, bez oceniania ich obecności.

### Daty

Nie premiujemy ISO tylko dlatego, że wygląda technicznie.

Ocena przykładowa:

```text
1.00 jednoznacznie parsowalne
0.70 parsowalne dopiero z jawnym locale
0.35 strukturalnie niejednoznaczne
0.00 nieparsowalne / niemożliwa data
```

`Jan 2022` i `2022-01` mogą oba dostać 1.0.

### Telefon

Nie wymagamy literalnego zapisu E.164 w CV.

Parser może znormalizować:

```text
+48 123 456 789
```

do E.164 przy znanym kraju.

### Email / URL

Oceniamy składniową parsowalność i jednoznaczność, nie obecność danego kanału.

### Agregacja

Liczymy weighted mean tylko po typach pól faktycznie obecnych.

Jeżeli żaden taki typ nie występuje, komponent jest `NOT_APPLICABLE` i jego waga podlega legalnej renormalizacji. Nie otrzymuje 1.0.

Brak telefonu/LinkedIna należy do kompletności, nie D08.

---

# 13. Komponent 8 — List Structure Consistency (`w=0.04`)

Jeżeli dokument posiada listy:

- glyph consistency,
- nesting clarity,
- hanging indent,
- alignment stability.

Wcięcia normalizujemy względem `em` lub szerokości strony, **nie w surowych pikselach**.

Przykład:

```text
indentDeviationNorm = stddev(indent / bodyFontSize)
q_indent = exp(-k_indent * indentDeviationNorm)
```

```text
φ_list = 0.40 * glyphConsistency
       + 0.35 * q_indent
       + 0.25 * hangingIndentRatio
```

Jeżeli dokument nie używa list, komponent jest `NOT_APPLICABLE`, a nie 100%.

---

# 14. Wynik komponentowy

Dla aktywnych komponentów:

```text
S_components = 100 * Σ w_i_effective * φ_i
```

Każdy `φ_i∈[0,1]`.

`w_i_effective` sumują się do 1 tylko po legalnym odrzuceniu N/A.

Score Ledger musi pokazać:

- base weight,
- effective weight,
- normalized value,
- contribution,
- Evidence IDs.

---

# 15. Penalties D08

Większość technicznych wad D08 powinna być modelowana wewnątrz właściwego komponentu, a nie drugi raz jako penalty.

Penalties rezerwujemy dla **niezależnych zachowań adversarial**, których nie reprezentuje zwykła jakość dokumentu.

Initial registry:

### `PEN_D08_HIDDEN_TEXT`

Ukryty tekst, np.:

- opacity≈0,
- biały tekst na białym tle,
- font ekstremalnie mały,
- text outside visible crop,
- tekst przykryty w sposób nieprzypadkowy.

Kara musi zależeć od udziału ukrytego tekstu, nie od jednego boolean.

### `PEN_D08_DUPLICATE_INVISIBLE_LAYER`

Duplikowana warstwa tekstowa generująca fałszywe powtórzenia po ekstrakcji.

## Anti-double-dipping

Jeżeli duplikacja już obniżyła `Text Layer Integrity` przez precision, penalty może dotyczyć tylko **intencjonalnego/adversarial** aspektu i używa osobnego defect fingerprint.

---

# 16. Hard Caps D08 v2

Hard caps są rygorystyczne, ale wyłącznie dla technicznie katastrofalnych stanów.

Wszystkie progi są **initial calibration priors**.

## `HC_D08_TEXT_LAYER_CRITICAL`

Warunek SOURCE_AWARE:

```text
R_text < 0.40
```

przy wysokim extraction confidence.

Scope: `MODULE`
Initial cap: `25`.

## `HC_D08_READING_ORDER_CRITICAL`

```text
d_order > 0.25
```

Scope: `MODULE`
Initial cap: `40`.

## `HC_D08_ENCODING_CRITICAL`

```text
d_enc > 0.03
```

Scope: `MODULE`
Initial cap: `45`.

## `HC_D08_HIDDEN_TEXT_MASSIVE`

Znaczna część dokumentu zawiera tekst niewidoczny dla człowieka, ale obecny w layerze.

Scope: `MODULE`.
Initial cap: `50`.

## Nie istnieją w D08

Usuwamy z D08:

- globalny cap za brak doświadczenia,
- globalny cap za brak telefonu/e-mail,
- cap za sam fakt dwóch/trzech kolumn,
- cap za brak LinkedIna,
- cap za zdjęcie/PESEL wynikający z regionalnych praktyk HR.

Te problemy należą do innych kontraktów.

---

# 17. Brak tekstu ≠ automatycznie INSUFFICIENT_DATA

To rozróżnienie jest krytyczne.

## Przypadek A — dokument ma prawie zerową natywną warstwę tekstową, ale extractor poprawnie to wykrył

To jest **mierzona wada dokumentu**.

D08 może być `APPLICABLE` lub `PARTIALLY_APPLICABLE`, score może być bardzo niski, a confidence wykrycia problemu wysokie.

Nie twierdzimy, że „żaden ATS nie użyje OCR”. Komunikat brzmi:

> Dokument ma bardzo słabą natywną warstwę tekstową. CVelocity nie gwarantuje zachowania zewnętrznych systemów OCR.

## Przypadek B — pipeline ekstrakcji sam uległ awarii

Nie wiemy, czy dokument jest zły.

```text
applicability = INSUFFICIENT_DATA
score = null
confidence = 0
```

To jest błąd pomiaru, nie wynik 10/100.

---

# 18. Confidence

D08 **nie implementuje własnej formuły confidence**.

Zakazane jest np.:

```text
confidence = min(1, textLength/1200) * encodingFactor
```

D08 dostarcza do centralnego kalkulatora D07:

- expected evidence coverage,
- provenance,
- extraction confidence,
- independent evidence groups.

Centralny `ConfidenceCalculator` z D07 zwraca finalne confidence.

Dzięki temu CV o 500 słowach nie jest automatycznie mniej wiarygodne niż CV o 1200 słowach.

---

# 19. Applicability D08

## APPLICABLE

Kluczowe sygnały text integrity i reading order są mierzalne, a pipeline ekstrakcji działa prawidłowo.

## PARTIALLY_APPLICABLE

Część pomiarów jest wiarygodna, ale np. zewnętrzny PDF nie posiada źródłowego AST albo część geometrii jest niedostępna.

Score może istnieć, ale confidence musi to pokazać.

## INSUFFICIENT_DATA

Pipeline pomiarowy nie potrafi dostarczyć nawet minimalnego wiarygodnego zestawu sygnałów.

```text
score = null
```

## NOT_APPLICABLE

D08 zasadniczo dotyczy każdego finalnego CV dokumentowego. Ten stan będzie rzadki, np. gdy audyt dotyczy wyłącznie profilu bez wygenerowanego dokumentu.

---

# 20. Score Ledger

D08 musi generować ledger zgodny z D07/D20.

Przykład:

```text
TEXT LAYER             +18.8 / 20.0
READING ORDER          +15.1 / 22.0
SECTION TOPOLOGY       +13.4 / 15.0
LAYOUT TOPOLOGY        +11.9 / 13.0
ENCODING               +11.7 / 12.0
HEADINGS                +5.9 /  7.0
FIELDS                  +6.2 /  7.0
LISTS                   +3.5 /  4.0
-----------------------------------
COMPONENTS              86.5

PENALTIES
Hidden text             -4.0
-----------------------------------
AFTER PENALTIES         82.5

HARD CAP
Reading order cap       40.0
-----------------------------------
FINAL                   40.0 / 100
```

Każda linia musi prowadzić do Evidence IDs.

Frontend nie liczy nic samodzielnie.

---

# 21. Golden Corpus D08

Minimum 20 fixtures:

1. `D08_01_CLEAN_SINGLE_COLUMN`
2. `D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE`
3. `D08_03_TWO_COLUMN_INTERLEAVED`
4. `D08_04_THREE_COLUMN_ORDER_SAFE`
5. `D08_05_SCAN_NO_NATIVE_TEXT`
6. `D08_06_OCR_LAYER_CORRECT`
7. `D08_07_MOJIBAKE_POLISH`
8. `D08_08_NFKC_LIGATURE_CLEAN`
9. `D08_09_NESTED_TABLE_LAYOUT`
10. `D08_10_FLOATING_BOX_OVERLAP`
11. `D08_11_CLIPPED_TEXT`
12. `D08_12_MIXED_DATES_PARSEABLE`
13. `D08_13_AMBIGUOUS_DATES`
14. `D08_14_MINIMALIST_HEADINGS_PARSEABLE`
15. `D08_15_INCONSISTENT_LIST_INDENTS`
16. `D08_16_NO_LISTS_VALID`
17. `D08_17_HIDDEN_WHITE_TEXT`
18. `D08_18_OFF_PAGE_TEXT`
19. `D08_19_DUPLICATE_TEXT_LAYER`
20. `D08_20_POLISH_DIACRITICS_CLEAN`

Nie przechowujemy jedynie oczekiwanych dokładnych score.

Corpus definiuje przede wszystkim:

- relacje porządkowe,
- hard constraints,
- invarianty,
- dozwolone zakresy.

---

# 22. Obowiązkowe relacje corpus

### Kolumny same w sobie nie są wadą

```text
score(CLEAN_SINGLE_COLUMN)
≈ score(CLEAN_TWO_COLUMN_ORDER_SAFE)
```

Różnica docelowo nie większa niż tolerancja kalibracyjna, np. 3 pkt.

### Przeplot jest wadą

```text
score(CLEAN_TWO_COLUMN_ORDER_SAFE)
> score(TWO_COLUMN_INTERLEAVED)
```

z istotnym marginesem.

### NFKC usuwa fałszywe uszkodzenie

```text
score(NFKC_LIGATURE_CLEAN)
≈ score(POLISH_DIACRITICS_CLEAN)
```

### Brak listy nie jest błędem

```text
NO_LISTS_VALID
```

nie dostaje kary za sam brak punktorów.

### Usunięcie LinkedIna nie zmienia D08

Jeżeli usunięcie LinkedIna nie psuje istniejącego pola, D08 pozostaje niezmienione w granicy numerycznej tolerancji.

### Treść kompetencji nie wpływa na D08

Podmiana `Python` na `Excel` bez zmiany geometrii nie może zmieniać D08 poza wpływem długości/layoutu wynikającym z realnego renderu.

---

# 23. Testy monotoniczności

Obowiązkowe:

- poprawa reading order nie obniża score,
- naprawienie mojibake nie obniża score,
- usunięcie clippingu nie obniża score,
- poprawa section boundary detection nie obniża score,
- poprawa parsowalności daty nie obniża score,
- zmniejszenie hidden text nie obniża score.

Każdy test musi izolować mierzoną zmianę.

---

# 24. Testy independence

Zmiana sygnału poza domeną D08 nie może istotnie zmieniać wyniku:

- wysokość wynagrodzenia,
- seniority w treści,
- liczba certyfikatów,
- jakość osiągnięć,
- semantyka JD.

Jeżeli layout pozostaje identyczny, te zmiany powinny być niewidoczne dla D08.

---

# 25. Testy perturbacyjne

Mała zmiana wejścia powinna powodować małą zmianę score, jeżeli nie przekracza logicznego hard blockera.

Testujemy m.in.:

- 1 → 2 uszkodzone glify,
- 1% → 1.1% discordance,
- zmianę marginesu bez clippingu,
- minimalną zmianę indentu,
- jedną dodatkową linię w sekcji.

Brak przypadkowych klifów.

---

# 26. Adversarial suite

D08 musi wykrywać co najmniej:

- biały tekst na białym tle,
- `opacity:0`,
- tekst poza crop/page box,
- ekstremalnie mały font z keywordami,
- duplikowaną niewidoczną warstwę tekstową,
- nakładające się textboxy,
- z-index zmieniający logiczną kolejność,
- wielokrotne ukryte kopie JD.

Silnik deterministyczny nigdy nie wykonuje instrukcji znalezionych w treści.

---

# 27. Integracyjne testy dokumentów

Same unit tests na gotowych sygnałach są niewystarczające.

D08 wymaga fixture'ów prawdziwych plików PDF/DOCX wygenerowanych kontrolowanym pipeline.

Dla każdego fixture zapisujemy:

- source AST,
- plik dokumentu,
- expected text stream,
- extracted text stream,
- geometry snapshot,
- expected evidence relationships.

Odbiór obejmuje ręczne porównanie:

```text
PDF/DOCX → zaznaczenie/kopiowanie → TXT
```

oraz wynik parsera CVelocity.

---

# 28. Calibration parameters

Parametry, których **nie wolno zamrozić bez corpus**:

- `h_order`,
- `τ_enc`,
- `k_overlap`,
- `k_clip`,
- `k_z`,
- `k_nested`,
- heading weights,
- list weights,
- hard-cap thresholds,
- hard-cap limits,
- base component weights.

Każdy PR zmieniający te parametry musi generować D07 Calibration Drift Report.

---

# 29. Zakazane skróty implementacyjne

D08 nie może:

- przyznawać 100 za brak danych,
- zwracać `score=10` przy `INSUFFICIENT_DATA`,
- karać za brak sekcji doświadczenia,
- karać za brak telefonu/LinkedIna,
- karać za sam fakt 2 kolumn,
- traktować PESEL/zdjęcia jako uniwersalnego błędu strukturalnego,
- liczyć confidence długością tekstu,
- liczyć nieskalibrowanego classifier score jako „probability”,
- używać surowych pikseli do porównania indentów między różnymi DPI,
- stosować penalty do wady już w pełni uwzględnionej przez component bez defect-budget,
- implementować matematyki ponownie w UI.

---

# 30. Kryterium Done D08

D08 można odebrać dopiero, gdy:

1. implementation używa kontraktów D07;
2. extractor i scorer są rozdzielone;
3. wszystkie 8 komponentów mają jawne evidence;
4. Score Ledger dokładnie odtwarza runtime score;
5. confidence pochodzi z centralnego D07 calculatora;
6. co najmniej 20 fixture'ów przechodzi corpus;
7. monotonicity suite jest zielona;
8. independence suite jest zielona;
9. perturbation suite jest zielona;
10. adversarial suite jest zielona;
11. integracyjne PDF/DOCX tests są zielone;
12. calibration drift mieści się w zaakceptowanych limitach;
13. ręczny PDF→TXT smoke jest wykonany;
14. nie ma hard capów za brak treści należącej do D16/D18;
15. żaden wynik nie jest przedstawiany jako wynik zewnętrznego ATS.

---

# 31. Decyzja normatywna

D08 ma być **surowym audytorem jakości dokumentu, nie policjantem kompletności CV**.

Najważniejsza własność:

> Dokument z dwiema kolumnami, ale idealną ekstrakcją może być lepszy strukturalnie od źle zbudowanego dokumentu jednokolumnowego.

Surowość wynika z realnej utraty informacji, nie z uprzedzeń wobec konkretnego szablonu.
