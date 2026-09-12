# D09 — Real CV Corpus Protocol

## 1. Cel

Prawdziwe CV służą do empirycznej walidacji i kalibracji D08/D09. Nie są częścią publicznego kodu produktu.

## 2. Zasada prywatności

Surowe CV, JD i pliki źródłowe zawierające PII NIE trafiają do publicznego repozytorium.

`.gitignore` blokuje katalogi:

```text
.private-corpus/
corpus-private/
audit-corpus-private/
```

## 3. Co może trafić do repo

Do repo wolno commitować wyłącznie materiały pozbawione danych identyfikujących, np.:

- anonimowy case ID;
- typ dokumentu;
- syntetyczne/zanonimizowane requirement IDs;
- canonical entity IDs;
- ręczne etykiety match/no-match;
- oczekiwane relacje rankingowe;
- zagregowane precision/recall/F1;
- histogramy i drift summaries;
- parametry kalibracyjne;
- testy regresyjne odtworzone na danych syntetycznych.

## 4. Czego nie commitujemy

- imion i nazwisk;
- adresów;
- e-maili;
- telefonów;
- zdjęć;
- nazw plików pozwalających zidentyfikować osobę;
- pełnej historii zatrudnienia konkretnej osoby;
- surowych PDF/DOCX;
- fragmentów CV wystarczających do wyszukania osoby w Internecie;
- niezanonimizowanych JD powiązanych z prywatną kandydaturą, jeśli zawierają dane poufne.

## 5. Lokalny case ID

Każdy dokument dostaje lokalny pseudonim, np.:

```text
CV_REAL_0001
CV_REAL_0002
...
```

Mapowanie `case ID -> oryginalny plik` pozostaje wyłącznie lokalnie.

## 6. Adnotacja requirement-level

Minimalny rekord anotacyjny:

```json
{
  "caseId": "CV_REAL_0001",
  "jobId": "JD_REAL_0012",
  "requirements": [
    {
      "canonicalId": "postgresql",
      "priority": "MUST",
      "status": "CONFIRMED",
      "evidenceDepthBand": "EXPERIENCE",
      "semanticRelation": "EXACT"
    }
  ]
}
```

Nie przechowujemy surowego zdania z CV, jeśli nie jest to niezbędne do debugowania lokalnego.

## 7. Ranking annotation

Preferowana etykieta:

```json
{
  "jobId": "JD_REAL_0012",
  "betterId": "CV_REAL_0004",
  "worseId": "CV_REAL_0017"
}
```

Jest bardziej stabilna niż wymyślanie arbitralnego wyniku `73/100`.

## 8. Split bez leakage

Nie dzielimy losowo pojedynczych kopii dokumentów, jeśli ten sam kandydat lub prawie identyczne CV może wystąpić wielokrotnie.

Split musi być grupowany co najmniej po:

- kandydacie;
- rodzinie CV;
- w miarę możliwości rodzinie JD.

## 9. D08 i D09 używają corpus inaczej

### D08

Potrzebuje realnych plików dokumentów do walidacji:

- extraction;
- reading order;
- encoding;
- layout;
- PDF/DOCX/OCR.

### D09

Potrzebuje przede wszystkim:

- wiarygodnego tekstu/struktury z D08 lub Vault;
- JD;
- ręcznych requirement labels;
- semantic match labels;
- rankingów CV dla tego samego JD.

## 10. Zasada audytu

Każda zmiana parametrów wyprowadzona z prywatnego corpus musi zostawić publiczny ślad metodologiczny bez PII:

```text
corpus version/hash
n cases
n JD
split method
parser P/R/F1
pairwise ranking accuracy
uncertainty coverage
changed parameters
holdout result
```

Dzięki temu matematyka jest audytowalna, ale dane ludzi pozostają prywatne.
