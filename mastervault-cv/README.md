# MasterVault CV Engine (`mvcv`)
> **Dual-Layer Semantic PDF** — pogódź perfekcyjny design dla rekrutera z krystaliczną semantyką dla parserów ATS i modeli AI.

---

## 1. Dlaczego powstał ten silnik?

Przez lata kandydaci na rynku pracy zmagali się z dylematem:
1. **Brzydkie, ascetyczne CV z edytora tekstu** — dobrze czytane przez systemy ATS, ale wizualnie nudne i bez wyrazu dla rekrutera.
2. **Piękne, designerskie CV z programów graficznych** — estetyczne dla oka, ale odrzucane przez systemy ATS z powodu chaotycznego strumienia tekstu, łamiących się tabel lub braku odczytywalnej struktury.

**MasterVault CV Engine** rozwiązuje ten problem architektonicznie, bez stosowania zabronionych sztuczek (takich jak biały tekst, ukryte warstwy czy tryb renderowania `Tr 3`, które natychmiast dyskwalifikują kandydata w filtrach anty-fraudowych ATS).

---

## 2. Architektura dwuwarstwowa (Dual-Layer)

Silnik rozdziela to, co widzi **ludzkie oko**, od tego, co odczytuje **maszyna**:

### Warstwa 1: Wizualna (dla rekrutera)
- Generowana za pomocą biblioteki ReportLab z rygorystycznym systemem tokenów projektowych.
- Minimalistyczne pigułki kompetencji (np. `[ SQL ]`, `[ Excel ]`), subtelne linie, profesjonalna typografia (Georgia / Segoe UI / DejaVu).
- Wysoki kontrast tekstu bazowego ($\ge 4.5:1$), akcent kolorystyczny trzymany w ryzach limitu $\le 25\%$ powierzchni arkusza A4.
- Zaznaczenie tekstu myszką (`Ctrl + A`) jest czyste i zwarte — rekruter widzi wyłącznie normalną treść.

### Warstwa 2: Semantyczna (dla parserów ATS)
- **Tagged PDF (ISO 32000-1 / PDF/UA)**:
  - Każdy element wizualny jest powiązany z węzłem struktury logicznej (`/StructTreeRoot` + `/ParentTree`).
  - Atrybut `/ActualText`: gdy rekruter widzi pigułkę `[ SQL ]`, parser ATS odczytuje pełne zdanie semantyczne:  
    *„Relacyjne bazy danych SQL: zaawansowane zapytania, agregacja danych i optymalizacja raportów operacyjnych (MS SQL Server, PostgreSQL)”*.
- **Mikrodane maszynowe (`JSON-LD Schema.org/Person` w XMP `/Metadata`)**:
  - Nowoczesne systemy rekrutacyjne i modele scoringowe AI pobierają ustrukturyzowany profil kandydata bezpośrednio ze strumienia metadanych (lata stażu, uprawnienia formalne SEP/UDT, kompetencje, role).
- **Załącznik `mastervault.json` (drzewo `EmbeddedFiles`)**:
  - Pełny rekord źródłowy MasterVault jest zaszyty w pliku PDF, co umożliwia bezstratny import/eksport (round-trip).
- **Klauzula RODO**:
  - Dedykowana sekcja semantyczna w stopce dokumentu gwarantująca formalną ważność aplikacji.

---

## 3. Silnik Governance (Kontrola objętości)

Governance czuwa nad tym, by dokument nie rozrastał się w nieskończoność i mieścił się na pożądanej liczbie stron (domyślnie **1 strona A4**):
- **Priorytetyzacja osiągnięć**: punkty typu `result` (wymierne rezultaty biznesowe z liczbami) mają zawsze pierwszeństwo przed rutynowymi obowiązkami `duty`.
- **Selekcja kompetencji**: wybór najważniejszych pozycji według wag i korelacji ze stanowiskiem.
- **Docięcie do linii**: precyzyjny pomiar szerokości tekstu z uwzględnieniem kerningu i metryki fontów.

---

## 4. Instalacja i wymagania

Wymagany Python $\ge 3.10$. Zależności: `reportlab`, `pikepdf`, `pdfminer.six`, `pillow`.

```bash
pip install -e .
```

---

## 5. Użycie CLI

### Eksport CV do formatu PDF
```bash
python -m mvcv export sample/mastervault.json -o build/moje_cv.pdf --theme cobalt --layout sidebar-wide
```

Dostępne parametry:
- `--theme`: wybór motywu z katalogu 33 stylów (domyślnie `parchment`).
- `--layout`: układ kolumn (`single`, `sidebar`, `sidebar-wide`, `sidebar-right`, `banner-sidebar`, `two-column`).
- `--target-pages`: docelowa liczba stron (1 lub 2, domyślnie 1).
- `--avatar`: wariant zdjęcia/inicjałów (`circle`, `square`, `none`).
- `--no-sidecar`: wyłączenie generowania raportu JSON `*.semantic.json`.

### Weryfikacja dwuwarstwowości (test jakości i anty-trik)
```bash
python -m mvcv verify build/moje_cv.pdf
```
Weryfikator sprawdza:
- Poprawność drzewa Tagged PDF (`/StructTreeRoot`, `/MarkInfo`).
- Brak wycieku bogatych zdań `/ActualText` do warstwy wizualnej (brak podwójnego tekstu).
- Całkowity brak niewidzialnego tekstu (`Tr 3`).
- Poprawność syntaktyczną obiektu `JSON-LD` w strumieniu XMP.

### Przegląd katalogu motywów i układów
```bash
python -m mvcv themes
python -m mvcv layouts
```

### Generowanie galerii wszystkich motywów
```bash
python -m mvcv gallery sample/mastervault.json -o build/gallery
```

---

## 6. Katalog motywów wizualnych (33 kierunki)

| Motyw | Styl / Nastrój | Akcent dominujący | Tło | Typografia |
|---|---|---|---|---|
| `parchment` | Ciepły, klasyczny papier | `#31579b` (błękit pruski) | `#f7f5ef` | Sans |
| `cobalt` | Nowoczesny, dynamiczny | `#204f9a` (kobalt) | `#ffffff` | Space Sans |
| `editorial` | Prestiżowy magazynowy | `#171717` (antracyt) | `#fffdfa` | Serif / Georgia |
| `sand` | Spokojny, piaskowy | `#685444` (ciepły brąz) | `#f0e8df` | Serif |
| `ink` | Głęboki granat & kość słoniowa | `#202a34` (navy) | `#fbf9f4` | Sans |
| `pastel` | Kreatywny, świeży | `#2e2159` (fiolet) | `#ffffff` | Sans |
| `blueprint` | Techniczny, inżynierski | `#2a6495` (błękit CAD) | `#ffffff` | Sans |
| `coral` | Energetyczny koral | `#f05235` (koral) | `#ffffff` | Sans |
| `olive` | Ziemisty, stonowany | `#3c191c` (śliwka/oliwka) | `#ead1bc` | Serif |
| `cream` | Redakcyjna siatka | `#222222` (czerń) | `#f7f7f5` | Sans |
| `teal` | Morski petrol | `#18536c` (petrol) | `#ffffff` | Sans |
| `photo` | Biznesowy slate | `#203348` (grafit) | `#ffffff` | Serif |
| `dots` | Studio graficzne | `#36383d` (szarość) | `#ffffff` | Sans |
| `rose` | Pudrowy róż redakcyjny | `#b95872` (róż) | `#fff8f7` | Serif |
| `navy` | Korporacyjny granat z terakotą | `#e56b5d` (terakota) | `#f6f7fb` | Sans |
| `lilac` | Lawenda i fiolet | `#8171b8` (lawenda) | `#f5f1ff` | Sans |
| `rust` | Rdzawy kamień | `#b9573e` (rdzawy pomarańcz) | `#eee9e2` | Sans |
| `mint` | Świeża eukaliptusowa mięta | `#26755f` (ciemna mięta) | `#e9f4ef` | Sans |
| `violet` | Nocny fiolet | `#7652ae` (fiolet) | `#ffffff` | Sans |
| `sun` | Złociste słońce | `#997018` (ochra/złoto) | `#fffaf0` | Sans |
| `gridline` | Architektoniczna siatka | `#d56f49` (cegła) | `#f5f5f1` | Sans |
| `slate` | Grafit dyrektorski ze złotem | `#d6a746` (złoto) | `#ffffff` | Sans |
| `classic` | Formalny 1-kolumnowy ATS | `#31579b` (błękit) | `#ffffff` | Sans |
| *(oraz 10 kolejnych)* | `charlotte`, `maryblue`, `purplephoto`, `hindle`, `marygray`, `fanny`, `isabella`, `allie`, `zyra`, `graphite` | — | — | — |

---

## 7. Licencja

MIT License.
