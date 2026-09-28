import { describe, it, expect } from 'vitest';
import { parseTextToMasterVault } from '../cvUniversalParser';
import { mergeImportedVault } from '../vaultImportMerge';
import { MasterVault } from '../../types';

function createMockVault(fullName = 'Użytkownik Bazowy'): MasterVault {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    profiler: {
      flags: ['PHYSICAL'],
      experienceLevel: 'MID',
      location: {
        city: 'Kraków',
        radiusKm: 30,
        willingnessToTravel: false,
        hybridWork: false,
        remoteOnly: false,
      },
      languages: [],
    },
    personalInfo: {
      fullName,
      email: 'bazowy@example.com',
      phone: '123 456 789',
      location: 'Kraków',
      title: 'Monter',
      summary: 'Podstawowy profil pracownika.',
    },
    skillsMatrix: {
      hardSkills: ['Podstawowe narzędzia'],
      softSkills: ['Punktualność'],
      toolsAndTech: ['Młotek'],
      certifications: [],
    },
    history: [
      {
        id: 'base_exp_1',
        company: 'Stara Firma Sp. z o.o.',
        role: 'Pomocnik montera',
        location: 'Kraków',
        startDate: '2018',
        endDate: '2019',
        isCurrent: false,
        highlights: [],
      },
    ],
    education: [
      {
        id: 'base_edu_1',
        institution: 'Szkoła Podstawowa nr 1',
        degree: 'Podstawowe',
        fieldOfStudy: '',
        startDate: '2010',
        endDate: '2016',
      },
    ],
    projects: [],
  };
}

describe('CV Universal Multi-Format Parser Suite', () => {
  it('powinien wyodrębnić dane z tekstu CV (imię, email, telefon, stanowisko, umiejętności)', () => {
    const rawCvText = `
    Jan Nowak
    Email: jan.nowak@example.com
    Tel: +48 600 700 800
    Stanowisko: Senior Frontend Developer
    Podsumowanie: Doświadczony programista aplikacji internetowych.
    Umiejętności: React, TypeScript, Tailwind, Node.js, Git
    Doświadczenie zawodowe:
    TechCorp - Senior Frontend Developer
    Praca przy architekturze oprogramowania webowego.
    `;

    const parsed = parseTextToMasterVault(rawCvText, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Jan Nowak');
    expect(parsed.personalInfo.email).toBe('jan.nowak@example.com');
    expect(parsed.personalInfo.phone).toContain('600');
    expect(parsed.personalInfo.title).toContain('Senior Frontend Developer');
    expect(parsed.hardSkills).toContain('React');
    expect(parsed.toolsAndTech).toContain('Git');
    expect(parsed.history.length).toBeGreaterThan(0);
  });

  it('nie zniekształca apostrofów w nazwiskach', () => {
    const parsed = parseTextToMasterVault(
      "Sean O'Brien\nEmail: sean@example.com\nStanowisko: Developer",
      'TXT'
    );

    expect(parsed.personalInfo.fullName).toBe("Sean O'Brien");
    expect(parsed.rawText).not.toContain("''");
  });

  it('zachowuje polskie znaki diakrytyczne', () => {
    const parsed = parseTextToMasterVault(
      'Łukasz Wiśniewski\nStanowisko: Główny Inżynier\nEmail: l.w@example.pl',
      'TXT'
    );

    expect(parsed.personalInfo.fullName).toBe('Łukasz Wiśniewski');
  });

  it('nie fabrykuje wykształcenia, certyfikatów ani umiejętności miękkich, gdy CV ich nie zawiera', () => {
    const cvWithoutThoseSections = `
    Anna Zielińska
    Email: anna.zielinska@firma.pl
    Doświadczenie zawodowe:
    Acme Sp. z o.o. - Analityk danych, 2020 - 2023
    `;

    const parsed = parseTextToMasterVault(cvWithoutThoseSections, 'TXT');

    expect(parsed.education).toEqual([]);
    expect(parsed.certifications).toEqual([]);
    expect(parsed.softSkills).toEqual([]);
  });

  it('nie wstawia zastępczego doświadczenia, gdy CV nie ma sekcji doświadczenia', () => {
    const parsed = parseTextToMasterVault('Piotr Mazur\nEmail: piotr@example.pl', 'TXT');

    expect(parsed.history).toEqual([]);
    expect(parsed.personalInfo.title).toBe('');
    expect(parsed.personalInfo.location).toBe('');
  });

  it('czyta sekcję, gdy nagłówek i treść stoją w tej samej linii', () => {
    const inline = parseTextToMasterVault(
      'Ewa Nowak\nUmiejętności: Python, Django, Kubernetes, Terraform\nUmiejętności miękkie: Komunikacja, Praca zespołowa',
      'TXT'
    );

    expect(inline.hardSkills).toContain('Django');
    expect(inline.hardSkills).toContain('Kubernetes');
    expect(inline.hardSkills).toContain('Terraform');
    expect(inline.softSkills).toEqual(['Komunikacja', 'Praca zespołowa']);
  });

  it('daje ten sam wynik niezależnie od tego, czy nagłówek jest w osobnej linii', () => {
    const inline = parseTextToMasterVault('Ewa Nowak\nUmiejętności: Python, Django', 'TXT');
    const separate = parseTextToMasterVault('Ewa Nowak\nUmiejętności:\nPython, Django', 'TXT');

    expect(inline.hardSkills.sort()).toEqual(separate.hardSkills.sort());
  });

  it('wyodrębnia realne wykształcenie i certyfikaty, gdy CV je zawiera', () => {
    const fullCv = `
    Marek Wolny
    Wykształcenie:
    Politechnika Warszawska - Inżynier - Informatyka, 2016 - 2020
    Certyfikaty:
    AWS Certified Solutions Architect - Amazon Web Services, 2022
    Umiejętności miękkie:
    Komunikacja, Praca zespołowa
    `;

    const parsed = parseTextToMasterVault(fullCv, 'TXT');

    expect(parsed.education[0].institution).toBe('Politechnika Warszawska');
    expect(parsed.education[0].startDate).toBe('2016');
    expect(parsed.certifications[0].name).toBe('AWS Certified Solutions Architect');
    expect(parsed.certifications[0].date).toBe('2022');
    expect(parsed.softSkills).toEqual(['Komunikacja', 'Praca zespołowa']);
  });
});

describe('10 Real-World CV Parser & Vault Merger Test Scenarios', () => {
  // Scenario 1: Monter instalacji sanitarnych / HVAC
  it('Scenariusz 1: Monter instalacji sanitarnych / HVAC (zawód fizyczny, certyfikaty SEP/F-Gaz, daty 05.2021 - obecnie)', () => {
    const cv = `
    Tomasz Kaczmarek
    Telefon: +48 501 234 567 | E-mail: tomasz.kaczmarek@poczta.pl | Warszawa
    Stanowisko: Monter instalacji sanitarnych i HVAC

    PODSUMOWANIE ZAWODOWE
    Doświadczony monter z 6-letnim stażem w montażu rurociągów, pomp ciepła i kotłów gazowych.

    DOŚWIADCZENIE ZAWODOWE
    05.2021 - obecnie
    Instal-Bud Sp. z o.o. | Monter instalacji HVAC
    - Montaż instalacji centralnego ogrzewania i pomp ciepła
    - Wykonywanie prób ciśnieniowych i pomiarów szczelności
    - Serwis i diagnostyka kotłów gazowych

    2018.03 - 2021.04
    TermoTech Warszawa - Monter rurociągów
    - Lutowanie twarde rur miedzianych
    - Montaż instalacji wod-kan

    UMIEJĘTNOŚCI I UPRAWNIENIA
    Montaż instalacji sanitarnych, Pompy ciepła, Kocioł gazowy, Próby ciśnieniowe, Lutowanie twarde, Diagnostyka HVAC

    CERTYFIKATY
    Certyfikat F-Gazy dla personelu (UDT) - 2021
    Uprawnienia SEP Grupa 2 (Cieplne) - 2022

    EDUKACJA
    Zespół Szkół Budowlanych w Warszawie
    Zawód: Monter sieci i instalacji sanitarnych (2015 - 2018)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Tomasz Kaczmarek');
    expect(parsed.personalInfo.location).toBe('Warszawa');
    expect(parsed.personalInfo.email).toBe('tomasz.kaczmarek@poczta.pl');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('Instal-Bud');
    expect(parsed.history[0].role).toContain('Monter');
    expect(parsed.history[0].startDate).toBe('05-2021');
    expect(parsed.history[0].isCurrent).toBe(true);
    expect(parsed.history[0].highlights.length).toBeGreaterThan(0);

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Zespół Szkół Budowlanych');

    expect(parsed.certifications.length).toBe(2);
    expect(parsed.certifications[0].name).toContain('F-Gazy');

    expect(parsed.hardSkills).toContain('Pompy ciepła');
    expect(parsed.hardSkills).toContain('Kocioł gazowy');

    // Test scalenia z MasterVault
    const base = createMockVault();
    const merged = mergeImportedVault(base, {
      personalInfo: parsed.personalInfo,
      skillsMatrix: {
        hardSkills: parsed.hardSkills,
        softSkills: parsed.softSkills,
        toolsAndTech: parsed.toolsAndTech,
        certifications: parsed.certifications,
      },
      history: parsed.history,
      education: parsed.education,
    });

    expect(merged.personalInfo.fullName).toBe('Tomasz Kaczmarek');
    expect(merged.history.length).toBe(3); // 1 z base + 2 z importu
    expect(merged.education.length).toBe(2); // 1 z base + 1 z importu
  });

  // Scenario 2: Spawacz TIG / MAG
  it('Scenariusz 2: Spawacz TIG / MAG (uprawnienia UDT/TÜV, szkoła branżowa, punktorowy układ)', () => {
    const cv = `
    Krzysztof Kowalczyk
    krzysztof.spawacz@onet.pl | 690-123-456
    Miejscowość: Katowice

    1. PRZEBIEG PRACY ZAWODOWEJ
    Stal-Konstrukcje Sp. z o.o. | Spawacz TIG 141 / MAG 135
    01.2020 - obecnie
    • Spawanie konstrukcji stalowych ze stali czarnej i nierdzewnej
    • Spawanie rurociągów ciśnieniowych metodą TIG 141
    • Kontrola wizualna złączy spawanych VT1, VT2

    Metal-System Dąbrowa Górnicza
    Ślusarz - Spawacz (2017 - 2019)
    • Przygotowanie elementów do spawania, cięcie plazmowe i szlifowanie

    2. KWALIFIKACJE I UMIEJĘTNOŚCI
    Spawanie TIG, Spawanie MIG/MAG, TIG 141, MAG 135, Rysunek techniczny, Cięcie plazmowe, Szlifierka kątowa

    3. UPRAWNIENIA I CERTYFIKATY
    Certyfikat spawacza TIG 141 wg EN ISO 9606-1 (TÜV Rheinland) - 2023
    Certyfikat spawacza MAG 135 (Instytut Spawalnictwa) - 2022

    4. SZKOŁY
    Branżowa Szkoła I Stopnia w Katowicach
    Kierunek: Ślusarz / Spawacz (2014 - 2017)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Krzysztof Kowalczyk');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('Stal-Konstrukcje');
    expect(parsed.history[0].role).toContain('Spawacz');
    expect(parsed.history[0].highlights.length).toBe(3);

    expect(parsed.certifications.length).toBe(2);
    expect(parsed.certifications[0].name).toContain('TIG 141');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Branżowa Szkoła');

    expect(parsed.hardSkills).toContain('Spawanie TIG');
    expect(parsed.hardSkills).toContain('TIG 141');
  });

  // Scenario 3: Magazynier / Operator Wózka Widłowego
  it('Scenariusz 3: Magazynier / Operator Wózka Widłowego (UDT II WJO, WMS, format dwukolumnowy)', () => {
    const cv = `
    Paweł Dąbrowski
    dabrowski.magazyn@gmail.com
    Tel: 789 456 123
    Poznań

    HISTORIA ZATRUDNIENIA
    DHL Logistics Poland - Magazynier / Operator Wózka Widłowego
    06.2021 – 12.2023
    - Obsługa wózków widłowych czołowych i bocznych wysokiego składu
    - Praca z systemem WMS i skanerami kodów kreskowych
    - Rozładunek i załadunek naczep TIR

    Amazon Fulfillment Poznań
    Pracownik Magazynowy (10.2019 - 05.2021)
    - Kompletacja zamówień (Pick & Pack)
    - Inwentaryzacja stanów magazynowych

    UMIEJĘTNOŚCI ZAWODOWE
    Wózki widłowe, Wózek widłowy UDT, System WMS, Inwentaryzacja, Kompletacja zamówień, Obsługa skanera

    UPRAWNIENIA
    Zaświadczenie kwalifikacyjne UDT na wózki jezdniowe kat. II WJO - 2019
    Prawo jazdy kat. B - 2017

    EDUKACJA
    Zespół Szkół Zawodowych w Poznaniu
    Technik Logistyk (2015 - 2019)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Paweł Dąbrowski');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('DHL');
    expect(parsed.history[0].role).toContain('Magazynier');
    expect(parsed.history[1].company).toContain('Amazon');

    expect(parsed.hardSkills).toContain('Wózek widłowy UDT');
    expect(parsed.hardSkills).toContain('System WMS');
    expect(parsed.certifications.length).toBe(2);
  });

  // Scenario 4: Elektryk / Automatyk przemysłowy
  it('Scenariusz 4: Elektryk / Automatyk przemysłowy (SEP E+D, technikum mechatroniczne, prefabrykacja szaf)', () => {
    const cv = `
    Michał Wiśniewski
    m.wisniewski@elektro.pl | +48 601 999 888 | Wrocław
    Stanowisko: Elektryk / Automatyk Przemysłowy

    DOŚWIADCZENIE
    2021-02 - obecnie
    ABB Sp. z o.o. | Elektromonter Automatyki
    • Prefabrykacja szaf sterowniczych zgodnie ze schematem EPLAN
    • Pomiary elektryczne odbiorcze i okresowe
    • Podłączanie czujników, falowników i sterowników PLC

    2018-09 - 2021-01
    El-Mont Wrocław - Pomocnik Elektryka
    • Montaż tras kablowych i koryt metalowych

    KOMPETENCJE TECHNICZNE
    Uprawnienia SEP, SEP E+D, Pomiary elektryczne, Prefabrykacja szaf, Automatyka przemysłowa, Programowanie PLC

    CERTYFIKATY I UPRAWNIENIA
    Świadectwo kwalifikacyjne SEP Grupa 1 Eksploatacja + Dozór do 1kV z pomiarami (2022)

    WYKSZTAŁCENIE
    Technikum Mechatroniczne we Wrocławiu
    Dyplom: Technik Mechatronik (2014 - 2018)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Michał Wiśniewski');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('ABB');
    expect(parsed.history[0].role).toContain('Elektromonter');
    expect(parsed.history[0].startDate).toBe('02-2021');

    expect(parsed.certifications.length).toBe(1);
    expect(parsed.certifications[0].name).toContain('SEP');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Technikum Mechatroniczne');
    expect(parsed.education[0].degree).toContain('Technik');
  });

  // Scenario 5: Kierowca zawodowy C+E
  it('Scenariusz 5: Kierowca zawodowy C+E (KOD 95, karta kierowcy, ADR, trasy międzynarodowe)', () => {
    const cv = `
    Dariusz Kozłowski
    E-mail: d.kozlowski.driver@wp.pl
    Telefon: 502 333 444
    Lokalizacja: Bydgoszcz

    DOŚWIADCZENIE ZAWODOWE
    Trans-Pol International Sp. z o.o.
    Kierowca Międzynarodowy C+E
    maj 2020 - obecnie
    - Przewozy towarów na trasach Polska - Niemcy - Holandia
    - Prawidłowe zabezpieczanie ładunku pasami i belkami
    - Obsługa tachografu cyfrowego i dokumentacji CMR

    Omega Transport
    Kierowca Krajowy kat. C (2018 - 2020)
    - Dystrybucja towarów spożywczych na terenie kraju

    KWALIFIKACJE I UPRAWNIENIA
    Prawo jazdy kat. C+E, KOD 95, Karta kierowcy, ADR, Tachograf cyfrowy, Dokumentacja CMR

    SZKOLENIA
    Kurs Kwalifikacji Wstępnej Przyspieszonej KOD 95 - 2020
    Zaświadczenie ADR podstawowe - 2021
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Dariusz Kozłowski');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('Trans-Pol');
    expect(parsed.history[0].role).toContain('Kierowca');
    expect(parsed.history[0].startDate).toBe('05-2020');

    expect(parsed.hardSkills).toContain('Prawo jazdy kat. C+E');
    expect(parsed.hardSkills).toContain('KOD 95');
    expect(parsed.certifications.length).toBe(2);
  });

  // Scenario 6: Senior Fullstack Developer
  it('Scenariusz 6: Senior Fullstack Developer (React, TypeScript, Node.js, AWS, Politechnika, projekty, język angielski)', () => {
    const cv = `
    Adam Lewandowski
    adam.lewandowski@devmail.io | +48 600 111 222 | Kraków
    Tytuł: Senior Fullstack Developer

    PODSUMOWANIE
    Programista z 7-letnim doświadczeniem w tworzeniu skalowalnych aplikacji webowych i chmurowych.

    DOŚWIADCZENIE ZAWODOWE
    SoftwareHouse Polska | Senior Fullstack Developer
    01.2021 - obecnie
    - Architektura mikroserwisów oparta o Node.js, TypeScript i PostgreSQL
    - Tworzenie responsywnych interfejsów w React i Tailwind CSS
    - Wdrażanie infrastruktury na AWS (ECS, S3, RDS) przy użyciu Terraform

    FinTech Solutions Kraków - Mid Frontend Developer
    2018 - 2020
    - Rozwój modułu płatności w aplikacji React/Redux

    UMIEJĘTNOŚCI
    React, TypeScript, JavaScript, Node.js, PostgreSQL, Docker, AWS, Tailwind, Git, REST API, GraphQL

    JĘZYKI OBCE
    Język angielski - C1 (płynny w mowie i piśmie)
    Język niemiecki - A2

    PROJEKTY
    System CRM Cloud - Główny Architekt
    Aplikacja SaaS do zarządzania relacjami z klientami zbudowana w Next.js i Node.js

    EDUKACJA
    Politechnika Krakowska
    Inżynier, Informatyka Stosowana (2014 - 2018)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Adam Lewandowski');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('SoftwareHouse');
    expect(parsed.history[0].role).toContain('Developer');

    expect(parsed.hardSkills).toContain('React');
    expect(parsed.hardSkills).toContain('TypeScript');
    expect(parsed.hardSkills).toContain('PostgreSQL');
    expect(parsed.toolsAndTech).toContain('Git');

    expect(parsed.languages?.length).toBe(2);
    expect(parsed.languages?.[0].language).toBe('angielski');
    expect(parsed.languages?.[0].level).toBe('C1');

    expect(parsed.projects?.length).toBe(1);
    expect(parsed.projects?.[0].name).toContain('CRM Cloud');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Politechnika Krakowska');
  });

  // Scenario 7: Python / Data Engineer
  it('Scenariusz 7: Python / Data Engineer (FastAPI, PostgreSQL, Docker, daty po angielsku)', () => {
    const cv = `
    Katarzyna Zielińska
    katarzyna.zielinska@data.pl | +48 505 606 707 | Gdańsk
    Rola: Senior Python Data Engineer

    WORK EXPERIENCE
    DataTech Solutions
    Senior Python Developer (May 2020 - Present)
    - Building high-throughput data processing pipelines using Python, FastAPI and Celery
    - Optimizing PostgreSQL and Redis queries
    - Containerizing services with Docker and Kubernetes

    Nordic Analytics - Junior Data Analyst (Jan 2018 - Apr 2020)
    - Writing SQL queries and dashboards

    TECHNICAL SKILLS
    Python, FastAPI, SQL, PostgreSQL, Docker, Kubernetes, Redis, Git, Linux

    EDUCATION
    Uniwersytet Gdański
    Magister, Matematyka i Informatyka (2013 - 2018)

    CERTIFICATIONS
    AWS Certified Data Analytics - Amazon Web Services, 2022
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Katarzyna Zielińska');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('DataTech');
    expect(parsed.history[0].startDate).toBe('05-2020');
    expect(parsed.history[0].isCurrent).toBe(true);

    expect(parsed.hardSkills).toContain('Python');
    expect(parsed.hardSkills).toContain('FastAPI');
    expect(parsed.hardSkills).toContain('Docker');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Uniwersytet Gdański');
    expect(parsed.education[0].degree).toContain('Magister');
  });

  // Scenario 8: Księgowa / Specjalistka ds. kadr i płac
  it('Scenariusz 8: Księgowa / Specjalistka ds. kadr i płac (Płatnik, Enova, SKwP)', () => {
    const cv = `
    Monika Szymańska
    monika.ksiegowosc@onet.pl | 602 444 888 | Łódź
    Stanowisko: Samodzielna Księgowa

    DOŚWIADCZENIE ZAWODOWE
    Biuro Rachunkowe Perfekt Sp. z o.o.
    Samodzielna Księgowa (2020 - obecnie)
    • Prowadzenie pełnej księgowości spółek z o.o. oraz KPiR
    • Sporządzanie deklaracji VAT, CIT, PIT oraz JPK_V7
    • Obsługa programu Enova365 oraz Płatnik

    Grupa Handlowa Łódź - Młodsza Księgowa (2017 - 2020)
    • Księgowanie faktur zakupowych i sprzedażowych

    UMIEJĘTNOŚCI
    Płatnik, Enova, Symfonia, Excel, Księgowość pełna, Kadry i płace, Deklaracje ZUS, Deklaracje VAT

    CERTYFIKATY
    Certyfikat Księgowego - Stowarzyszenie Księgowych w Polsce (SKwP) - 2021

    WYKSZTAŁCENIE
    Uniwersytet Łódzki
    Licencjat: Finanse i Rachunkowość (2014 - 2017)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Monika Szymańska');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('Biuro Rachunkowe');
    expect(parsed.history[0].role).toContain('Księgowa');

    expect(parsed.hardSkills).toContain('Płatnik');
    expect(parsed.hardSkills).toContain('Enova');
    expect(parsed.hardSkills).toContain('Excel');

    expect(parsed.certifications.length).toBe(1);
    expect(parsed.certifications[0].name).toContain('Certyfikat Księgowego');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Uniwersytet Łódzki');
    expect(parsed.education[0].degree).toContain('Licencjat');
  });

  // Scenario 9: Pracownik produkcji / Operator CNC
  it('Scenariusz 9: Pracownik produkcji / Operator CNC (rysunek techniczny, suwmiarka, szkoła branżowa)', () => {
    const cv = `
    Rafał Wójcik
    rafal.wojcik88@interia.pl | 509 888 777 | Mielec

    PRZEBIEG PRACY
    2019 - obecnie: Operator Frezarki CNC - Mechatronika Mielec Sp. z o.o.
    - Ustawianie parametrów obróbki detali metalowych
    - Kontrola jakości za pomocą suwmiarki, mikrometru i średnicówki
    - Czytanie rysunku technicznego

    2016 - 2019: Operator Maszyn Produkcyjnych - Auto-Części Mielec
    - Obsługa linii montażowej

    KWALIFIKACJE
    Obsługa maszyn CNC, Tokarka CNC, Frezarka CNC, Rysunek techniczny, Pomiary warsztatowe

    SZKOŁY
    Zespół Szkół Technicznych w Mielcu
    Zawód: Operator obrabiarek skrawających (2013 - 2016)

    JĘZYKI
    Niemiecki: A2 (podstawowy)
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Rafał Wójcik');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].role).toContain('Operator');
    expect(parsed.history[0].company).toContain('Mechatronika');

    expect(parsed.hardSkills).toContain('Obsługa maszyn CNC');
    expect(parsed.hardSkills).toContain('Rysunek techniczny');

    expect(parsed.languages?.length).toBe(1);
    expect(parsed.languages?.[0].language).toBe('Niemiecki');
    expect(parsed.languages?.[0].level).toBe('A2');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Zespół Szkół Technicznych');
  });

  // Scenario 10: Kierownik projektu / PM
  it('Scenariusz 10: Kierownik projektu / PM (Agile, Scrum PSM, budżetowanie, format mieszany)', () => {
    const cv = `
    Magdalena Lis
    magda.lis@pm-consulting.pl | +48 600 555 333 | Warszawa
    Stanowisko: Senior IT Project Manager

    1. PROFIL KANDYDATA
    Project Manager z certyfikatem PSM I i 8-letnim doświadczeniem w zarządzaniu projektami IT.

    2. DOŚWIADCZENIE ZAWODOWE
    Global IT Systems Warsaw
    Senior Project Manager (01.2021 - obecnie)
    - Zarządzanie 3 zespołami deweloperskimi w metodyce Scrum / Agile
    - Kontrola budżetu projektowego do 4 mln PLN
    - Zarządzanie ryzykiem i komunikacja z interesariuszami C-level

    Software Hub Poland - IT Project Manager (2017 - 2020)
    - Prowadzenie projektów wdrożeniowych CRM

    3. UMIEJĘTNOŚCI KLUCZOWE
    Zarządzanie projektami, Scrum, Agile, Budżetowanie, Jira, Zarządzanie ryzykiem, Negocjacje

    4. CERTYFIKATY
    Professional Scrum Master I (PSM I) - Scrum.org - 2021
    Prince2 Foundation - AXELOS - 2019

    5. JĘZYKI
    Angielski - C2 (biegły)

    6. EDUKACJA
    Szkoła Główna Handlowa w Warszawie
    Magister, Zarządzanie Projektami (2012 - 2017)

    Klauzula RODO: Wyrażam zgodę na przetwarzanie danych osobowych...
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');

    expect(parsed.personalInfo.fullName).toBe('Magdalena Lis');
    expect(parsed.personalInfo.title).toContain('Project Manager');
    expect(parsed.history.length).toBe(2);
    expect(parsed.history[0].company).toContain('Global IT Systems');
    expect(parsed.history[0].role).toContain('Project Manager');

    expect(parsed.hardSkills).toContain('Jira');
    expect(parsed.certifications.length).toBe(2);
    expect(parsed.certifications[0].name).toContain('PSM I');

    expect(parsed.languages?.length).toBe(1);
    expect(parsed.languages?.[0].level).toBe('C2');

    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].institution).toContain('Szkoła Główna Handlowa');
  });

  it('oddziela kolejne stanowiska zapisane jako rola i firma przed linią dat', () => {
    const cv = `
    Janina Wielostronicowa
    janina@example.com | Kraków

    DOŚWIADCZENIE
    Starsza specjalistka wsparcia IT | Przykładowa Firma Alfa Sp. z o.o.
    01.2023 - obecnie
    - Pierwszy punkt.

    Specjalistka Service Desk | Przykładowa Firma Beta S.A.
    06.2020 - 12.2022
    - Drugi punkt.

    Młodsza specjalistka IT | Przykładowa Firma Gamma Sp. z o.o.
    08.2017 - 05.2020
    - Trzeci punkt.
    `;

    const parsed = parseTextToMasterVault(cv, 'TXT');
    expect(parsed.history).toHaveLength(3);
    expect(parsed.history.map((entry) => entry.company)).toEqual([
      'Przykładowa Firma Alfa Sp. z o.o.',
      'Przykładowa Firma Beta S.A.',
      'Przykładowa Firma Gamma Sp. z o.o.',
    ]);
  });
});
