# D10 — Formal Requirements & Credentials

Status: **implementation / calibration required**

## Pytanie modułu

D10 odpowiada wyłącznie na pytanie:

> Czy kandydat posiada formalne kwalifikacje, poziomy językowe, poziom edukacji, uprawnienia lub inne formalne warunki, których wymaga konkretne JD?

D10 nie ocenia ogólnego dopasowania kompetencyjnego, seniority, świeżości technologii, naturalności tekstu ani jakości dokumentu.

## Izolacja sygnału

- D08 dostarcza jakość/kompletność ekstrakcji, ale jego score nie mnoży D10.
- D09 jest właścicielem job-skill alignment. D10 nie punktuje technologii ani doświadczenia.
- D11 jest właścicielem świeżości/recency.
- D12 jest właścicielem seniority.
- D14 jest właścicielem stuffing/naturalności.
- D15 jest właścicielem sprzeczności faktów.
- D16 może użyć potwierdzonego D10 CORE_MUST jako blocker readiness, ale nie przelicza ponownie jego dowodu.
- D20 może pomóc parserowi rozpoznawać aliasy formalne, ale nie może sam aktywować hard capa.

## Stany wymagań

Każdy requirement ma klasę `CORE_MUST`, `MUST` lub `PREFERRED` oraz status:

- `CONFIRMED` — wymóg spełniony przez wiarygodny dowód,
- `PARTIAL` — porządkowy próg jest blisko, ale formalnie niższy,
- `NOT_FOUND` — wiarygodne źródło nie zawiera dowodu,
- `UNKNOWN` — źródło/parser nie pozwala uczciwie stwierdzić spełnienia lub braku.

`UNKNOWN` nie jest zerem. Jeżeli dotyczy obowiązkowego wymogu, moduł zwraca `INSUFFICIENT_DATA` zamiast wymyślonego procentu.

## N/A

Jeżeli JD nie zawiera wymagań formalnych:

`score = null`, `applicability = NOT_APPLICABLE`.

Brak wymagań nie jest wynikiem 100/100.

## Matematyka

Dla wymogów obowiązkowych:

`M = sum(w_i * f_i) / sum(w_i)`

Dla preferowanych:

`P = sum(v_j * f_j) / sum(v_j)`

Priors przed kalibracją empiryczną:

`Score_raw = 100 * (0.85 * M + 0.15 * P)`

Jeżeli jedna grupa nie występuje, jej waga jest legalnie usuwana, a pozostała grupa jest renormalizowana do 1.0.

Nie istnieją punkty bazowe. Nie istnieją punkty za certyfikat, którego JD nie wymaga.

## Progi porządkowe

### CEFR

`A1 < A2 < B1 < B2 < C1 < C2 < NATIVE`

- poziom >= wymagany: `f=1.0`
- jeden poziom niżej: `f=0.45`
- dwa poziomy niżej: `f=0.15`
- dalej: `f=0`

Częściowy wynik ma wartość diagnostyczną. Nie oznacza formalnego spełnienia CORE_MUST.

### Edukacja

`PRIMARY < VOCATIONAL < SECONDARY < BACHELOR < MASTER < DOCTORATE`

Wyższy stopień może spełnić niższy próg, ale jeśli JD wymaga konkretnego kierunku, kierunek jest sprawdzany osobno.

### Prawo jazdy

Relacja jest kierunkowa. `CE -> C`, `DE -> D`, `BE -> B`. Samo `B` nie spełnia `C`.

## Hard cap

Hard cap 35 może zostać uruchomiony wyłącznie, gdy:

1. JD jawnie oznacza requirement jako `CORE_MUST`,
2. confidence ekstrakcji requirementu >= 0.90,
3. kompletność źródła kandydata >= 0.85,
4. fulfillment < 0.50,
5. brak nie wynika z `UNKNOWN`.

Adaptive D20 nie może aktywować knockoutu bez powyższego dowodu.

## Ważność i issuer

Jeżeli JD jawnie wymaga aktualnego dokumentu, brak daty ważności oznacza `UNKNOWN`, nie `CONFIRMED` i nie automatyczny `FAIL`.

Scorer nigdy nie korzysta z `Date.now()`. Data referencyjna audytu jest wstrzykiwana jawnie jako `referenceDateIso`, dzięki czemu wynik jest deterministyczny i reprodukowalny.

## Transparentny wynik

Warstwa `presentation.ts` wystawia dla UI każdy requirement jako osobny wiersz:

`requirement -> priority -> status -> fulfillment -> earnedPoints/maxPoints -> evidence -> explanation`

oraz równanie Score Ledger, score przed capem i finalny score po capie.

Kolor nie jest częścią matematyki. Core wystawia semantyczny ton `POSITIVE`, `PARTIAL`, `NEGATIVE`, `UNKNOWN`, a frontend mapuje go na styl.

## Calibration gate

Przed uznaniem D10 za skalibrowane potrzebny jest oznaczony corpus JD/CV z ground truth per formal requirement. Legacy score nie może być ground truth.

Minimalne metryki odbioru:

- precision/recall/F1 ekstrakcji formalnych requirementów,
- confusion matrix `CORE_MUST/MUST/PREFERRED`,
- false knockout rate = 0 na holdoucie krytycznym,
- osobne P/R dla certyfikatów, licencji, języków i edukacji,
- testy kierunkowości progów,
- brak regresji D08/D09/D20.
