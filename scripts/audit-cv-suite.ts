/**
 * Skrypt kompleksowego audytu funkcjonalności sprawdzania CV (10 wywołań API / silnika).
 *
 * Testuje 10 zróżnicowanych profili branżowych (prace fizyczne, techniczne, specjalistyczne, IT)
 * zgodnie z Regułą 8 (monter, spawacz, magazynier obok programisty)
 * oraz Regułą 6 (zmierz, zanim zoptymalizujesz — podaj liczby przed i po).
 */

import { performance } from 'perf_hooks';
import type { MasterVault, HighlightMetric, LanguageProficiency } from '../src/types';
import { scoreCanonicalAts } from '../src/lib/canonicalAts';
import { stripSensitiveFields, identifyingValues, pseudonymize, assertNoPii } from '../src/server/pseudonymize';
import { SqliteGraphRepository } from '../semantic-work-graph/src/repositories/SqliteGraphRepository';
import { LexiconImporter } from '../semantic-work-graph/src/seed/LexiconImporter';
import { LinguisticEngine } from '../semantic-work-graph/src/services/LinguisticEngine';

function createHighlight(id: string, text: string, metric = ''): HighlightMetric {
  return {
    id,
    text,
    action: '',
    target: '',
    tool: '',
    metric,
    keywords: [],
  };
}

function createLang(id: string, language: string, level: 'Native' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'): LanguageProficiency {
  return {
    id,
    language,
    level,
    context: 'Codzienna komunikacja',
  };
}

export interface AuditScenario {
  id: number;
  roleName: string;
  category: 'Fizyczna' | 'Techniczna' | 'Specjalistyczna' | 'IT';
  candidate: MasterVault;
  jobOffer: {
    title: string;
    company: string;
    description: string;
  };
}

export const SCENARIOS: AuditScenario[] = [
  // 1. Spawacz konstrukcji stalowych
  {
    id: 1,
    roleName: 'Spawacz MAG / TIG',
    category: 'Fizyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'SENIOR',
        location: { city: 'Dąbrowa Górnicza', radiusKm: 30, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Niemiecki', 'A1')],
      },
      personalInfo: {
        fullName: 'Jan Nowak',
        email: 'jan.nowak@poczta.pl',
        phone: '+48 601 234 567',
        location: 'Dąbrowa Górnicza',
        title: 'Spawacz konstrukcji stalowych MAG / TIG',
        summary: 'Doświadczony spawacz metodami MAG 135 i TIG 141 z 6-letnim stażem przemysłowym. Posiadam aktualne certyfikaty spawalnicze TÜV wg normy ISO 9606-1. Spawałem rurociągi ciśnieniowe i ramy ciężkie ze stali czarnej oraz kwasoodpornej. Zredukowałem liczbę poprawek spoin o 45% dzięki precyzyjnemu przygotowaniu krawędzi i kontroli VT-2.',
      },
      skillsMatrix: {
        hardSkills: ['Spawanie MAG 135', 'Spawanie TIG 141', 'Cięcie palnikiem', 'Szlifowanie spoin', 'Kontrola wizualna VT-2'],
        toolsAndTech: ['Półautomat spawalniczy Kemppi', 'Szlifierka kątowa', 'Palnik acetylenowo-tlenowy', 'Ukośnica'],
        softSkills: ['Dokładność', 'Praca pod presją czasu', 'Przestrzeganie zasad BHP'],
        certifications: [
          { id: 'c1', name: 'Certyfikat spawacza MAG 135 wg EN ISO 9606-1', issuer: 'TÜV Rheinland', date: '2024-01-15' },
          { id: 'c2', name: 'Certyfikat TIG 141 grupa FM1', issuer: 'Instytut Spawalnictwa', date: '2023-05-10' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Spawacz konstrukcji stalowych',
          company: 'Stal-Bud Sp. z o.o.',
          location: 'Dąbrowa Górnicza',
          startDate: '2021-01-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Spawałem metodą MAG 135 wielkogabarytowe konstrukcje hal magazynowych o masie powyżej 500 ton.', '500 ton'),
            createHighlight('hl2', 'Wdrożyłem nową technikę ściegów wielowarstwowych, co zmniejszyło liczbę niezgodności spawalniczych o 30%.', '30%'),
            createHighlight('hl3', 'Wykonywałem spoiny pachwinowe i czołowe z przetopem poddawane 100% badaniom radiograficznym RT.', '100%'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Spawacz konstrukcji stalowych MAG',
      company: 'Mostostal Zabrze S.A.',
      description: 'Zatrudnimy spawacza konstrukcji stalowych metodą MAG 135. Wymagane: aktualne certyfikaty spawalnicze, spawanie konstrukcji stalowych, szlifowanie, czytanie rysunku technicznego, prawo jazdy kat. B, min. 3 lata doświadczenia.',
    },
  },

  // 2. Monter instalacji sanitarnych i HVAC
  {
    id: 2,
    roleName: 'Monter instalacji sanitarnych i HVAC',
    category: 'Techniczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'MID',
        location: { city: 'Wrocław', radiusKm: 30, willingnessToTravel: true, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native')],
      },
      personalInfo: {
        fullName: 'Piotr Wiśniewski',
        email: 'piotr.wisniewski@instalacje.pl',
        phone: '+48 502 345 678',
        location: 'Wrocław',
        title: 'Monter instalacji sanitarnych, grzewczych i pomp ciepła',
        summary: 'Instalator systemów wodno-kanalizacyjnych i grzewczych z 5-letnim doświadczeniem w budownictwie mieszkaniowym i komercyjnym. Posiadam uprawnienia F-Gazy oraz SEP G2/G3. Zamontowałem ponad 60 pomp ciepła oraz 85 kotłowni gazowych.',
      },
      skillsMatrix: {
        hardSkills: ['Instalacje sanitarne', 'Montaż pomp ciepła', 'Zgrzewanie PEX', 'Lutowanie twarde miedzi', 'Próby ciśnieniowe'],
        toolsAndTech: ['Zaciskarka Rems', 'Zgrzewarka do rur', 'Stacja do napełniania klimatyzacji', 'Manometry'],
        softSkills: ['Samodzielność', 'Punktualność', 'Kontakt z inwestorem'],
        certifications: [
          { id: 'c1', name: 'Certyfikat dla personelu F-Gazy (Kategoria I)', issuer: 'UDT', date: '2022-03-20' },
          { id: 'c2', name: 'Świadectwo kwalifikacyjne SEP Grupa 2 (Dozór i Eksploatacja)', issuer: 'SEP', date: '2023-06-15' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Instalator systemów sanitarnych i HVAC',
          company: 'EkoTerm Instalacje',
          location: 'Wrocław',
          startDate: '2021-06-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Montowałem instalacje sanitarnych pionów i poziomów w budynkach wielorodzinnych (PEX, miedź).'),
            createHighlight('hl2', 'Zainstalowałem 42 pompy ciepła typu powietrze-woda wraz z uruchomieniem automatyki.', '42 pompy'),
            createHighlight('hl3', 'Przeprowadzałem próby szczelności i ciśnieniowe bez żadnego wycieku na 12 dużych obiektach.', '12 obiektów'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Monter instalacji sanitarnych i HVAC',
      company: 'TermoMax Sp. z o.o.',
      description: 'Poszukujemy montera instalacji sanitarnych, wod-kan i grzewczych. Wymagania: montaż instalacji sanitarnych, montaż pomp ciepła, znajomość systemów PEX i miedzi, uprawnienia F-Gazy, prawo jazdy kat. B.',
    },
  },

  // 3. Operator i programista obrabiarek CNC
  {
    id: 3,
    roleName: 'Operator / Programista CNC',
    category: 'Techniczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'MID',
        location: { city: 'Rzeszów', radiusKm: 25, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Angielski', 'B1')],
      },
      personalInfo: {
        fullName: 'Tomasz Zieliński',
        email: 't.zielinski@cnc-machining.pl',
        phone: '+48 693 456 789',
        location: 'Rzeszów',
        title: 'Operator i Programista Frezarek CNC',
        summary: 'Operator i ustawiacz 3- i 5-osiowych centrów obróbczych CNC z 4-letnią praktyką w przemyśle lotniczym i maszynowym. Programuję w systemach Fanuc oraz Heidenhain.',
      },
      skillsMatrix: {
        hardSkills: ['Obsługa obrabiarek CNC', 'Frezowanie CNC', 'Toczenie metali', 'Czytanie rysunku technicznego', 'Pomiary mikrometryczne'],
        toolsAndTech: ['Centrum obróbcze DMG Mori', 'Sterowanie Fanuc 0i-MF', 'Heidenhain iTNC 530', 'Suwmiarka cyfrowa', 'Wysokościomierz'],
        softSkills: ['Drobiazgowość', 'Odpowiedzialność za detal'],
        certifications: [
          { id: 'c1', name: 'Programowanie i obsługa obrabiarek CNC Fanuc', issuer: 'Centrum Szkolenia CNC', date: '2022-04-10' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Operator frezarek CNC',
          company: 'AeroTech Components',
          location: 'Rzeszów',
          startDate: '2022-03-01',
          endDate: '2026-07-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Obrabiałem detale ze stopów aluminium i tytanu z tolerancjami rzędu +/- 0.01 mm.', '+/- 0.01 mm'),
            createHighlight('hl2', 'Skróciłem czas przezbrojenia frezarki o 22% dzięki wdrożeniu modułowych baz mocujących.', '22%'),
            createHighlight('hl3', 'Wykonałem ponad 12 000 poprawnych komponentów lotniczych z zachowaniem zero defect policy.', '12 000 sztuk'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Operator / Ustawiacz frezarek CNC',
      company: 'Precyzja Metale Sp. z o.o.',
      description: 'Zatrudnimy operatora obrabiarek CNC. Wymagania: obsługa obrabiarek cnc, frezowanie detali, sterowanie Fanuc, kontrola wymiarowa części, rysunek techniczny, min. 2 lata doświadczenia na tokarce lub frezarce.',
    },
  },

  // 4. Magazynier wysokiego składu
  {
    id: 4,
    roleName: 'Magazynier wysokiego składu',
    category: 'Fizyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'MID',
        location: { city: 'Sosnowiec', radiusKm: 25, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native')],
      },
      personalInfo: {
        fullName: 'Mariusz Lewandowski',
        email: 'm.lewandowski@logistyka.pl',
        phone: '+48 604 567 890',
        location: 'Sosnowiec',
        title: 'Magazynier Wysokiego Składu (UDT)',
        summary: 'Certyfikowany magazynier z 4-letnim stażem w obsłudze wózków jezdniowych podnośnikowych wysokiego składu (UDT). Biegle obsługuję systemy WMS i skanery kodów kreskowych. Średnio kompletuję 180 linii zamówień na godzinę z bezbłędnością 99.8%.',
      },
      skillsMatrix: {
        hardSkills: ['Gospodarka magazynowa', 'Obsługa wózka widłowego', 'Kompletacja zamówień', 'Inwentaryzacja', 'Paletyzacja'],
        toolsAndTech: ['Wózek widłowy boczny Reach Truck (Jungheinrich)', 'System SAP WMS', 'Skaner radiowy Zebra'],
        softSkills: ['Zorganizowanie', 'Odporność na stres', 'Praca zmianowa'],
        certifications: [
          { id: 'c1', name: 'Uprawnienia UDT do obsługi wózków jezdniowych podnośnikowych z mechanicznym napędem podnoszenia z wysięgnikiem', issuer: 'Urząd Dozoru Technicznego', date: '2021-09-12' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Magazynier / Operator wózka wysokiego składu',
          company: 'Centrum Dystrybucyjne EuroLog',
          location: 'Sosnowiec',
          startDate: '2022-01-10',
          endDate: '2026-08-15',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Pobierałem i odkładałem palety na regały wysokiego składowania do wysokości 11 metrów.', '11 m'),
            createHighlight('hl2', 'Obsłużyłem bezkolizyjnie ponad 45 000 operacji paletowych w systemie WMS.', '45 000 operacji'),
            createHighlight('hl3', 'Uczestniczyłem w 8 kwartalnych inwentaryzacjach, wykazując 100% zgodności stanów towarowych.', '100% zgodności'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Magazynier - operator wózka widłowego UDT',
      company: 'Panattoni Logistics Park',
      description: 'Zatrudnimy magazyniera z uprawnieniami UDT. Zadania: gospodarka magazynowa, obsługa wózka widłowego wysokiego składu, kompletacja zamówień, praca z systemem WMS, dbałość o stan towaru.',
    },
  },

  // 5. Kierowca zawodowy międzynarodowy C+E
  {
    id: 5,
    roleName: 'Kierowca międzynarodowy C+E',
    category: 'Fizyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'SENIOR',
        location: { city: 'Lublin', radiusKm: 50, willingnessToTravel: true, hybridWork: false, remoteOnly: false },
        licenses: ['B', 'C', 'CE'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Angielski', 'A2'), createLang('l3', 'Niemiecki', 'A2')],
      },
      personalInfo: {
        fullName: 'Krzysztof Dąbrowski',
        email: 'krzysztof.trans@kierowca.eu',
        phone: '+48 660 123 987',
        location: 'Lublin',
        title: 'Kierowca Zawodowy C+E (Transport Międzynarodowy)',
        summary: 'Kierowca międzynarodowy kat. C+E z 7-letnim doświadczeniem w przewozach całopojazdowych po Europie Zachodniej (Niemcy, Holandia, Francja). Karta kierowcy, kod 95, uprawnienia ADR podstawowe. Bezkolizyjny przebieg ponad 650 000 km.',
      },
      skillsMatrix: {
        hardSkills: ['Prowadzenie pojazdów ciężarowych C+E', 'Obsługa tachografu cyfrowego', 'Zabezpieczanie ładunków pasami', 'Przewóz towarów niebezpiecznych ADR', 'Odprawy celne CMR'],
        toolsAndTech: ['Ciągnik siodłowy Scania R450 / Volvo FH', 'Naczepa firanka Kögel', 'System telematyczny Transics'],
        softSkills: ['Dyspozycyjność', 'Zarządzanie czasem jazdy i odpoczynku', 'Samodzielność w trasie'],
        certifications: [
          { id: 'c1', name: 'Zaświadczenie ADR - przewóz towarów niebezpiecznych w sztukach przesyłki i luzem', issuer: 'Marszałek Województwa', date: '2023-02-14' },
          { id: 'c2', name: 'Świadectwo Kwalifikacji Zawodowej (Kod 95)', issuer: 'Wydział Komunikacji', date: '2024-05-18' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Kierowca ciągnika siodłowego C+E',
          company: 'Trans-Pol International',
          location: 'Lublin',
          startDate: '2019-03-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Realizowałem regularne trasy międzynarodowe w relacji Polska - kraje Beneluksu z terminowością 99.4%.', '99.4%'),
            createHighlight('hl2', 'Zabezpieczałem ładunki przemysłowe i automotive zgodnie z normą EN 12195-1.'),
            createHighlight('hl3', 'Ograniczyłem średnie zużycie paliwa do 26.2 l/100 km, uzyskując wyróżnienie w programie Eco-Driving.', '26.2 l/100 km'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Kierowca C+E - trasy międzynarodowe UE',
      company: 'Raben Logistics Polska',
      description: 'Zatrudnimy kierowcę kat. C+E. Wymagania: prawo jazdy kat. C+E, ważna karta kierowcy, kod 95, uprawnienia ADR, znajomość przepisów czasu pracy kierowców, dbałość o powierzony sprzęt.',
    },
  },

  // 6. Samodzielna Księgowa
  {
    id: 6,
    roleName: 'Samodzielna Księgowa',
    category: 'Specjalistyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['OFFICE_IT'],
        experienceLevel: 'SENIOR',
        location: { city: 'Poznań', radiusKm: 25, willingnessToTravel: false, hybridWork: true, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Angielski', 'B2')],
      },
      personalInfo: {
        fullName: 'Anna Kamińska',
        email: 'anna.kaminska@finanse-biuro.pl',
        phone: '+48 510 654 321',
        location: 'Poznań',
        title: 'Samodzielna Księgowa (Pełna Księgowość)',
        summary: 'Samodzielna księgowa z 8-letnim stażem w biurze rachunkowym i spółkach prawa handlowego. Prowadziłam pełną księgowość dla 25 spółek z o.o. Sporządzam roczne sprawozdania finansowe, deklaracje JPK_V7, CIT-8, PIT-4R oraz raporty zarządcze.',
      },
      skillsMatrix: {
        hardSkills: ['Księgowość', 'Pełna księgowość', 'Sprawozdania finansowe', 'Deklaracje podatkowe VAT i CIT', 'Kadry i płace'],
        toolsAndTech: ['Comarch ERP Optima', 'Symfonia Finanse i Księgowość', 'Płatnik ZUS', 'MS Excel zaawansowany'],
        softSkills: ['Skrupulatność', 'Analityczne myślenie', 'Śledzenie zmian w prawie podatkowym'],
        certifications: [
          { id: 'c1', name: 'Certyfikat Księgowego (Stowarzyszenie Księgowych w Polsce)', issuer: 'SKwP', date: '2020-11-20' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Samodzielna Księgowa',
          company: 'Biuro Rachunkowe Filar sp. z o.o.',
          location: 'Poznań',
          startDate: '2018-09-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Prowadziłam pełną księgowość 18 podmiotów gospodarczych o obrotach rocznych do 25 mln zł.', '25 mln zł'),
            createHighlight('hl2', 'Sporządziłam ponad 40 rocznych sprawozdań finansowych zatwierdzonych bez zastrzeżeń przez biegłych rewidentów.', '40 sprawozdań'),
            createHighlight('hl3', 'Wdrożyłam elektroniczny obieg dokumentów i automatyczne zaczytywanie faktur JPK, oszczędzając 30 godzin pracy zespołu miesięcznie.', '30 godz./mies.'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Samodzielna Księgowa / Główny Księgowy',
      company: 'Grupa Kapitałowa Invest sp. z o.o.',
      description: 'Zatrudnimy samodzielną księgową. Obowiązki: pełna księgowość spółki z o.o., sporządzanie bilansów, rachunku zysków i strat, deklaracji VAT, CIT, JPK, obsługa systemu Comarch ERP Optima, min. 5 lat doświadczenia.',
    },
  },

  // 7. Elektryk instalator
  {
    id: 7,
    roleName: 'Elektryk instalator budowlany',
    category: 'Techniczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'MID',
        location: { city: 'Kraków', radiusKm: 30, willingnessToTravel: true, hybridWork: false, remoteOnly: false },
        licenses: ['B', 'SEP_1KV'],
        languages: [createLang('l1', 'Polski', 'Native')],
      },
      personalInfo: {
        fullName: 'Grzegorz Kozłowski',
        email: 'g.kozlowski@elektryka.net',
        phone: '+48 501 888 222',
        location: 'Kraków',
        title: 'Elektryk Instalator - Pomiary i Rozdzielnice',
        summary: 'Uprawniony elektromonter z 6-letnim doświadczeniem w montażu instalacji elektrycznych, teletechnicznych i odgromowych w obiektach mieszkaniowych i halach produkcyjnych. Uprawnienia SEP E+D do 1kV z pomiarami ochronnymi.',
      },
      skillsMatrix: {
        hardSkills: ['Instalacje elektryczne', 'Montaż rozdzielnic elektrycznych', 'Pomiary elektryczne ochronne', 'Pomiary rezystancji izolacji', 'Trasy kablowe'],
        toolsAndTech: ['Miernik Sonel MPI-540', 'Bruzdownica Hilti', 'Praska hydrauliczna', 'Wkrętarki'],
        softSkills: ['Precyzja', 'Praca na wysokościach', 'Dbałość o standardy bezpieczeństwa'],
        certifications: [
          { id: 'c1', name: 'Świadectwo Kwalifikacyjne SEP Eksploatacja (E) i Dozór (D) do 1 kV z pomiarami', issuer: 'SEP Oddział Krakowski', date: '2023-04-10' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Elektromonter instalacji przemysłowych',
          company: 'El-Mont Sp. z o.o.',
          location: 'Kraków',
          startDate: '2020-05-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Prefabrykowałem i podłączałem ponad 70 rozdzielnic głównych i obiektowych nN.', '70 rozdzielnic'),
            createHighlight('hl2', 'Wykonałem ponad 1500 protokołów odbiorczych pomiarów impedancji pętli zwarcia i ciągłości PE.', '1500 protokołów'),
            createHighlight('hl3', 'Poprowadziłem ponad 40 kilometrów tras kablowych w korytach i drabinach kablowych w halach magazynowych.', '40 km tras'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Elektryk - montaż instalacji i rozdzielnic',
      company: 'Elektro-Budownictwo S.A.',
      description: 'Szukamy elektryka do prac montażowych. Wymagania: montaż instalacji elektrycznych, uprawnienia sep do 1kV, podłączanie rozdzielnic elektrycznych, pomiary ochronne, czytanie projektów elektrycznych.',
    },
  },

  // 8. Technik farmaceutyczny
  {
    id: 8,
    roleName: 'Technik farmaceutyczny',
    category: 'Specjalistyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL', 'OFFICE_IT'],
        experienceLevel: 'MID',
        location: { city: 'Gdańsk', radiusKm: 20, willingnessToTravel: false, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Łacina medyczna', 'C1')],
      },
      personalInfo: {
        fullName: 'Magdalena Wójcik',
        email: 'magda.wojcik@apteka-zdrowie.pl',
        phone: '+48 607 777 333',
        location: 'Gdańsk',
        title: 'Technik Farmaceutyczny (Receptura i Ekspedycja)',
        summary: 'Dyplomowany technik farmaceutyczny z 4-letnim stażem pracy w aptece ogólnodostępnej. Posiadam pełne uprawnienia zawodowe po odbyciu 2-letniej praktyki. Przygotowałam ponad 1500 leków recepturowych (maści, czopki, krople). Biegle obsługuję system apteczny Kamsoft.',
      },
      skillsMatrix: {
        hardSkills: ['Receptura apteczna', 'Wykonywanie leków magistralnych', 'Obsługa pacjenta w aptece', 'Weryfikacja recept NFZ', 'Gospodarka lekiem', 'System Kamsoft'],
        toolsAndTech: ['System apteczny Kamsoft Euro-Apteka', 'Waga analityczna', 'Unguator mikser recepturowy', 'Lampa UV'],
        softSkills: ['Empatia', 'Komunikatywność', 'Odpowiedzialność za dawkowanie'],
        certifications: [
          { id: 'c1', name: 'Dyplom Technika Farmaceutycznego z prawem wykonywania zawodu', issuer: 'Medyczne Studium Zawodowe', date: '2022-06-25' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Technik farmaceutyczny',
          company: 'Apteka Gemini',
          location: 'Gdańsk',
          startDate: '2022-07-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Sporządzałam leki recepturowe w loży aseptycznej ze 100% zgodnością składową i czystością mikrobiologiczną.', '100%'),
            createHighlight('hl2', 'Prowadziłam ewidencję i kontrolę terminów ważności ponad 3500 pozycji asortymentowych.', '3500 pozycji'),
            createHighlight('hl3', 'Obsługiwałam do 120 pacjentów dziennie przy pierwszym stole, doradzając w zakresie prawidłowego stosowania leków OTC.', '120 pacjentów/dzień'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Technik farmaceutyczny - apteka ogólnodostępna',
      company: 'Apteka Dbamy o Zdrowie',
      description: 'Zatrudnimy technika farmaceutycznego. Wymagania: dyplom technika farmaceutycznego, doświadczenie w recepturze aptecznej, znajomość programu Kamsoft, rzetelność i wysoka kultura osobista.',
    },
  },

  // 9. Murarz-tynkarz / brygadzista
  {
    id: 9,
    roleName: 'Murarz-tynkarz / Brygadzista',
    category: 'Fizyczna',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['PHYSICAL'],
        experienceLevel: 'SENIOR',
        location: { city: 'Łódź', radiusKm: 40, willingnessToTravel: true, hybridWork: false, remoteOnly: false },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native')],
      },
      personalInfo: {
        fullName: 'Dariusz Kaczmarek',
        email: 'd.kaczmarek@budowa-domy.pl',
        phone: '+48 503 999 111',
        location: 'Łódź',
        title: 'Murarz-Tynkarz / Brygadzista Budowlany',
        summary: 'Doświadczony murarz i tynkarz z 10-letnim doświadczeniem w wykonawstwie stanów surowych budynków jednorodzinnych i wielorodzinnych. Prowadziłem 6-osobową brygadę murarską. Muruję w technologiach Porotherm, Ytong oraz Silka.',
      },
      skillsMatrix: {
        hardSkills: ['Murowanie ścian', 'Tynki maszynowe', 'Szpachlowanie', 'Czytanie rysunku budowlanego', 'Niwelacja terenu'],
        toolsAndTech: ['Agregat tynkarski PFT G4', 'Niwelator optyczny', 'Zacieraczka mechaniczna', 'Przecinarka stolikowa do bloczków'],
        softSkills: ['Przywództwo brygady', 'Terminowość', 'Dobra organizacja placu budowy'],
        certifications: [
          { id: 'c1', name: 'Uprawnienia do obsługi agregatów tynkarskich', issuer: 'Instytut Mechanizacji Budownictwa', date: '2018-04-12' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Brygadzista murarsko-tynkarski',
          company: 'Bud-Expert Sp. k.',
          location: 'Łódź',
          startDate: '2016-04-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Wymurowałem wraz z brygadą ponad 35 000 m2 ścian konstrukcyjnych i działowych z zachowaniem pionów i poziomów.', '35 000 m2'),
            createHighlight('hl2', 'Nałożyłem z użyciem agregatu tynkarskiego ponad 80 000 m2 tynków gipsowych bez reklamacji ze strony inwestorów.', '80 000 m2'),
            createHighlight('hl3', 'Szkoliłem i nadzorowałem pracę 8 pomocników i młodszych murarzy.', '8 pracowników'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Murarz / Tynkarz maszynowy',
      company: 'Generalny Wykonawca Dom-Pol',
      description: 'Poszukujemy fachowców do murowania i tynkowania. Wymagania: murowanie ścian w technologiach pustak/bloczek, tynki maszynowe, szpachlowanie, umiejętność czytania rysunku architektonicznego, prawo jazdy kat. B.',
    },
  },

  // 10. Senior Fullstack Developer
  {
    id: 10,
    roleName: 'Senior Fullstack Developer',
    category: 'IT',
    candidate: {
      version: '1',
      updatedAt: '2026-09-17T00:00:00.000Z',
      profiler: {
        flags: ['OFFICE_IT'],
        experienceLevel: 'SENIOR',
        location: { city: 'Warszawa', radiusKm: 50, willingnessToTravel: false, hybridWork: true, remoteOnly: true },
        licenses: ['B'],
        languages: [createLang('l1', 'Polski', 'Native'), createLang('l2', 'Angielski', 'C1')],
      },
      personalInfo: {
        fullName: 'Jakub Mazur',
        email: 'jakub.mazur@dev-stack.io',
        phone: '+48 512 000 444',
        location: 'Warszawa',
        title: 'Senior Fullstack Developer (Node.js & React)',
        summary: 'Senior Fullstack Developer z 6-letnim doświadczeniem w budowie skalowalnych aplikacji webowych w ekosystemie TypeScript, Node.js i React. Zaprojektowałem architekturę mikrousług obsługującą 3.5 mln zapytań dziennie. Zoptymalizowałem zapytania PostgreSQL, skracając p95 latency o 62%.',
      },
      skillsMatrix: {
        hardSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Architektura mikroserwisów', 'REST API'],
        toolsAndTech: ['Next.js', 'Express', 'Prisma ORM', 'Redis', 'Kubernetes', 'Vitest', 'GitHub Actions'],
        softSkills: ['Code review', 'Mentoring programistów', 'Projektowanie systemów'],
        certifications: [
          { id: 'c1', name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', date: '2023-09-15' },
        ],
      },
      history: [
        {
          id: 'h1',
          role: 'Lead Fullstack Developer',
          company: 'CloudScale Fintech Ltd',
          location: 'Warszawa',
          startDate: '2020-03-01',
          endDate: '2026-08-31',
          isCurrent: false,
          highlights: [
            createHighlight('hl1', 'Zbudowałem w TypeScript i React moduł płatności przetwarzający transakcje o wartości 150 mln zł rocznie.', '150 mln zł'),
            createHighlight('hl2', 'Zoptymalizowałem indeksy i schemat bazy PostgreSQL, obniżając obciążenie CPU bazy danych z 85% do 28%.', '85% do 28%'),
            createHighlight('hl3', 'Wdrożyłem zautomatyzowane potoki CI/CD z testami jednostkowymi i integracyjnymi, skracając czas wdrożenia z 4h do 12 minut.', '4h do 12 min'),
          ],
        },
      ],
      education: [],
      projects: [],
    },
    jobOffer: {
      title: 'Senior Fullstack Developer (TypeScript / React / Node.js)',
      company: 'TechGlobal Innovations',
      description: 'Poszukujemy Senior Fullstack Engineera. Wymagania: biegła znajomość TypeScript, Node.js, React, projektowanie skalowalnych API, relacyjne bazy danych PostgreSQL, Docker, min. 5 lat doświadczenia, angielski min. B2.',
    },
  },
];

export interface AuditResult {
  scenarioId: number;
  role: string;
  category: string;
  latencyMs: number;
  canonicalScore: number;
  components: {
    skills: number;
    experience: number;
    structure: number;
    formal: number;
  };
  matchedRequirementsCount: number;
  missingRequirementsCount: number;
  semanticCoveragePct: number;
  piiProtectionPassed: boolean;
  tripleLoopScore: number;
  verdict: string;
}

export async function runFullAudit(): Promise<AuditResult[]> {
  console.log('Rozpoczynam audyt funkcjonalności aplikacji i 10 wywołań weryfikacji CV...\n');

  // Inicjalizacja silnika semantycznego
  const repo = new SqliteGraphRepository(':memory:');
  const importer = new LexiconImporter(repo, { offline: true });
  importer.seedOfflineCorpus();
  const linguisticEngine = new LinguisticEngine(repo);

  const results: AuditResult[] = [];

  for (const s of SCENARIOS) {
    const t0 = performance.now();

    // 1. Sprawdzenie ochrony RODO (Zero PII leakage)
    const safeVault = stripSensitiveFields(s.candidate);
    const names = identifyingValues(s.candidate);
    const pseudonymizedSummary = pseudonymize(safeVault.personalInfo?.summary || '', names);
    let piiPassed = true;
    try {
      assertNoPii(pseudonymizedSummary.text);
    } catch {
      piiPassed = false;
    }

    // 2. Kanoniczny scoring ATS
    const canonical = scoreCanonicalAts(s.candidate, s.jobOffer.description);

    // 3. Sprawdzenie pokrycia semantycznego w semantic-work-graph
    const highlightsText = (s.candidate.history?.[0]?.highlights || []).map((h) => (typeof h === 'string' ? h : h.text)).join(' ');
    const semanticCoverage = linguisticEngine.calculateLemmaCoverage(
      s.jobOffer.description,
      `${s.candidate.personalInfo?.summary || ''} ${(s.candidate.skillsMatrix?.hardSkills || []).join(' ')} ${highlightsText}`
    );

    // 4. Symulacja potrójnej pętli weryfikacyjnej (Triple Loop AI Gate)
    const hasNumbersInHighlights = (s.candidate.history?.[0]?.highlights || []).some((h) => {
      const txt = typeof h === 'string' ? h : h.text;
      return /\d+%|\d+\s*(ton|km|pomiarów|tys|godzin|linii|m2)/.test(txt);
    });
    const recruiterScore = hasNumbersInHighlights ? 88 : 65;
    const atsLoopScore = Math.round(canonical.score * 0.95);
    const complianceScore = (canonical.formalFindings.every((f) => f.satisfied) && piiPassed) ? 95 : 70;
    const tripleLoopScore = Math.round((atsLoopScore * 0.4) + (recruiterScore * 0.35) + (complianceScore * 0.25));

    let verdict = 'READY_TO_APPLY';
    if (tripleLoopScore < 70) verdict = 'CRITICAL_FIXES_NEEDED';
    else if (tripleLoopScore < 82) verdict = 'MINOR_IMPROVEMENTS';

    const t1 = performance.now();
    const latencyMs = Math.round(t1 - t0);

    results.push({
      scenarioId: s.id,
      role: s.roleName,
      category: s.category,
      latencyMs,
      canonicalScore: canonical.score,
      components: canonical.components,
      matchedRequirementsCount: canonical.matchedRequirements.length,
      missingRequirementsCount: canonical.missingRequirements.length,
      semanticCoveragePct: Math.round(semanticCoverage * 100),
      piiProtectionPassed: piiPassed,
      tripleLoopScore,
      verdict,
    });
  }

  await repo.close();
  return results;
}

// Uruchomienie bezpośrednie, jeśli skrypt jest plikiem wejściowym
if (process.argv[1]?.includes('audit-cv-suite')) {
  runFullAudit().then((res) => {
    console.log('\n=== WYNIKI 10 WYWOŁAŃ WERYFIKACJI CV ===\n');
    console.table(res.map((r) => ({
      ID: r.scenarioId,
      Rola: r.role,
      Branża: r.category,
      'Czas (ms)': r.latencyMs,
      'Kanon ATS': r.canonicalScore,
      'Skills': r.components.skills,
      'Doświadczenie': r.components.experience,
      'Struktura': r.components.structure,
      'Formalia': r.components.formal,
      'Semantyka %': `${r.semanticCoveragePct}%`,
      'RODO OK': r.piiProtectionPassed ? 'TAK' : 'NIE',
      'Pętla 360°': r.tripleLoopScore,
      'Werdykt': r.verdict,
    })));
  });
}
