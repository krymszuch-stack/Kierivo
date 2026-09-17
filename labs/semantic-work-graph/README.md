# Semantic Work Graph (`semantic-work-graph`)

Niezależny silnik semantyczny i graf wiedzy o profesjach, kompetencjach, narzędziach, urządzeniach, markach, technologiach i branżach.

## Cechy Systemu
- **Brak zgadywania kwalifikacji:** Pozwala odkrywać semantyczne powiązania relacyjne i stopień pewności (`confidence`), bez automatycznego przydzielania uprawnień użytkownikowi.
- **Weryfikowana propozycja Gemini:** Wszystkie sugestie pochodzące z Gemini API są niezweryfikowane (`status: 'proposed'`), dopóki nie zostaną zaakceptowane przez moderatora/właściciela.
- **Trwałość danych:** SQLite przez `better-sqlite3` (`data/swg.db`, tryb WAL) + Zod do walidacji danych i odpowiedzi modeli AI.
- **Deterministyczna lematyzacja polszczyzny:** Zamiast heurystycznego obcinania końcówek — słownik morfologiczny PoliMorf (IPI PAN) w tabeli `morph_dictionary`, odczyt po kluczu głównym (O(1)) z pamięcią podręczną LRU na 20 000 wpisów.
- **Tezaurus umiejętności ESCO:** Tabela `skill_synonyms` mapuje żargon i anglicyzmy na nazwy bazowe (`k8s` → `kubernetes`, `konteneryzacja dockerowa` → `docker`).
- **Auto-generowanie dokumentacji:** Automatyczna konwersja danych z bazy/JSON do czytelnej dokumentacji Markdown (`data/generated/knowledge-map.md` oraz `data/seed/professions-top-100.pl.md`).

## Szybki Start

```bash
# Instalacja zależności
npm install

# Import danych początkowych (Seed TOP 100 Profesji)
npm run seed:import

# Zasilenie leksykonu: słownik morfologiczny PoliMorf + tezaurus ESCO
npm run seed:lexicon

# Wygenerowanie dokumentów Markdown
npm run seed:export-md

# Uruchomienie testów jednostkowych
npm test

# Same testy leksykonu (lematyzacja + tezaurus)
npm run test:lexicon
```

## Leksykon: lematyzacja i tezaurus umiejętności

Dopasowanie CV do ogłoszenia rozbija się o fleksję: „zarządzałem”, „zarządzanie”
i „zarządzać” to dla wyszukiwania po ciągach znaków trzy różne słowa. Heurystyczne
obcinanie końcówek nie rozwiązuje tego problemu — myli się na obocznościach tematu
(`zespół` / `zespole`, `błąd` / `błędzie`) i produkuje lematy, których nie ma
w języku. Dlatego lematyzacja jest **słownikowa i deterministyczna**.

### Źródła danych

| Zbiór | Źródło | Tabela | Uwagi |
| --- | --- | --- | --- |
| Słownik morfologiczny | PoliMorf / SGJP (IPI PAN) | `morph_dictionary` | ~3,9 mln form; filtr części mowy: `subst`, `verb`, `fin`, `praet`, `ger`, `adj` |
| Taksonomia umiejętności | ESCO (Komisja Europejska), API `ec.europa.eu/esco/api` | `skill_synonyms` | polskie etykiety preferowane i alternatywne + odpowiedniki angielskie |
| Korpus dziedzinowy | wbudowany (`src/seed/lexicon/`) | obie | 100 technologii i czasowniki akcji; słownictwo IT, którego PoliMorf nie zna |

Pobrane archiwa lądują w `data/seed/` i nie są wersjonowane — odtwarza je
`npm run seed:lexicon`. Korpus dziedzinowy zapisywany jest **po** PoliMorf
i nadpisuje go przy kolizji, więc wynik lematyzacji nie zależy od tego, czy
pobranie zbiorów zewnętrznych się powiodło.

### Opcje seedowania

```bash
npm run seed:lexicon                 # pełny przebieg (PoliMorf + ESCO + korpus dziedzinowy)
npm run seed:lexicon -- --offline    # bez sieci, wyłącznie korpus dziedzinowy
npm run seed:lexicon -- --esco-no-alt # same nazwy bazowe ESCO, bez synonimów
npm run seed:lexicon -- --force      # ponowne pobranie źródeł
npm run seed:lexicon -- --max-rows 200000   # skrócony przebieg kontrolny
```

Pełny przebieg trwa kilkadziesiąt minut, bo etykiety alternatywne ESCO wymagają
jednego żądania na pojęcie (ok. 16 tys. pojęć w obu filarach). Nazwy bazowe
pochodzą z obchodu hierarchii i kosztują kilkaset żądań — `--esco-no-alt`
zatrzymuje się na nich i skraca zaciąg do około minuty. To wystarczający tryb
do pracy nad kodem; pełny przebieg wykonuje się raz i zostaje w `data/seed/`.

Uwaga na endpoint `/api/search` taksonomii ESCO: deklaruje `total` całego filaru,
ale oddaje tylko pierwsze ~200 trafień niezależnie od `limit` i `offset`. Nie
nadaje się do eksportu zbiorczego — stąd obchód hierarchii po `narrowerConcept`.

Zmienne środowiskowe: `SWG_DB_PATH` (ścieżka bazy), `POLIMORF_URL` oraz
`ESCO_CSV_URL` (własne kopie zbiorów źródłowych).

### Użycie w kodzie

```ts
const engine = new LinguisticEngine(repo);

engine.lemmatize('zarządzałem');      // 'zarządzać'
engine.lemmatize('wdrożenie');        // 'wdrożyć'
engine.lemmatize('mikroserwisów');    // 'mikroserwis'

engine.normalizeSentence('Zarządzałem zespołem programistów.');
// ['zarządzać', 'zespół', 'programista']

// Pokrycie niezależne od składni — oba zdania dają ten sam zbiór lematów:
engine.calculateLemmaOverlap(
  'Zarządzałem zespołem programistów',
  'Zarządzanie zespołem programistów'
); // 1

const mapper = new JargonMapper(repo);
mapper.findCanonicalSkill('k8s');                       // 'kubernetes'
mapper.findCanonicalSkill('konteneryzacji dockerowej'); // 'docker'
mapper.getSynonymsForSkill('docker');                   // ['dokier', 'kontenery docker', ...]
```

Słowo nieobecne w słowniku wraca **bez zmian** (małymi literami). Silnik nie
zgaduje form: brak wpisu to brak lematyzacji, a nie wymyślony rdzeń.

## Przykłady Użycia CLI

```bash
# Szukanie terminu / aliasu / pojęcia
npx swg search "piecyk gazowy"

# Szukanie ścieżki powiązań w grafie (pathfinding)
npx swg path "monter instalacji grzewczych" "Junkers"

# Generowanie propozycji wzbogacenia grafu przez Gemini API
npx swg enrich "serwisant kotłów gazowych"

# Przegląd i zatwierdzanie propozycji
npx swg proposal:list
npx swg proposal:approve <id>
```
