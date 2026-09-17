# Mapa Wiedzy i Relacji Semantycznych (2026-07-29)

> **Status:** Wygenerowano z bazy SQLite / Grafu Wiedzy (`134` węzłów, `166` relacji).

## Statystyki Obiektów według Typów

| Typ Obiektu | Liczba Obiektów |
| --- | --- |
| `profession` | 10 |
| `industry` | 7 |
| `skill` | 38 |
| `device` | 6 |
| `tool` | 37 |
| `brand` | 36 |

---

## Przegląd Obiektów i ich Relacji

### 3M Littmann (`brand`)
- **ID:** `brand:3m-littmann`
- **Opis:** Marka / Producent: 3M Littmann
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **stetoskop Medyczny** (Confidence: 90%)
  - --[manufactures]--> **ciśnieniomierz** (Confidence: 90%)

### Administrator sieci i systemów (`profession`)
- **ID:** `profession:administrator-sieci-i-systemow`
- **Synonimy / Aliasy:** `sysadmin`, `network engineer`, `administrator IT`, `inżynier infrastruktury`
- **Opis:** Zawód z obszaru: IT i dane
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **IT i dane** (Confidence: 95%)
  - --[requires_skill]--> **konfiguracja routerów i switchy** (Confidence: 90%)
  - --[requires_skill]--> **zarządzanie serwerami Linux** (Confidence: 90%)
  - --[requires_skill]--> **konfiguracja firewalli** (Confidence: 90%)
  - --[requires_skill]--> **tworzenie kopii zapasowych** (Confidence: 90%)
  - <--[services]-- **serwer rackowy** (Confidence: 90%)
  - <--[used_by]-- **switch zarządzalny** (Confidence: 90%)
  - <--[used_by]-- **Wireshark** (Confidence: 90%)
  - <--[used_by]-- **Terminal SSH** (Confidence: 90%)
  - <--[used_by]-- **PuTTY** (Confidence: 90%)

### analiza spalin (`skill`)
- **ID:** `skill:analiza-spalin`
- **Opis:** Umiejętność: analiza spalin
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Serwisant kotłów gazowych** (Confidence: 90%)

### analizator spalin (`device`)
- **ID:** `device:analizator-spalin`
- **Opis:** Urządzenie: analizator spalin
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Serwisant kotłów gazowych** (Confidence: 90%)
  - <--[manufactures]-- **Junkers** (Confidence: 90%)
  - <--[manufactures]-- **Viessmann** (Confidence: 90%)
  - <--[manufactures]-- **Vaillant** (Confidence: 90%)
  - <--[manufactures]-- **Buderus** (Confidence: 90%)
  - <--[manufactures]-- **Bosch** (Confidence: 90%)

### B. Braun (`brand`)
- **ID:** `brand:b--braun`
- **Opis:** Marka / Producent: B. Braun
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **stetoskop Medyczny** (Confidence: 90%)
  - --[manufactures]--> **ciśnieniomierz** (Confidence: 90%)

### BD Medical (`brand`)
- **ID:** `brand:bd-medical`
- **Opis:** Marka / Producent: BD Medical
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **stetoskop Medyczny** (Confidence: 90%)
  - --[manufactures]--> **ciśnieniomierz** (Confidence: 90%)

### Biuro, finanse i obsługa klienta (`industry`)
- **ID:** `industry:biuro--finanse-i-obs-uga-klienta`
- **Opis:** Obszar branżowy: Biuro, finanse i obsługa klienta
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Księgowy / Księgowa bilansistka** (Confidence: 95%)

### blokada rozrządu (`tool`)
- **ID:** `tool:blokada-rozrz-du`
- **Opis:** Narzędzie: blokada rozrządu
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Mechanik pojazdów samochodowych** (Confidence: 90%)

### Bosch (`brand`)
- **ID:** `brand:bosch`
- **Opis:** Marka / Producent: Bosch
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **analizator spalin** (Confidence: 90%)
  - --[manufactures]--> **detektor gazu** (Confidence: 90%)
  - --[manufactures]--> **tester diagnostyczny OBD2** (Confidence: 90%)
  - --[manufactures]--> **podnośnik warsztatowy kolumnowy** (Confidence: 90%)

### bruzdownica (`tool`)
- **ID:** `tool:bruzdownica`
- **Opis:** Narzędzie: bruzdownica
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Elektryk instalator** (Confidence: 90%)

### Buderus (`brand`)
- **ID:** `brand:buderus`
- **Opis:** Marka / Producent: Buderus
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **analizator spalin** (Confidence: 90%)
  - --[manufactures]--> **detektor gazu** (Confidence: 90%)

### Budownictwo i instalacje (`industry`)
- **ID:** `industry:budownictwo-i-instalacje`
- **Opis:** Obszar branżowy: Budownictwo i instalacje
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Serwisant kotłów gazowych** (Confidence: 95%)
  - <--[works_in]-- **Monter instalacji grzewczych** (Confidence: 95%)
  - <--[works_in]-- **Elektryk instalator** (Confidence: 95%)

### Chrome DevTools (`tool`)
- **ID:** `tool:chrome-devtools`
- **Opis:** Narzędzie: Chrome DevTools
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Programista Frontend (React)** (Confidence: 90%)

### Cisco (`brand`)
- **ID:** `brand:cisco`
- **Opis:** Marka / Producent: Cisco
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tool:serwer-rackowy** (Confidence: 90%)
  - --[manufactures]--> **switch zarządzalny** (Confidence: 90%)

### ciśnieniomierz (`tool`)
- **ID:** `tool:ci-nieniomierz`
- **Opis:** Narzędzie: ciśnieniomierz
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Pielęgniarka / Pielęgniarz** (Confidence: 90%)
  - <--[manufactures]-- **B. Braun** (Confidence: 90%)
  - <--[manufactures]-- **BD Medical** (Confidence: 90%)
  - <--[manufactures]-- **3M Littmann** (Confidence: 90%)

### Comarch (`brand`)
- **ID:** `brand:comarch`
- **Opis:** Marka / Producent: Comarch
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **system ERP FK** (Confidence: 90%)
  - --[manufactures]--> **Microsoft Excel** (Confidence: 90%)

### czytanie schematów elektrycznych (`skill`)
- **ID:** `skill:czytanie-schemat-w-elektrycznych`
- **Opis:** Umiejętność: czytanie schematów elektrycznych
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Elektryk instalator** (Confidence: 90%)

### Dell (`brand`)
- **ID:** `brand:dell`
- **Opis:** Marka / Producent: Dell
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tool:serwer-rackowy** (Confidence: 90%)
  - --[manufactures]--> **switch zarządzalny** (Confidence: 90%)

### detektor gazu (`tool`)
- **ID:** `tool:detektor-gazu`
- **Opis:** Narzędzie: detektor gazu
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Serwisant kotłów gazowych** (Confidence: 90%)
  - <--[manufactures]-- **Junkers** (Confidence: 90%)
  - <--[manufactures]-- **Viessmann** (Confidence: 90%)
  - <--[manufactures]-- **Vaillant** (Confidence: 90%)
  - <--[manufactures]-- **Buderus** (Confidence: 90%)
  - <--[manufactures]-- **Bosch** (Confidence: 90%)

### diagnostyka komputerowa samochodów (`skill`)
- **ID:** `skill:diagnostyka-komputerowa-samochod-w`
- **Opis:** Umiejętność: diagnostyka komputerowa samochodów
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Mechanik pojazdów samochodowych** (Confidence: 90%)

### diagnostyka urządzeń gazowych (`skill`)
- **ID:** `skill:diagnostyka-urz-dze--gazowych`
- **Opis:** Umiejętność: diagnostyka urządzeń gazowych
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Serwisant kotłów gazowych** (Confidence: 90%)

### Elektryk instalator (`profession`)
- **ID:** `profession:elektryk-instalator`
- **Synonimy / Aliasy:** `elektryk budowlany`, `monter sieci elektrycznych`, `elektromonter`
- **Opis:** Zawód z obszaru: Budownictwo i instalacje
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Budownictwo i instalacje** (Confidence: 95%)
  - --[requires_skill]--> **pomiary rezystancji izolacji** (Confidence: 90%)
  - --[requires_skill]--> **montaż rozdzielnic niska napięcie** (Confidence: 90%)
  - --[requires_skill]--> **czytanie schematów elektrycznych** (Confidence: 90%)
  - <--[used_by]-- **miernik parametrów instalacji** (Confidence: 90%)
  - <--[used_by]-- **wkrętaki izolowane VDE** (Confidence: 90%)
  - <--[used_by]-- **bruzdownica** (Confidence: 90%)
  - <--[used_by]-- **próbnik napięcia** (Confidence: 90%)

### Esab (`brand`)
- **ID:** `brand:esab`
- **Opis:** Marka / Producent: Esab
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **półautomat spawalniczy** (Confidence: 90%)
  - --[manufactures]--> **spawarka TIG** (Confidence: 90%)

### Fortinet (`brand`)
- **ID:** `brand:fortinet`
- **Opis:** Marka / Producent: Fortinet
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tool:serwer-rackowy** (Confidence: 90%)
  - --[manufactures]--> **switch zarządzalny** (Confidence: 90%)

### Fronius (`brand`)
- **ID:** `brand:fronius`
- **Opis:** Marka / Producent: Fronius
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **półautomat spawalniczy** (Confidence: 90%)
  - --[manufactures]--> **spawarka TIG** (Confidence: 90%)

### Git (`tool`)
- **ID:** `tool:git`
- **Opis:** Narzędzie: Git
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Programista Frontend (React)** (Confidence: 90%)
  - <--[manufactures]-- **Meta** (Confidence: 90%)
  - <--[manufactures]-- **Vercel** (Confidence: 90%)
  - <--[manufactures]-- **GitHub** (Confidence: 90%)

### GitHub (`brand`)
- **ID:** `brand:github`
- **Opis:** Marka / Producent: GitHub
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **Visual Studio Code** (Confidence: 90%)
  - --[manufactures]--> **Git** (Confidence: 90%)

### glukometr (`tool`)
- **ID:** `tool:glukometr`
- **Opis:** Narzędzie: glukometr
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### Grundfos (`brand`)
- **ID:** `brand:grundfos`
- **Opis:** Marka / Producent: Grundfos
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **gwintownica rur** (Confidence: 90%)
  - --[manufactures]--> **zaciskarka PEX** (Confidence: 90%)

### gwintownica rur (`tool`)
- **ID:** `tool:gwintownica-rur`
- **Opis:** Narzędzie: gwintownica rur
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Monter instalacji grzewczych** (Confidence: 90%)
  - <--[manufactures]-- **KAN-therm** (Confidence: 90%)
  - <--[manufactures]-- **Wavin** (Confidence: 90%)
  - <--[manufactures]-- **Grundfos** (Confidence: 90%)

### Hager (`brand`)
- **ID:** `brand:hager`
- **Opis:** Marka / Producent: Hager
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **miernik parametrów instalacji** (Confidence: 90%)
  - --[manufactures]--> **wkrętaki izolowane VDE** (Confidence: 90%)

### Hazet (`brand`)
- **ID:** `brand:hazet`
- **Opis:** Marka / Producent: Hazet
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tester diagnostyczny OBD2** (Confidence: 90%)
  - --[manufactures]--> **podnośnik warsztatowy kolumnowy** (Confidence: 90%)

### Inserth (`brand`)
- **ID:** `brand:inserth`
- **Opis:** Marka / Producent: Inserth
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **system ERP FK** (Confidence: 90%)
  - --[manufactures]--> **Microsoft Excel** (Confidence: 90%)

### integracja REST API (`skill`)
- **ID:** `skill:integracja-rest-api`
- **Opis:** Umiejętność: integracja REST API
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Programista Frontend (React)** (Confidence: 90%)

### IT i dane (`industry`)
- **ID:** `industry:it-i-dane`
- **Opis:** Obszar branżowy: IT i dane
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Programista Frontend (React)** (Confidence: 95%)
  - <--[works_in]-- **Administrator sieci i systemów** (Confidence: 95%)

### Jungheinrich (`brand`)
- **ID:** `brand:jungheinrich`
- **Opis:** Marka / Producent: Jungheinrich
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **wózek widłowy** (Confidence: 90%)
  - --[manufactures]--> **skaner kodów kreskowych WMS** (Confidence: 90%)

### Junkers (`brand`)
- **ID:** `brand:junkers`
- **Opis:** Marka / Producent: Junkers
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **analizator spalin** (Confidence: 90%)
  - --[manufactures]--> **detektor gazu** (Confidence: 90%)

### KAN-therm (`brand`)
- **ID:** `brand:kan-therm`
- **Opis:** Marka / Producent: KAN-therm
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **gwintownica rur** (Confidence: 90%)
  - --[manufactures]--> **zaciskarka PEX** (Confidence: 90%)

### Kemppi (`brand`)
- **ID:** `brand:kemppi`
- **Opis:** Marka / Producent: Kemppi
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **półautomat spawalniczy** (Confidence: 90%)
  - --[manufactures]--> **spawarka TIG** (Confidence: 90%)

### klucz dynamometryczny (`tool`)
- **ID:** `tool:klucz-dynamometryczny`
- **Opis:** Narzędzie: klucz dynamometryczny
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Mechanik pojazdów samochodowych** (Confidence: 90%)

### kocioł gazowy (`device`)
- **ID:** `device:kocio--gazowy`
- **Opis:** Urządzenie: kocioł gazowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Serwisant kotłów gazowych** (Confidence: 90%)
  - --[services]--> **Monter instalacji grzewczych** (Confidence: 90%)

### kompletowanie zamówień wg skanera WMS (`skill`)
- **ID:** `skill:kompletowanie-zam-wie--wg-skanera-wms`
- **Opis:** Umiejętność: kompletowanie zamówień wg skanera WMS
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Magazynier / Operator wózka widłowego** (Confidence: 90%)

### konfiguracja firewalli (`skill`)
- **ID:** `skill:konfiguracja-firewalli`
- **Opis:** Umiejętność: konfiguracja firewalli
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Administrator sieci i systemów** (Confidence: 90%)

### konfiguracja routerów i switchy (`skill`)
- **ID:** `skill:konfiguracja-router-w-i-switchy`
- **Opis:** Umiejętność: konfiguracja routerów i switchy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Administrator sieci i systemów** (Confidence: 90%)

### kontrola spoin wzrokowa VT2 (`skill`)
- **ID:** `skill:kontrola-spoin-wzrokowa-vt2`
- **Opis:** Umiejętność: kontrola spoin wzrokowa VT2
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Spawacz MAG / TIG** (Confidence: 90%)

### Księgowy / Księgowa bilansistka (`profession`)
- **ID:** `profession:ksiegowy-bilansista`
- **Synonimy / Aliasy:** `samodzielny księgowy`, `pracownik działu księgowości`, `specjalista ds. rachunkowości`
- **Opis:** Zawód z obszaru: Biuro, finanse i obsługa klienta
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Biuro, finanse i obsługa klienta** (Confidence: 95%)
  - --[requires_skill]--> **prowadzenie ksiąg rachunkowych** (Confidence: 90%)
  - --[requires_skill]--> **sporządzanie deklaracji VAT i CIT** (Confidence: 90%)
  - --[requires_skill]--> **uzgadnianie kont rozrachunkowych** (Confidence: 90%)
  - --[requires_skill]--> **zamknięcie miesiąca i roku** (Confidence: 90%)
  - <--[used_by]-- **system ERP FK** (Confidence: 90%)
  - <--[used_by]-- **Microsoft Excel** (Confidence: 90%)
  - <--[used_by]-- **program Symfonia** (Confidence: 90%)
  - <--[used_by]-- **Płatnik ZUS** (Confidence: 90%)

### Legrand (`brand`)
- **ID:** `brand:legrand`
- **Opis:** Marka / Producent: Legrand
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **miernik parametrów instalacji** (Confidence: 90%)
  - --[manufactures]--> **wkrętaki izolowane VDE** (Confidence: 90%)

### Lincoln Electric (`brand`)
- **ID:** `brand:lincoln-electric`
- **Opis:** Marka / Producent: Lincoln Electric
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **półautomat spawalniczy** (Confidence: 90%)
  - --[manufactures]--> **spawarka TIG** (Confidence: 90%)

### Linde (`brand`)
- **ID:** `brand:linde`
- **Opis:** Marka / Producent: Linde
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **wózek widłowy** (Confidence: 90%)
  - --[manufactures]--> **skaner kodów kreskowych WMS** (Confidence: 90%)

### Logistyka i magazyn (`industry`)
- **ID:** `industry:logistyka-i-magazyn`
- **Opis:** Obszar branżowy: Logistyka i magazyn
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Magazynier / Operator wózka widłowego** (Confidence: 95%)

### lutowanie twarde (`skill`)
- **ID:** `skill:lutowanie-twarde`
- **Opis:** Umiejętność: lutowanie twarde
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Monter instalacji grzewczych** (Confidence: 90%)

### Magazynier / Operator wózka widłowego (`profession`)
- **ID:** `profession:magazynier-operator-wózka`
- **Synonimy / Aliasy:** `operator wózka jezdniowego`, `pracownik magazynowy`, `magazynier komplektator`
- **Opis:** Zawód z obszaru: Logistyka i magazyn
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Logistyka i magazyn** (Confidence: 95%)
  - --[requires_skill]--> **obsługa wózka widłowego czołowego i bocznego** (Confidence: 90%)
  - --[requires_skill]--> **kompletowanie zamówień wg skanera WMS** (Confidence: 90%)
  - --[requires_skill]--> **przyjmowanie i wydawanie towaru** (Confidence: 90%)
  - <--[used_by]-- **wózek widłowy** (Confidence: 90%)
  - <--[used_by]-- **skaner kodów kreskowych WMS** (Confidence: 90%)
  - <--[used_by]-- **owijarka palet** (Confidence: 90%)
  - <--[used_by]-- **wózek paletowy ręczny** (Confidence: 90%)

### manometr cyfrowy (`tool`)
- **ID:** `tool:manometr-cyfrowy`
- **Opis:** Narzędzie: manometr cyfrowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Serwisant kotłów gazowych** (Confidence: 90%)

### Mechanik pojazdów samochodowych (`profession`)
- **ID:** `profession:mechanik-pojazdow-samochodowych`
- **Synonimy / Aliasy:** `mechanik samochodowy`, `auto mechanik`, `serwisant aut`
- **Opis:** Zawód z obszaru: Motoryzacja i transport
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Motoryzacja i transport** (Confidence: 95%)
  - --[requires_skill]--> **diagnostyka komputerowa samochodów** (Confidence: 90%)
  - --[requires_skill]--> **wymiana rozrządu** (Confidence: 90%)
  - --[requires_skill]--> **serwis układu hamulcowego** (Confidence: 90%)
  - --[requires_skill]--> **naprawa zawieszenia** (Confidence: 90%)
  - <--[used_by]-- **tester diagnostyczny OBD2** (Confidence: 90%)
  - <--[services]-- **podnośnik warsztatowy kolumnowy** (Confidence: 90%)
  - <--[used_by]-- **klucz dynamometryczny** (Confidence: 90%)
  - <--[used_by]-- **blokada rozrządu** (Confidence: 90%)

### Meta (`brand`)
- **ID:** `brand:meta`
- **Opis:** Marka / Producent: Meta
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **Visual Studio Code** (Confidence: 90%)
  - --[manufactures]--> **Git** (Confidence: 90%)

### Microsoft Excel (`tool`)
- **ID:** `tool:microsoft-excel`
- **Opis:** Narzędzie: Microsoft Excel
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Księgowy / Księgowa bilansistka** (Confidence: 90%)
  - <--[manufactures]-- **Comarch** (Confidence: 90%)
  - <--[manufactures]-- **Sage Symfonia** (Confidence: 90%)
  - <--[manufactures]-- **Inserth** (Confidence: 90%)

### miernik parametrów instalacji (`tool`)
- **ID:** `tool:miernik-parametr-w-instalacji`
- **Opis:** Narzędzie: miernik parametrów instalacji
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Elektryk instalator** (Confidence: 90%)
  - <--[manufactures]-- **Legrand** (Confidence: 90%)
  - <--[manufactures]-- **Hager** (Confidence: 90%)
  - <--[manufactures]-- **Schneider Electric** (Confidence: 90%)
  - <--[manufactures]-- **Sonel** (Confidence: 90%)

### MikroTik (`brand`)
- **ID:** `brand:mikrotik`
- **Opis:** Marka / Producent: MikroTik
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tool:serwer-rackowy** (Confidence: 90%)
  - --[manufactures]--> **switch zarządzalny** (Confidence: 90%)

### montaż kotłowni (`skill`)
- **ID:** `skill:monta--kot-owni`
- **Opis:** Umiejętność: montaż kotłowni
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Monter instalacji grzewczych** (Confidence: 90%)

### montaż rozdzielnic niska napięcie (`skill`)
- **ID:** `skill:monta--rozdzielnic-niska-napi-cie`
- **Opis:** Umiejętność: montaż rozdzielnic niska napięcie
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Elektryk instalator** (Confidence: 90%)

### Monter instalacji grzewczych (`profession`)
- **ID:** `profession:monter-instalacji-grzewczych`
- **Synonimy / Aliasy:** `instalator co`, `hydraulik installer`, `monter techniki grzewczej`
- **Opis:** Zawód z obszaru: Budownictwo i instalacje
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Budownictwo i instalacje** (Confidence: 95%)
  - --[requires_skill]--> **zdzieranie i układanie rur** (Confidence: 90%)
  - --[requires_skill]--> **lutowanie twarde** (Confidence: 90%)
  - --[requires_skill]--> **montaż kotłowni** (Confidence: 90%)
  - --[requires_skill]--> **płukanie instalacji centralnego ogrzewania** (Confidence: 90%)
  - <--[used_by]-- **gwintownica rur** (Confidence: 90%)
  - <--[used_by]-- **zaciskarka PEX** (Confidence: 90%)
  - <--[services]-- **kocioł gazowy** (Confidence: 90%)
  - <--[used_by]-- **pompa ciepła** (Confidence: 90%)

### Motoryzacja i transport (`industry`)
- **ID:** `industry:motoryzacja-i-transport`
- **Opis:** Obszar branżowy: Motoryzacja i transport
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Mechanik pojazdów samochodowych** (Confidence: 95%)

### naprawa zawieszenia (`skill`)
- **ID:** `skill:naprawa-zawieszenia`
- **Opis:** Umiejętność: naprawa zawieszenia
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Mechanik pojazdów samochodowych** (Confidence: 90%)

### npm (`tool`)
- **ID:** `tool:npm`
- **Opis:** Narzędzie: npm
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Programista Frontend (React)** (Confidence: 90%)

### obsługa wózka widłowego czołowego i bocznego (`skill`)
- **ID:** `skill:obs-uga-w-zka-wid-owego-czo-owego-i-bocznego`
- **Opis:** Umiejętność: obsługa wózka widłowego czołowego i bocznego
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Magazynier / Operator wózka widłowego** (Confidence: 90%)

### opatrywanie ran (`skill`)
- **ID:** `skill:opatrywanie-ran`
- **Opis:** Umiejętność: opatrywanie ran
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### owijarka palet (`tool`)
- **ID:** `tool:owijarka-palet`
- **Opis:** Narzędzie: owijarka palet
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Magazynier / Operator wózka widłowego** (Confidence: 90%)

### piecyk gazowy (`device`)
- **ID:** `device:piecyk-gazowy`
- **Opis:** Urządzenie: piecyk gazowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Serwisant kotłów gazowych** (Confidence: 90%)

### Pielęgniarka / Pielęgniarz (`profession`)
- **ID:** `profession:pielegniarka-oddzialowa`
- **Synonimy / Aliasy:** `pielęgniarka odcinkowa`, `personel pielęgniarski`, `siostra pielęgniarka`
- **Opis:** Zawód z obszaru: Zdrowie i opieka
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Zdrowie i opieka** (Confidence: 95%)
  - --[requires_skill]--> **pobieranie krwi do badań** (Confidence: 90%)
  - --[requires_skill]--> **podawanie leków i kroplówek** (Confidence: 90%)
  - --[requires_skill]--> **opatrywanie ran** (Confidence: 90%)
  - --[requires_skill]--> **prowadzenie dokumentacji medycznej** (Confidence: 90%)
  - <--[used_by]-- **stetoskop Medyczny** (Confidence: 90%)
  - <--[used_by]-- **ciśnieniomierz** (Confidence: 90%)
  - <--[used_by]-- **wenflon** (Confidence: 90%)
  - <--[used_by]-- **glukometr** (Confidence: 90%)
  - <--[used_by]-- **strzykawki jednorazowe** (Confidence: 90%)

### Płatnik ZUS (`tool`)
- **ID:** `tool:p-atnik-zus`
- **Opis:** Narzędzie: Płatnik ZUS
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### płukanie instalacji centralnego ogrzewania (`skill`)
- **ID:** `skill:p-ukanie-instalacji-centralnego-ogrzewania`
- **Opis:** Umiejętność: płukanie instalacji centralnego ogrzewania
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Monter instalacji grzewczych** (Confidence: 90%)

### pobieranie krwi do badań (`skill`)
- **ID:** `skill:pobieranie-krwi-do-bada-`
- **Opis:** Umiejętność: pobieranie krwi do badań
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### podawanie leków i kroplówek (`skill`)
- **ID:** `skill:podawanie-lek-w-i-kropl-wek`
- **Opis:** Umiejętność: podawanie leków i kroplówek
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### podnośnik warsztatowy kolumnowy (`device`)
- **ID:** `device:podno-nik-warsztatowy-kolumnowy`
- **Opis:** Urządzenie: podnośnik warsztatowy kolumnowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Mechanik pojazdów samochodowych** (Confidence: 90%)
  - <--[manufactures]-- **Bosch** (Confidence: 90%)
  - <--[manufactures]-- **Texa** (Confidence: 90%)
  - <--[manufactures]-- **Snap-on** (Confidence: 90%)
  - <--[manufactures]-- **Hazet** (Confidence: 90%)

### pomiary rezystancji izolacji (`skill`)
- **ID:** `skill:pomiary-rezystancji-izolacji`
- **Opis:** Umiejętność: pomiary rezystancji izolacji
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Elektryk instalator** (Confidence: 90%)

### pompa ciepła (`tool`)
- **ID:** `tool:pompa-ciep-a`
- **Opis:** Narzędzie: pompa ciepła
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Monter instalacji grzewczych** (Confidence: 90%)

### półautomat spawalniczy (`tool`)
- **ID:** `tool:p--automat-spawalniczy`
- **Opis:** Narzędzie: półautomat spawalniczy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Spawacz MAG / TIG** (Confidence: 90%)
  - <--[manufactures]-- **Esab** (Confidence: 90%)
  - <--[manufactures]-- **Kemppi** (Confidence: 90%)
  - <--[manufactures]-- **Fronius** (Confidence: 90%)
  - <--[manufactures]-- **Lincoln Electric** (Confidence: 90%)

### Produkcja i technika (`industry`)
- **ID:** `industry:produkcja-i-technika`
- **Opis:** Obszar branżowy: Produkcja i technika
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Spawacz MAG / TIG** (Confidence: 95%)

### program Symfonia (`tool`)
- **ID:** `tool:program-symfonia`
- **Opis:** Narzędzie: program Symfonia
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### Programista Frontend (React) (`profession`)
- **ID:** `profession:programista-frontend-react`
- **Synonimy / Aliasy:** `frontend developer`, `react engineer`, `programista interfejsu`, `web developer`
- **Opis:** Zawód z obszaru: IT i dane
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **IT i dane** (Confidence: 95%)
  - --[requires_skill]--> **tworzenie komponentów React** (Confidence: 90%)
  - --[requires_skill]--> **programowanie w TypeScript** (Confidence: 90%)
  - --[requires_skill]--> **stylowanie Tailwind CSS** (Confidence: 90%)
  - --[requires_skill]--> **integracja REST API** (Confidence: 90%)
  - <--[used_by]-- **Visual Studio Code** (Confidence: 90%)
  - <--[used_by]-- **Git** (Confidence: 90%)
  - <--[used_by]-- **Chrome DevTools** (Confidence: 90%)
  - <--[used_by]-- **npm** (Confidence: 90%)
  - <--[used_by]-- **Vite** (Confidence: 90%)

### programowanie w TypeScript (`skill`)
- **ID:** `skill:programowanie-w-typescript`
- **Opis:** Umiejętność: programowanie w TypeScript
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Programista Frontend (React)** (Confidence: 90%)

### prowadzenie dokumentacji medycznej (`skill`)
- **ID:** `skill:prowadzenie-dokumentacji-medycznej`
- **Opis:** Umiejętność: prowadzenie dokumentacji medycznej
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### prowadzenie ksiąg rachunkowych (`skill`)
- **ID:** `skill:prowadzenie-ksi-g-rachunkowych`
- **Opis:** Umiejętność: prowadzenie ksiąg rachunkowych
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### próbnik napięcia (`tool`)
- **ID:** `tool:pr-bnik-napi-cia`
- **Opis:** Narzędzie: próbnik napięcia
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Elektryk instalator** (Confidence: 90%)

### próby szczelności gazowej (`skill`)
- **ID:** `skill:pr-by-szczelno-ci-gazowej`
- **Opis:** Umiejętność: próby szczelności gazowej
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Serwisant kotłów gazowych** (Confidence: 90%)

### przygotowanie krawędzi (`skill`)
- **ID:** `skill:przygotowanie-kraw-dzi`
- **Opis:** Umiejętność: przygotowanie krawędzi
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Spawacz MAG / TIG** (Confidence: 90%)

### przyjmowanie i wydawanie towaru (`skill`)
- **ID:** `skill:przyjmowanie-i-wydawanie-towaru`
- **Opis:** Umiejętność: przyjmowanie i wydawanie towaru
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Magazynier / Operator wózka widłowego** (Confidence: 90%)

### przyłbica samościemniająca (`tool`)
- **ID:** `tool:przy-bica-samo-ciemniaj-ca`
- **Opis:** Narzędzie: przyłbica samościemniająca
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Spawacz MAG / TIG** (Confidence: 90%)

### PuTTY (`tool`)
- **ID:** `tool:putty`
- **Opis:** Narzędzie: PuTTY
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Administrator sieci i systemów** (Confidence: 90%)

### regulacja automatyki palnika (`skill`)
- **ID:** `skill:regulacja-automatyki-palnika`
- **Opis:** Umiejętność: regulacja automatyki palnika
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Serwisant kotłów gazowych** (Confidence: 90%)

### Sage Symfonia (`brand`)
- **ID:** `brand:sage-symfonia`
- **Opis:** Marka / Producent: Sage Symfonia
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **system ERP FK** (Confidence: 90%)
  - --[manufactures]--> **Microsoft Excel** (Confidence: 90%)

### Schneider Electric (`brand`)
- **ID:** `brand:schneider-electric`
- **Opis:** Marka / Producent: Schneider Electric
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **miernik parametrów instalacji** (Confidence: 90%)
  - --[manufactures]--> **wkrętaki izolowane VDE** (Confidence: 90%)

### serwer rackowy (`device`)
- **ID:** `device:serwer-rackowy`
- **Opis:** Urządzenie: serwer rackowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Administrator sieci i systemów** (Confidence: 90%)

### serwis układu hamulcowego (`skill`)
- **ID:** `skill:serwis-uk-adu-hamulcowego`
- **Opis:** Umiejętność: serwis układu hamulcowego
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Mechanik pojazdów samochodowych** (Confidence: 90%)

### Serwisant kotłów gazowych (`profession`)
- **ID:** `profession:serwisant-kotlow-gazowych`
- **Synonimy / Aliasy:** `monter urządzeń gazowych`, `serwisant junkersów`, `gazownik serwisant`, `technik urządzeń grzewczych`
- **Opis:** Zawód z obszaru: Budownictwo i instalacje
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Budownictwo i instalacje** (Confidence: 95%)
  - --[requires_skill]--> **diagnostyka urządzeń gazowych** (Confidence: 90%)
  - --[requires_skill]--> **analiza spalin** (Confidence: 90%)
  - --[requires_skill]--> **regulacja automatyki palnika** (Confidence: 90%)
  - --[requires_skill]--> **próby szczelności gazowej** (Confidence: 90%)
  - <--[services]-- **analizator spalin** (Confidence: 90%)
  - <--[used_by]-- **detektor gazu** (Confidence: 90%)
  - <--[services]-- **kocioł gazowy** (Confidence: 90%)
  - <--[services]-- **piecyk gazowy** (Confidence: 90%)
  - <--[used_by]-- **manometr cyfrowy** (Confidence: 90%)

### skaner kodów kreskowych WMS (`tool`)
- **ID:** `tool:skaner-kod-w-kreskowych-wms`
- **Opis:** Narzędzie: skaner kodów kreskowych WMS
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Magazynier / Operator wózka widłowego** (Confidence: 90%)
  - <--[manufactures]-- **Toyota Material Handling** (Confidence: 90%)
  - <--[manufactures]-- **Linde** (Confidence: 90%)
  - <--[manufactures]-- **Jungheinrich** (Confidence: 90%)
  - <--[manufactures]-- **Zebra** (Confidence: 90%)

### Snap-on (`brand`)
- **ID:** `brand:snap-on`
- **Opis:** Marka / Producent: Snap-on
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tester diagnostyczny OBD2** (Confidence: 90%)
  - --[manufactures]--> **podnośnik warsztatowy kolumnowy** (Confidence: 90%)

### Sonel (`brand`)
- **ID:** `brand:sonel`
- **Opis:** Marka / Producent: Sonel
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **miernik parametrów instalacji** (Confidence: 90%)
  - --[manufactures]--> **wkrętaki izolowane VDE** (Confidence: 90%)

### Spawacz MAG / TIG (`profession`)
- **ID:** `profession:spawacz-mag-tig`
- **Synonimy / Aliasy:** `spawacz konstrukcji stalowych`, `spawacz rurociągów`, `operator spawalniczy`
- **Opis:** Zawód z obszaru: Produkcja i technika
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[works_in]--> **Produkcja i technika** (Confidence: 95%)
  - --[requires_skill]--> **spawanie metodą 135 MAG** (Confidence: 90%)
  - --[requires_skill]--> **spawanie metodą 141 TIG** (Confidence: 90%)
  - --[requires_skill]--> **kontrola spoin wzrokowa VT2** (Confidence: 90%)
  - --[requires_skill]--> **przygotowanie krawędzi** (Confidence: 90%)
  - <--[used_by]-- **półautomat spawalniczy** (Confidence: 90%)
  - <--[services]-- **spawarka TIG** (Confidence: 90%)
  - <--[used_by]-- **szlifierka kątowa** (Confidence: 90%)
  - <--[used_by]-- **przyłbica samościemniająca** (Confidence: 90%)

### spawanie metodą 135 MAG (`skill`)
- **ID:** `skill:spawanie-metod--135-mag`
- **Opis:** Umiejętność: spawanie metodą 135 MAG
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Spawacz MAG / TIG** (Confidence: 90%)

### spawanie metodą 141 TIG (`skill`)
- **ID:** `skill:spawanie-metod--141-tig`
- **Opis:** Umiejętność: spawanie metodą 141 TIG
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Spawacz MAG / TIG** (Confidence: 90%)

### spawarka TIG (`device`)
- **ID:** `device:spawarka-tig`
- **Opis:** Urządzenie: spawarka TIG
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[services]--> **Spawacz MAG / TIG** (Confidence: 90%)
  - <--[manufactures]-- **Esab** (Confidence: 90%)
  - <--[manufactures]-- **Kemppi** (Confidence: 90%)
  - <--[manufactures]-- **Fronius** (Confidence: 90%)
  - <--[manufactures]-- **Lincoln Electric** (Confidence: 90%)

### sporządzanie deklaracji VAT i CIT (`skill`)
- **ID:** `skill:sporz-dzanie-deklaracji-vat-i-cit`
- **Opis:** Umiejętność: sporządzanie deklaracji VAT i CIT
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### stetoskop Medyczny (`tool`)
- **ID:** `tool:stetoskop-medyczny`
- **Opis:** Narzędzie: stetoskop Medyczny
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Pielęgniarka / Pielęgniarz** (Confidence: 90%)
  - <--[manufactures]-- **B. Braun** (Confidence: 90%)
  - <--[manufactures]-- **BD Medical** (Confidence: 90%)
  - <--[manufactures]-- **3M Littmann** (Confidence: 90%)

### strzykawki jednorazowe (`tool`)
- **ID:** `tool:strzykawki-jednorazowe`
- **Opis:** Narzędzie: strzykawki jednorazowe
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### stylowanie Tailwind CSS (`skill`)
- **ID:** `skill:stylowanie-tailwind-css`
- **Opis:** Umiejętność: stylowanie Tailwind CSS
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Programista Frontend (React)** (Confidence: 90%)

### switch zarządzalny (`tool`)
- **ID:** `tool:switch-zarz-dzalny`
- **Opis:** Narzędzie: switch zarządzalny
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Administrator sieci i systemów** (Confidence: 90%)
  - <--[manufactures]-- **Cisco** (Confidence: 90%)
  - <--[manufactures]-- **MikroTik** (Confidence: 90%)
  - <--[manufactures]-- **Fortinet** (Confidence: 90%)
  - <--[manufactures]-- **Dell** (Confidence: 90%)

### system ERP FK (`tool`)
- **ID:** `tool:system-erp-fk`
- **Opis:** Narzędzie: system ERP FK
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Księgowy / Księgowa bilansistka** (Confidence: 90%)
  - <--[manufactures]-- **Comarch** (Confidence: 90%)
  - <--[manufactures]-- **Sage Symfonia** (Confidence: 90%)
  - <--[manufactures]-- **Inserth** (Confidence: 90%)

### szlifierka kątowa (`tool`)
- **ID:** `tool:szlifierka-k-towa`
- **Opis:** Narzędzie: szlifierka kątowa
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Spawacz MAG / TIG** (Confidence: 90%)

### Terminal SSH (`tool`)
- **ID:** `tool:terminal-ssh`
- **Opis:** Narzędzie: Terminal SSH
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Administrator sieci i systemów** (Confidence: 90%)

### tester diagnostyczny OBD2 (`tool`)
- **ID:** `tool:tester-diagnostyczny-obd2`
- **Opis:** Narzędzie: tester diagnostyczny OBD2
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Mechanik pojazdów samochodowych** (Confidence: 90%)
  - <--[manufactures]-- **Bosch** (Confidence: 90%)
  - <--[manufactures]-- **Texa** (Confidence: 90%)
  - <--[manufactures]-- **Snap-on** (Confidence: 90%)
  - <--[manufactures]-- **Hazet** (Confidence: 90%)

### Texa (`brand`)
- **ID:** `brand:texa`
- **Opis:** Marka / Producent: Texa
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **tester diagnostyczny OBD2** (Confidence: 90%)
  - --[manufactures]--> **podnośnik warsztatowy kolumnowy** (Confidence: 90%)

### Toyota Material Handling (`brand`)
- **ID:** `brand:toyota-material-handling`
- **Opis:** Marka / Producent: Toyota Material Handling
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **wózek widłowy** (Confidence: 90%)
  - --[manufactures]--> **skaner kodów kreskowych WMS** (Confidence: 90%)

### tworzenie komponentów React (`skill`)
- **ID:** `skill:tworzenie-komponent-w-react`
- **Opis:** Umiejętność: tworzenie komponentów React
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Programista Frontend (React)** (Confidence: 90%)

### tworzenie kopii zapasowych (`skill`)
- **ID:** `skill:tworzenie-kopii-zapasowych`
- **Opis:** Umiejętność: tworzenie kopii zapasowych
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Administrator sieci i systemów** (Confidence: 90%)

### uzgadnianie kont rozrachunkowych (`skill`)
- **ID:** `skill:uzgadnianie-kont-rozrachunkowych`
- **Opis:** Umiejętność: uzgadnianie kont rozrachunkowych
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### Vaillant (`brand`)
- **ID:** `brand:vaillant`
- **Opis:** Marka / Producent: Vaillant
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **analizator spalin** (Confidence: 90%)
  - --[manufactures]--> **detektor gazu** (Confidence: 90%)

### Vercel (`brand`)
- **ID:** `brand:vercel`
- **Opis:** Marka / Producent: Vercel
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **Visual Studio Code** (Confidence: 90%)
  - --[manufactures]--> **Git** (Confidence: 90%)

### Viessmann (`brand`)
- **ID:** `brand:viessmann`
- **Opis:** Marka / Producent: Viessmann
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **analizator spalin** (Confidence: 90%)
  - --[manufactures]--> **detektor gazu** (Confidence: 90%)

### Visual Studio Code (`tool`)
- **ID:** `tool:visual-studio-code`
- **Opis:** Narzędzie: Visual Studio Code
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Programista Frontend (React)** (Confidence: 90%)
  - <--[manufactures]-- **Meta** (Confidence: 90%)
  - <--[manufactures]-- **Vercel** (Confidence: 90%)
  - <--[manufactures]-- **GitHub** (Confidence: 90%)

### Vite (`tool`)
- **ID:** `tool:vite`
- **Opis:** Narzędzie: Vite
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Programista Frontend (React)** (Confidence: 90%)

### Wavin (`brand`)
- **ID:** `brand:wavin`
- **Opis:** Marka / Producent: Wavin
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **gwintownica rur** (Confidence: 90%)
  - --[manufactures]--> **zaciskarka PEX** (Confidence: 90%)

### wenflon (`tool`)
- **ID:** `tool:wenflon`
- **Opis:** Narzędzie: wenflon
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Pielęgniarka / Pielęgniarz** (Confidence: 90%)

### Wireshark (`tool`)
- **ID:** `tool:wireshark`
- **Opis:** Narzędzie: Wireshark
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Administrator sieci i systemów** (Confidence: 90%)

### wkrętaki izolowane VDE (`tool`)
- **ID:** `tool:wkr-taki-izolowane-vde`
- **Opis:** Narzędzie: wkrętaki izolowane VDE
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Elektryk instalator** (Confidence: 90%)
  - <--[manufactures]-- **Legrand** (Confidence: 90%)
  - <--[manufactures]-- **Hager** (Confidence: 90%)
  - <--[manufactures]-- **Schneider Electric** (Confidence: 90%)
  - <--[manufactures]-- **Sonel** (Confidence: 90%)

### wózek paletowy ręczny (`tool`)
- **ID:** `tool:w-zek-paletowy-r-czny`
- **Opis:** Narzędzie: wózek paletowy ręczny
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Magazynier / Operator wózka widłowego** (Confidence: 90%)

### wózek widłowy (`tool`)
- **ID:** `tool:w-zek-wid-owy`
- **Opis:** Narzędzie: wózek widłowy
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Magazynier / Operator wózka widłowego** (Confidence: 90%)
  - <--[manufactures]-- **Toyota Material Handling** (Confidence: 90%)
  - <--[manufactures]-- **Linde** (Confidence: 90%)
  - <--[manufactures]-- **Jungheinrich** (Confidence: 90%)
  - <--[manufactures]-- **Zebra** (Confidence: 90%)

### wymiana rozrządu (`skill`)
- **ID:** `skill:wymiana-rozrz-du`
- **Opis:** Umiejętność: wymiana rozrządu
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Mechanik pojazdów samochodowych** (Confidence: 90%)

### zaciskarka PEX (`tool`)
- **ID:** `tool:zaciskarka-pex`
- **Opis:** Narzędzie: zaciskarka PEX
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[used_by]--> **Monter instalacji grzewczych** (Confidence: 90%)
  - <--[manufactures]-- **KAN-therm** (Confidence: 90%)
  - <--[manufactures]-- **Wavin** (Confidence: 90%)
  - <--[manufactures]-- **Grundfos** (Confidence: 90%)

### zamknięcie miesiąca i roku (`skill`)
- **ID:** `skill:zamkni-cie-miesi-ca-i-roku`
- **Opis:** Umiejętność: zamknięcie miesiąca i roku
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Księgowy / Księgowa bilansistka** (Confidence: 90%)

### zarządzanie serwerami Linux (`skill`)
- **ID:** `skill:zarz-dzanie-serwerami-linux`
- **Opis:** Umiejętność: zarządzanie serwerami Linux
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Administrator sieci i systemów** (Confidence: 90%)

### Zdrowie i opieka (`industry`)
- **ID:** `industry:zdrowie-i-opieka`
- **Opis:** Obszar branżowy: Zdrowie i opieka
- **Pewność:** 100% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[works_in]-- **Pielęgniarka / Pielęgniarz** (Confidence: 95%)

### zdzieranie i układanie rur (`skill`)
- **ID:** `skill:zdzieranie-i-uk-adanie-rur`
- **Opis:** Umiejętność: zdzieranie i układanie rur
- **Pewność:** 90% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - <--[requires_skill]-- **Monter instalacji grzewczych** (Confidence: 90%)

### Zebra (`brand`)
- **ID:** `brand:zebra`
- **Opis:** Marka / Producent: Zebra
- **Pewność:** 95% | **Źródło:** `curated` | **Status:** `verified`
- **Powiązane relacje:**
  - --[manufactures]--> **wózek widłowy** (Confidence: 90%)
  - --[manufactures]--> **skaner kodów kreskowych WMS** (Confidence: 90%)

