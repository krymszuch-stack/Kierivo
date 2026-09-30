import { MasterVault, HighlightMetric, Certification } from '../../../types';

/**
 * 8 fikcyjnych lokalnych kont / profili MasterVault odpowiadających profilom
 * zawodowym z rzeczywistego zbioru testowego test_praktyczny1.md.
 */

function makeHighlight(id: string, text: string): HighlightMetric {
  return {
    id,
    text,
    action: 'Wykonywanie zadań',
    target: 'Cele stanowiska',
    tool: 'Narzędzia zawodowe',
    metric: '100% rzetelności',
    keywords: [],
  };
}

function makeCert(id: string, name: string): Certification {
  return {
    id,
    name,
    issuer: 'Jednostka szkoleniowa',
  };
}

export const accountDoradcaKlienta: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Marek Wiśniewski',
    email: 'marek.wisniewski@example.com',
    phone: '+48 601 234 567',
    location: 'Oświęcim',
    title: 'Doradca Klienta / Handlowiec',
    summary: 'Doświadczony doradca klienta w branży wykończenia wnętrz i materiałów budowlanych. Specjalizacja w stolarce drzwiowej i podłogach. Obsługa klienta, sprzedaż, komunikatywność i obsługa komputera.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Oświęcim',
      radiusKm: 30,
      willingnessToTravel: false,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Język ojczysty' }],
    licenses: ['b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Obsługa klienta',
      'Sprzedaż',
      'Doradztwo techniczne',
      'Wystawianie faktur',
      'Sporządzanie umów',
      'Drzwi i podłogi',
      'Wycena zamówień',
      'Obsługa komputera',
    ],
    softSkills: [
      'Komunikatywność',
      'Odporność na stres',
      'Umiejętności interpersonalne',
      'Negocjacje handlowe',
    ],
    toolsAndTech: ['CRM', 'Subiekt GT', 'Pakiet Office', 'Excel'],
    certifications: [makeCert('c1', 'Techniki sprzedaży w salonie wyposażenia wnętrz')],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Doradca Klienta',
      company: 'Salon Podłóg i Wnętrz Styl',
      location: 'Oświęcim',
      startDate: '2022-01-01',
      endDate: '2025-12-31',
      isCurrent: false,
      description: 'Kompleksowa obsługa klientów detalicznych i inwestorów w doborze podłóg i drzwi.',
      highlights: [
        makeHighlight('h1', 'Prowadzenie kalkulacji i wycen asortymentu podłogowego i drzwiowego'),
        makeHighlight('h2', 'Sporządzanie zamówień, umów handlowych i faktur VAT'),
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Zespół Szkół Zawodowych w Oświęcimiu',
      degree: 'Technik handlowiec',
      fieldOfStudy: 'Handel i zarządzanie sprzedażą',
      startDate: '2016-09-01',
      endDate: '2020-06-30',
    },
  ],
  projects: [],
};

export const accountKierowcaC: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Krzysztof Nowak',
    email: 'krzysztof.nowak@example.com',
    phone: '+48 602 345 678',
    location: 'Zielona Góra',
    title: 'Kierowca Samochodu Ciężarowego Kat. C',
    summary: 'Kierowca zawodowy kat. C z wieloletnim stażem na trasach międzynarodowych po krajach UE. Karta kierowcy, kwalifikacja wstępna, znajomość procedur celnych i dokumentacji CMR.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Zielona Góra',
      radiusKm: 50,
      willingnessToTravel: true,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [
      { id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' },
      { id: 'l2', language: 'Niemiecki', level: 'A2', context: 'Komunikatywny' },
    ],
    licenses: ['c_license', 'b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Prawo jazdy kat. C',
      'Karta kierowcy do tachografu cyfrowego',
      'Wypełnianie dokumentów CMR',
      'Mocowanie ładunku',
      'Trasy międzynarodowe',
    ],
    softSkills: [
      'Punktualność',
      'Sumienność',
      'Samodzielność',
      'Odpowiedzialność',
    ],
    toolsAndTech: ['Tachograf cyfrowy', 'Nawigacja GPS dla ciężarówek'],
    certifications: [makeCert('c1', 'Świadectwo kwalifikacji zawodowej (kod 95)')],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Kierowca kat. C',
      company: 'Trans-Pol Logistyka',
      location: 'Zielona Góra',
      startDate: '2021-03-01',
      endDate: '2025-08-31',
      isCurrent: false,
      description: 'Przewóz ładunków na trasach międzynarodowych: Niemcy, Holandia, Belgia, Francja.',
      highlights: [
        makeHighlight('h1', 'Prowadzenie pojazdu solowego powyżej 3.5t na trasach europejskich'),
        makeHighlight('h2', 'Nadzór nad załadunkiem i kontrola dokumentów przewozowych CMR'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountMonterOkien: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Paweł Kowalski',
    email: 'pawel.kowalski@example.com',
    phone: '+48 603 456 789',
    location: 'Luzino',
    title: 'Monter Okien i Drzwi / Stolarki Budowlanej',
    summary: 'Monter stolarki otworowej z doświadczeniem w montażu okien PVC, aluminium oraz drzwi wejściowych i wewnętrznych. Praca na terenie Trójmiasta i Pomorza.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Luzino',
      radiusKm: 60,
      willingnessToTravel: true,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: ['b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Montaż okien PVC i ALU',
      'Montaż drzwi wejściowych i wewnętrznych',
      'Obsługa elektronarzędzi',
      'Pomiary stolarki',
      'Ciepły montaż',
      'Obróbka tynkarska',
    ],
    softSkills: [
      'Dokładność',
      'Zaangażowanie',
      'Sprawność fizyczna',
      'Praca zespołowa',
    ],
    toolsAndTech: ['Wiertarki', 'Wkrętarki', 'Poziomica laserowa', 'Pianownica'],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Monter stolarki otworowej',
      company: 'Pomorskie Okna s.c.',
      location: 'Wejherowo / Trójmiasto',
      startDate: '2020-04-01',
      endDate: '2025-05-31',
      isCurrent: false,
      description: 'Samodzielny i zespołowy montaż okien, drzwi i rolet w domach jednorodzinnych i blokach.',
      highlights: [
        makeHighlight('h1', 'Wykonanie setek szczelnych montaży okien i drzwi wejściowych'),
        makeHighlight('h2', 'Obsługa pomiarów na budowach i doradztwo techniczne dla klientów'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountParking: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Janusz Zieliński',
    email: 'janusz.zielinski@example.com',
    phone: '+48 604 567 890',
    location: 'Łódź',
    title: 'Pracownik Parkingu / Dozorca',
    summary: 'Rzetelny pracownik z doświadczeniem w dozorze obiektów, obsłudze wjazdów parkingowych, kasy fiskalnej oraz terminali płatniczych. Gotowość do pracy zmianowej i pełna dyspozycyjność.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'ENTRY',
    location: {
      city: 'Łódź',
      radiusKm: 15,
      willingnessToTravel: false,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: ['b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Obsługa kasy fiskalnej',
      'Rozliczanie gotówki',
      'Obsługa terminala płatniczego',
      'Dozór mienia',
      'Kontrola wjazdów i wyjazdów',
      'Dbanie o porządek',
      'Obsługa klienta',
    ],
    softSkills: [
      'Uczciwość',
      'Punktualność',
      'Kultura osobista',
      'Dyspozycyjność',
      'Komunikatywność',
      'Gotowość do pracy zmianowej',
    ],
    toolsAndTech: ['Kasa fiskalna', 'Terminal płatniczy', 'System biletowy'],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Pracownik obsługi parkingu',
      company: 'AutoPark Łódź',
      location: 'Łódź, Śródmieście',
      startDate: '2022-06-01',
      endDate: '2025-09-30',
      isCurrent: false,
      description: 'Wydawanie biletów wjazdowych, pobieranie opłat, dbałość o czystość, praca w systemie zmianowym.',
      highlights: [
        makeHighlight('h1', 'Bezusterkowe codzienne rozliczanie kasy i wpłat kartą'),
        makeHighlight('h2', 'Zapewnienie sprawnego ruchu pojazdów na terenie parkingu'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountStolarz: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Tomasz Majewski',
    email: 'tomasz.majewski@example.com',
    phone: '+48 605 678 901',
    location: 'Bochnia',
    title: 'Stolarz Meblowy / Montażysta Mebli',
    summary: 'Doświadczony stolarz meblowy specjalizujący się w produkcji i montażu mebli na wymiar: kuchennych, szaf wnękowych i biurowych. Umiejętność czytania rysunku technicznego i obsługa maszyn stolarskich.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Bochnia',
      radiusKm: 40,
      willingnessToTravel: true,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: ['b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Montaż mebli na wymiar',
      'Obróbka płyt meblowych i drewna',
      'Czytanie rysunku technicznego',
      'Formatowanie i oklejanie krawędzi',
      'Montaż okuć meblowych (Blum, Hettich)',
      'Obsługa piły formatowej i frezarki',
    ],
    softSkills: [
      'Precyzja',
      'Zmysł estetyczny',
      'Cierpliwość',
      'Samodzielność',
    ],
    toolsAndTech: ['Piła formatowa', 'Wkrętarki', 'Frezarka', 'Okleiniarka'],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Stolarz meblowy',
      company: 'Meble Bochnia Design',
      location: 'Bochnia',
      startDate: '2019-02-01',
      endDate: '2025-07-31',
      isCurrent: false,
      description: 'Samodzielna realizacja mebli kuchennych, szaf i garderób od rozkroju po montaż u klienta.',
      highlights: [
        makeHighlight('h1', 'Zrealizowanie ponad 120 kompletów mebli kuchennych na wymiar'),
        makeHighlight('h2', 'Precyzyjny montaż z zachowaniem standardów i zadowolenia klientów'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountMagazynAmazon: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Robert Kamiński',
    email: 'robert.kaminski@example.com',
    phone: '+48 606 789 012',
    location: 'Trzebnica',
    title: 'Pracownik Magazynowy / Order Picker',
    summary: 'Pracownik magazynu z doświadczeniem w kompletacji zamówień za pomocą skanera ręcznego, pakowaniu paczek i obsłudze procesów e-commerce. Praca w systemie zmianowym.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'ENTRY',
    location: {
      city: 'Trzebnica',
      radiusKm: 35,
      willingnessToTravel: false,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: [],
  },
  skillsMatrix: {
    hardSkills: [
      'Kompletowanie zamówień (picking)',
      'Pakowanie przesyłek (packing)',
      'Obsługa skanera kodów kreskowych',
      'Sortowanie paczek',
      'Kontrola zgodności towaru',
      'Praca z systemem WMS',
    ],
    softSkills: [
      'Sprawność fizyczna',
      'Gotowość do pracy zmianowej',
      'Szybkość działania',
      'Dyspozycyjność',
    ],
    toolsAndTech: ['Skaner radiowy Zebra', 'WMS', 'Wózek paletowy ręczny (paleciak)'],
    certifications: [],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Pracownik magazynowy - kompletacja',
      company: 'Centrum Dystrybucyjne Logistics Pro',
      location: 'Wrocław / Bielany',
      startDate: '2022-09-01',
      endDate: '2025-08-31',
      isCurrent: false,
      description: 'Zbiórka zamówień e-commerce, weryfikacja ilościowa i przygotowanie do wysyłki kurierskiej.',
      highlights: [
        makeHighlight('h1', 'Osiąganie norm pobrań powyżej 110% celu dziennego'),
        makeHighlight('h2', 'Bezpieczna praca zgodna ze standardami BHP i 5S'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountSuwnicowy: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Stanisław Wójcik',
    email: 'stanislaw.wojcik@example.com',
    phone: '+48 607 890 123',
    location: 'Kraków',
    title: 'Operator Suwnicy UDT / Hakowy',
    summary: 'Wykwalifikowany operator suwnic z uprawnieniami UDT (sterowane z poziomu roboczego i z kabiny) oraz kursem hakowego sygnalisty. Doświadczenie w halach produkcyjnych i hutniczych.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Kraków',
      radiusKm: 30,
      willingnessToTravel: false,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: ['udt_suwnice', 'b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Uprawnienia UDT na suwnice (sterowane z poziomu roboczego)',
      'Obsługa suwnic pomostowych',
      'Czynności hakowego / zawieszanie ładunków',
      'Dobór zawiesi linowych i łańcuchowych',
      'Transport ciężkich elementów stalowych',
      'Przestrzeganie procedur UDT i BHP',
    ],
    softSkills: [
      'Odpowiedzialność',
      'Rozwaga i opanowanie',
      'Koncentracja',
      'Komunikacja radiowa i gestowa',
    ],
    toolsAndTech: ['Suwnica natorowa', 'Pilot radiowy suwnicy', 'Zawiesia pasowe i łańcuchowe'],
    certifications: [makeCert('c1', 'Zaświadczenie kwalifikacyjne UDT do obsługi suwnic')],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Operator suwnicy',
      company: 'Krakowska Fabryka Konstrukcji Stalowych',
      location: 'Kraków',
      startDate: '2020-03-01',
      endDate: '2025-10-31',
      isCurrent: false,
      description: 'Przemieszczanie elementów wielkogabarytowych, załadunek profili na naczepy, obsługa magazynu stali.',
      highlights: [
        makeHighlight('h1', '5 lat bezwypadkowej pracy przy przeładunkach elementów do 20 ton'),
        makeHighlight('h2', 'Sprawne i bezpieczne manewrowanie w ciasnej przestrzeni produkcyjnej'),
      ],
    },
  ],
  education: [],
  projects: [],
};

export const accountMagazynierUnigast: MasterVault = {
  version: '1.0.0',
  updatedAt: '2026-09-30T10:00:00.000Z',
  personalInfo: {
    fullName: 'Michał Dąbrowski',
    email: 'michal.dabrowski@example.com',
    phone: '+48 608 901 234',
    location: 'Warszawa',
    title: 'Magazynier / Operator Wózka Widłowego UDT',
    summary: 'Magazynier z uprawnieniami UDT na wózki jezdniowe podnośnikowe (kat. II WJO). Doświadczenie w magazynach branży gastronomicznej i spożywczej, przyjmowaniu dostaw, kompletacji i rozładunku aut.',
  },
  profiler: {
    flags: [],
    experienceLevel: 'MID',
    location: {
      city: 'Warszawa',
      radiusKm: 30,
      willingnessToTravel: false,
      hybridWork: false,
      remoteOnly: false,
    },
    languages: [{ id: 'l1', language: 'Polski', level: 'Native', context: 'Ojczysty' }],
    licenses: ['udt_forklift', 'b_license'],
  },
  skillsMatrix: {
    hardSkills: [
      'Uprawnienia UDT na wózki widłowe czołowe i boczne',
      'Przyjmowanie dostaw i kontrola dokumentów WZ',
      'Kompletowanie zamówień dla gastronomii',
      'Obsługa systemu magazynowego WMS',
      'Rozładunek i załadunek samochodów ciężarowych',
      'Składowanie wysokiego składu',
    ],
    softSkills: [
      'Dokładność',
      'Dobra organizacja pracy',
      'Odpowiedzialność za powierzony towar',
      'Gotowość do pracy fizycznej',
    ],
    toolsAndTech: ['Wózek widłowy czołowy', 'Wózek boczny Reach Truck', 'Skaner WMS'],
    certifications: [
      makeCert('c1', 'Uprawnienia UDT na wózki jezdniowe podnośnikowe'),
      makeCert('c2', 'Orzeczenie do celów sanitarno-epidemiologicznych (sanepid)'),
    ],
  },
  history: [
    {
      id: 'exp-1',
      role: 'Magazynier - operator wózka',
      company: 'Gastrohurt Logistyka Sp. z o.o.',
      location: 'Warszawa, Wilanów',
      startDate: '2021-05-01',
      endDate: '2025-09-30',
      isCurrent: false,
      description: 'Obsługa dostaw świeżych i suchych produktów spożywczych, kompletacja zamówień dla restauracji i hoteli.',
      highlights: [
        makeHighlight('h1', 'Bezpieczna obsługa regałów wysokiego składu do 7 metrów'),
        makeHighlight('h2', 'Skrócenie czasu kompletacji zamówień o 15% dzięki optymalizacji tras w alejkach'),
      ],
    },
  ],
  education: [],
  projects: [],
};
