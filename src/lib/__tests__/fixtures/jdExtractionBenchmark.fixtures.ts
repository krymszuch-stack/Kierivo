/**
 * Fixtury benchmarku jakości ekstrakcji ofert pracy (Kierivo).
 *
 * Korpus poniżej to ręczna transkrypcja realnego, wielokrotnego wklejenia z
 * Pracuj.pl dostarczonego przez właściciela repo (bez ścieżki do zewnętrznego
 * pliku — patrz AGENTS.md, testy nie mogą zależeć od plików spoza repo).
 * Zawiera świadomie zachowany błąd źródła: pierwsza oferta zaczyna się od
 * „ogromista (m/k)” zamiast „Programista (m/k)” — tak dokładnie wygląda
 * oryginalne wklejenie, więc benchmark mierzy realne dane, nie ich poprawioną
 * wersję. `jobOfferPreprocessor.ts` ma na to jawny wyjątek (patrz `titleBefore`).
 *
 * Gold standard został zakodowany ręcznie na podstawie treści korpusu i celowo
 * NIE naśladuje kształtu `ParsedJobDescription` — koduje więcej pól (lokalizacja,
 * kontrakt, min/max wynagrodzenia, min. lata doświadczenia, required vs nice),
 * niż parser dziś zwraca. To jest zamierzone: różnica między gold a schematem
 * parsera jest sama w sobie jednym z wyników benchmarku (patrz raport w pliku
 * testowym), a nie błędem fixtury.
 */

export interface GoldFormalReq {
  id: string;
  label: string;
  required: boolean;
}

export interface GoldOffer {
  id: string;
  domain: 'IT' | 'NON_IT';
  title: string;
  company: string;
  seniority: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ON_SITE';
  contract: string[];
  salary: { min: number; max: number; currency: string; period: string; grossNet: string } | null;
  location: string;
  experienceMinYears: number | null;
  languagesRequired: string[];
  languagesNice: string[];
  requiredSkills: string[];
  niceSkills: string[];
  formalRequirements: GoldFormalReq[];
}

/** Kolejność zgodna z porządkiem pojawienia się unikalnych ofert w korpusie. */
export const OFFER_ORDER = ['elektrobudowa', 'pp_solutions', 'orlen_paczka', 'solleim', 'ubicom', 'level_work'] as const;

export const GOLD: Record<string, GoldOffer> = {
  elektrobudowa: {
    id: 'elektrobudowa',
    domain: 'IT',
    title: 'Programista C/C++',
    company: 'ELEKTROBUDOWA sp. z o.o.',
    seniority: 'MID',
    workMode: 'ON_SITE',
    contract: ['umowa o pracę', 'pełny etat'],
    salary: null, // brak jakiejkolwiek kwoty w źródle dla tej oferty
    location: 'Katowice, śląskie',
    experienceMinYears: null, // brak liczby lat, tylko etykieta "specjalista/mid"
    languagesRequired: [],
    languagesNice: ['angielski'],
    requiredSkills: ['c', 'c++', 'tcp/ip', 'git'],
    niceSkills: ['pascal', 'iec61850', 'iec870-5-103', 'dnp3', 'canbus', 'modbus', 'qt', 'embedded'],
    formalRequirements: [{ id: 'license_b', label: 'Prawo jazdy kat. B', required: true }],
  },
  pp_solutions: {
    id: 'pp_solutions',
    domain: 'IT',
    title: 'Senior .NET Developer / Solution Architect',
    company: 'P&P Solutions Sp. z o.o.',
    seniority: 'SENIOR',
    workMode: 'REMOTE', // pole portalowe "praca zdalna"; treść oferty dopuszcza też hybrydę z Gliwic/Katowic
    contract: ['kontrakt B2B', 'pełny etat'],
    salary: { min: 100, max: 120, currency: 'PLN', period: 'godzina', grossNet: 'netto (+VAT)' },
    location: 'Katowice / Gliwice (zdalnie, cała Polska)',
    experienceMinYears: 5,
    languagesRequired: ['angielski (min. B1)'],
    languagesNice: [],
    requiredSkills: [
      'c#', '.net', '.net framework', 'oracle sql', 'pl/sql', 'postgresql', 'winforms', 'wpf',
      'rest api', 'git', 'ci/cd', 'mvvm', 'cqrs', 'ddd',
    ],
    niceSkills: ['devexpress winforms', 'dapper', 'xpo', 'docker', 'jira', 'confluence', 'bitbucket', 'github', 'scrum', 'erp'],
    formalRequirements: [
      { id: 'degree', label: 'Wykształcenie wyższe', required: true },
      { id: 'experience_years', label: 'Min. 5 lat doświadczenia', required: true },
    ],
  },
  orlen_paczka: {
    id: 'orlen_paczka',
    domain: 'IT',
    title: 'Programista .NET (k/m)',
    company: 'ORLEN PACZKA sp. z o.o.',
    seniority: 'MID',
    workMode: 'HYBRID',
    contract: ['umowa o pracę', 'pełny etat'],
    salary: null, // tylko opis systemu wynagrodzeń, bez kwoty
    location: 'Annopol 17A, Białołęka, Warszawa',
    experienceMinYears: 3,
    languagesRequired: [],
    languagesNice: [],
    requiredSkills: [
      '.net', 'c#', 'sql', 'kafka', 'rabbitmq', 'docker', 'kubernetes', 'asp.net', 'mvc', 'winforms',
      'rest api', 'grpc', 'mikroserwisy', 'ms sql', 'postgresql', 'grafana', 'prometheus', 'ci/cd',
      'ef core', 'dapper', 'redis', 'jira',
    ],
    // W treści "Wykształcenie wyższe, informatyczne" jest jawnie pod "Mile widziane" — inaczej niż u P&P.
    niceSkills: ['logistyka', 'wykształcenie wyższe informatyczne'],
    formalRequirements: [
      { id: 'experience_years', label: 'Min. 3 lata doświadczenia', required: true },
      { id: 'degree', label: 'Wykształcenie wyższe informatyczne', required: false },
    ],
  },
  solleim: {
    id: 'solleim',
    domain: 'NON_IT',
    title: 'Pracownik / Pracowniczka kuchni',
    company: 'SOLLEIM GROUP sp. z o.o.',
    seniority: 'pracownik fizyczny', // brak drabinki senior/mid/junior — to nie jest stanowisko IT
    workMode: 'ON_SITE',
    contract: ['umowa zlecenie', 'pełny etat / część etatu'],
    salary: { min: 32, max: 33, currency: 'PLN', period: 'godzina', grossNet: 'brutto' },
    location: 'Hoża 29/31, Śródmieście, Warszawa',
    experienceMinYears: 0, // portalowa etykieta "Bez doświadczenia"
    languagesRequired: [],
    languagesNice: [],
    requiredSkills: [],
    niceSkills: [],
    // Książeczka sanepidowska jest w tekście, ale jako coś, w czym firma POMOŻE po zatrudnieniu
    // ("Jeśli jeszcze go nie posiadasz, to pomożemy...") — nie jest to warunek wstępny aplikowania.
    formalRequirements: [],
  },
  ubicom: {
    id: 'ubicom',
    domain: 'NON_IT',
    title: 'Kucharz (ze znajomością kuchni ukraińskiej)',
    company: 'UBICOM sp. z o.o.',
    seniority: 'pracownik fizyczny',
    workMode: 'ON_SITE',
    contract: ['umowa zlecenie', 'pełny etat'],
    salary: { min: 35, max: 45, currency: 'PLN', period: 'godzina', grossNet: 'brutto' },
    location: 'Aleje Jerozolimskie 179, Ochota, Warszawa',
    // Źródło jest CELOWO częściowe: paste kończy się na opisie obowiązków, bez sekcji
    // "Nasze wymagania". Wszystko poniżej, co w innych ofertach dałoby się wypełnić,
    // zostaje puste — bo naprawdę nie ma tego w dostarczonym tekście (patrz zadanie:
    // "UBICOM source is partial and only present facts may count").
    experienceMinYears: null,
    languagesRequired: [],
    languagesNice: [],
    requiredSkills: [],
    niceSkills: [],
    formalRequirements: [],
  },
  level_work: {
    id: 'level_work',
    domain: 'NON_IT',
    title: 'Kucharz do Bistro (m/k)',
    company: 'Level Work',
    seniority: 'pracownik fizyczny',
    workMode: 'ON_SITE',
    contract: ['umowa o pracę', 'pełny etat'],
    salary: { min: 7800, max: 8800, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Warszawa',
    experienceMinYears: 4,
    languagesRequired: ['angielski (komunikatywny)'],
    languagesNice: [],
    requiredSkills: [],
    niceSkills: [],
    formalRequirements: [
      { id: 'experience_years', label: 'Min. 4 lata doświadczenia jako kucharz', required: true },
      { id: 'language_communicative', label: 'Komunikatywny angielski', required: true },
      { id: 'sanepid', label: 'Aktualne orzeczenie sanitarno-epidemiologiczne', required: true },
    ],
  },
};

/**
 * Dosłowna transkrypcja realnego, wielokrotnego wklejenia 6 ofert z Pracuj.pl
 * (usunięta wyłącznie ludzka notatka poprzedzająca właściwy tekst; sam tekst
 * ofert i cały szum portalowy — duplikat P&P, „Przewiń do profilu firmy”,
 * „Aplikuj szybko”, „Asystent Pracuj.pl — Podsumowanie” itd. — zachowany 1:1).
 */
export const RAW_CORPUS = `ogramista (m/k)
ELEKTROBUDOWA sp. z o.o.O firmie
ważna jeszcze 16 dni
(do 04 paź)
Katowice
śląskie
umowa o pracę
pełny etat
specjalista / specjalistka (mid / regular)
praca stacjonarna
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
Specjalizacje:Senior .NET Developer / Solution Architect
P&P Solutions Sp. z o.o.O firmie
100,00 – 120,00 zł
netto (+ VAT) / godz. | kontrakt B2B
ważna jeszcze 7 dni
(do 25 wrz)
Siedziba firmy:
Katowice
śląskie
Miejsce pracy:
Cała Polska (praca zdalna)
kontrakt B2B
pełny etat
starszy specjalista / starsza specjalistka (senior)
praca zdalna
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
Specjalizacje:
Backend
Wymagane języki:
angielski
Technologie, których używamy
Wymagane
.NET
C#
Oracle SQL
Git
PL/SQL
Mile widziane
DevExpress WinForms
Dapper
XPO
Docker
Jira
Confluence
Bitbucket
GitHub
O projekcie
Poszukujemy Senior .NET Developera / Solution Architecta do długoterminowego projektu obejmującego rozwój i utrzymanie systemów biznesowych. Osoba na tym stanowisku będzie odpowiedzialna za projektowanie i implementację nowych rozwiązań, udział w decyzjach architektonicznych oraz dbanie o jakość rozwijanego oprogramowania.
📍 Lokalizacja: 100% zdalnie lub hybrydowo z Gliwic/Katowic (3 dni w biurze i 2 dni zdalnie)
💰 Stawka: 100–120 PLN/h netto na B2B
📅 Start: 1 października 2026
📆 Współpraca: 3 miesięczny okres próbny + następna umowa na 12 miesięcy – projekt długoterminowy
Tech Stack: .NET Framework 4.7.2, .NET 6, C#, WinForms, WPF, Oracle 11.2/19c, PL/SQL, Dapper, DevExpress, XPO, Docker, Git, CI/CD.
Projekt obejmuje rozwój i utrzymanie rozwiązań biznesowych, w tym przede wszystkim aplikacji desktopowych. Główny stack oparty jest o C#/.NET, WinForms, WPF i Oracle, a część usług rozwijana jest na .NET 6. Rola daje możliwość wpływania na architekturę, jakość kodu i kierunek rozwoju systemów.
Twój zakres obowiązków
projektowanie i implementacja nowych funkcjonalności w C#/.NET,
rozwój i utrzymanie istniejących aplikacji,
udział w projektowaniu architektury i podejmowaniu decyzji technicznych,
projektowanie rozwiązań zgodnie z CQRS, DDD, MVVM i dobrymi praktykami,
tworzenie testów jednostkowych i udział w code review,
analiza i rozwiązywanie problemów technicznych,
współpraca z zespołem Scrumowym i interesariuszami,
estymacja zadań i planowanie prac,
przygotowywanie dokumentacji technicznej,
dzielenie się wiedzą i wsparcie mniej doświadczonych developerów.
Nasze wymagania
minimum 5 lat samodzielnego doświadczenia komercyjnego w programowaniu,
bardzo dobra znajomość C# / .NET / .NET Framework,
doświadczenie w pracy z Oracle SQL / PL/SQL oraz znajomość relacyjnych baz danych, w tym PostgreSQL,
praktyczne doświadczenie z WinForms i/lub WPF,
doświadczenie w tworzeniu aplikacji desktopowych i architektury 3-warstwowej,
znajomość MVVM, CQRS i DDD,
znajomość technologii internetowych, REST API i integracji systemowych,
znajomość Git oraz procesów CI/CD,
doświadczenie w testach jednostkowych, code review i tworzeniu clean code,
umiejętność podejmowania decyzji technicznych i udziału w projektowaniu architektury,
wykształcenie wyższe,
język angielski min. B1.
Mile widziane
DevExpress WinForms,
Dapper / XPO,
znajomość Docker,
doświadczenie w Scrum,
znajomość Jira, Confluence, Bitbucket,
doświadczenie w systemach ERP, szczególnie kadrowo-płacowych, księgowych lub finansowych,
doświadczenie w roli Solution Architecta / Technical Leada,
GitHub lub inne portfolio projektów.
To oferujemy
pracę hybrydową lub 100% zdalną,
wynagrodzenie 100–120 PLN/h netto,
długoterminową współpracę,
3-miesięczny okres próbny, następnie przedłużenie na kolejny rok,
start współpracy 1 października 2026,
bogaty pakiet usług prywatnej opieki medycznej,
dostęp do platformy kafeteryjnej MyBenefit,
przelew w dogodnej formie,
krótki 14-dniowy termin płatności faktury.
Benefity
dofinansowanie zajęć sportowych
prywatna opieka medyczna
możliwość pracy zdalnej
owoce
spotkania integracyjne
komputer do użytku prywatnego
brak dress code’u
kawa / herbata
napoje
dofinansowanie biletów do kina, teatru
inicjatywy dobroczynne
P&P Solutions Sp. z o.o.
Przewiń do profilu firmy
Świadczymy usługi outsourcingowe i rekrutacyjne oraz wspieramy transformację cyfrową klientów na całym świecie. Współpracujemy zarówno ze startupami, software house’ami, jak i dużymi organizacjami i korporacjami – głównie w branżach IT, telekomunikacji, fintech, bankowości, logistyce oraz sektorze publicznym.
Działamy zespołowo – rekrutacja ściśle współpracuje z działem sprzedaży i innymi jednostkami biznesowymi, wspólnie dbając o najwyższą jakość realizowanych projektów.
Backend
Technologie, których używamy
Wymagane
C
C++
Git
System operacyjny
Twój zakres obowiązków
projektowanie i tworzenie oprogramowania do produkcji zabezpieczeń,
współpraca z wydziałem produkcji i technologii,
tworzenie oprogramowania pod systemem operacyjnym Windows.
Nasze wymagania
bardzo dobra znajomość języka C/C++,
bardzo dobra znajomość zagadnień sieciowych TCP/IP, unicast, multicast, broadcast, ISO, OSI,
znajomość programu GIT,
umiejętność pracy w zespole,
prawo jazdy kat. B.
Mile widziane
znajomość języka Pascal,
umiejętność przejścia z języka Pascal na C++,
znajomość protokołu komunikacyjnego IEC61850,
znajomość protokołów komunikacyjnych IEC870-5-103, DNP3, CANBUS, MODBUS,
znajomość zagadnień energetyki zabezpieczeniowej,
programista embedded,
znajomości języka angielskiego,
znajomość frameworka QT.
To oferujemy
zatrudnienie na podstawie umowy o pracę w spółce należącej do dynamicznie rozwijającej się grupy kapitałowej o ugruntowanej pozycji rynkowej,
wynagrodzenie dostosowane do posiadanych umiejętności i doświadczenia,
możliwość doskonalenia zawodowego poprzez system szkoleń,
możliwość awansu,
pakiet świadczeń socjalnych, m.in. prywatna opieka medyczna, ubezpieczenie na życie, dofinansowanie do zajęć sportowych, platforma do nauki języków obcych.
Benefity
dofinansowanie zajęć sportowych
prywatna opieka medyczna
dofinansowanie nauki języków
dofinansowanie szkoleń i kursów
ubezpieczenie na życie
spotkania integracyjne
dodatkowe świadczenia socjalne
program rekomendacji pracowników
możliwość uzyskania uprawnień
ELEKTROBUDOWA sp. z o.o.
Przewiń do profilu firmy
ELEKTROBUDOWA Sp. z o.o. jest największą w kraju firmą działającą w branży elektroinstalacyjnej zajmującą się kompleksowymi usługami elektroinstalacyjnymi oraz budową kompletnych obiektów na potrzeby energetyki i przemysłu. Spółka jest wiodącym producentem urządzeń elektroenergetycznych, w tym głównie rozdzielnic i szynoprzewodów nn, SN i WN, urządzeń prądu stałego i stacji kontenerowych dla sektora elektroenergetycznego i przemysłu.
ELEKTROBUDOWA Sp. z o.o. wchodzi w skład GRUPY ZARMEN – lidera na rynku kompleksowego wykonania inwestycji przemysłowych i jednej z największych grup budownictwa przemysłowego w Polsce. GRUPA ZARMEN składa się z 7 spółek o szerokim i komplementarnym zakresie działalności.
Wejdź na www.elektrobudowa.com.pl i dowiedz się więcej o naszej działalności.Senior .NET Developer / Solution Architect
P&P Solutions Sp. z o.o.O firmie
100,00 – 120,00 zł
netto (+ VAT) / godz. | kontrakt B2B
ważna jeszcze 7 dni
(do 25 wrz)
Siedziba firmy:
Katowice
śląskie
Miejsce pracy:
Cała Polska (praca zdalna)
kontrakt B2B
pełny etat
starszy specjalista / starsza specjalistka (senior)
praca zdalna
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
Specjalizacje:
Backend
Wymagane języki:
angielski
Technologie, których używamy
Wymagane
.NET
C#
Oracle SQL
Git
PL/SQL
Mile widziane
DevExpress WinForms
Dapper
XPO
Docker
Jira
Confluence
Bitbucket
GitHub
O projekcie
Poszukujemy Senior .NET Developera / Solution Architecta do długoterminowego projektu obejmującego rozwój i utrzymanie systemów biznesowych. Osoba na tym stanowisku będzie odpowiedzialna za projektowanie i implementację nowych rozwiązań, udział w decyzjach architektonicznych oraz dbanie o jakość rozwijanego oprogramowania.
📍 Lokalizacja: 100% zdalnie lub hybrydowo z Gliwic/Katowic (3 dni w biurze i 2 dni zdalnie)
💰 Stawka: 100–120 PLN/h netto na B2B
📅 Start: 1 października 2026
📆 Współpraca: 3 miesięczny okres próbny + następna umowa na 12 miesięcy – projekt długoterminowy
Tech Stack: .NET Framework 4.7.2, .NET 6, C#, WinForms, WPF, Oracle 11.2/19c, PL/SQL, Dapper, DevExpress, XPO, Docker, Git, CI/CD.
Projekt obejmuje rozwój i utrzymanie rozwiązań biznesowych, w tym przede wszystkim aplikacji desktopowych. Główny stack oparty jest o C#/.NET, WinForms, WPF i Oracle, a część usług rozwijana jest na .NET 6. Rola daje możliwość wpływania na architekturę, jakość kodu i kierunek rozwoju systemów.
Twój zakres obowiązków
projektowanie i implementacja nowych funkcjonalności w C#/.NET,
rozwój i utrzymanie istniejących aplikacji,
udział w projektowaniu architektury i podejmowaniu decyzji technicznych,
projektowanie rozwiązań zgodnie z CQRS, DDD, MVVM i dobrymi praktykami,
tworzenie testów jednostkowych i udział w code review,
analiza i rozwiązywanie problemów technicznych,
współpraca z zespołem Scrumowym i interesariuszami,
estymacja zadań i planowanie prac,
przygotowywanie dokumentacji technicznej,
dzielenie się wiedzą i wsparcie mniej doświadczonych developerów.
Nasze wymagania
minimum 5 lat samodzielnego doświadczenia komercyjnego w programowaniu,
bardzo dobra znajomość C# / .NET / .NET Framework,
doświadczenie w pracy z Oracle SQL / PL/SQL oraz znajomość relacyjnych baz danych, w tym PostgreSQL,
praktyczne doświadczenie z WinForms i/lub WPF,
doświadczenie w tworzeniu aplikacji desktopowych i architektury 3-warstwowej,
znajomość MVVM, CQRS i DDD,
znajomość technologii internetowych, REST API i integracji systemowych,
znajomość Git oraz procesów CI/CD,
doświadczenie w testach jednostkowych, code review i tworzeniu clean code,
umiejętność podejmowania decyzji technicznych i udziału w projektowaniu architektury,
wykształcenie wyższe,
język angielski min. B1.
Mile widziane
DevExpress WinForms,
Dapper / XPO,
znajomość Docker,
doświadczenie w Scrum,
znajomość Jira, Confluence, Bitbucket,
doświadczenie w systemach ERP, szczególnie kadrowo-płacowych, księgowych lub finansowych,
doświadczenie w roli Solution Architecta / Technical Leada,
GitHub lub inne portfolio projektów.
To oferujemy
pracę hybrydową lub 100% zdalną,
wynagrodzenie 100–120 PLN/h netto,
długoterminową współpracę,
3-miesięczny okres próbny, następnie przedłużenie na kolejny rok,
start współpracy 1 października 2026,
bogaty pakiet usług prywatnej opieki medycznej,
dostęp do platformy kafeteryjnej MyBenefit,
przelew w dogodnej formie,
krótki 14-dniowy termin płatności faktury.
Benefity
dofinansowanie zajęć sportowych
prywatna opieka medyczna
możliwość pracy zdalnej
owoce
spotkania integracyjne
komputer do użytku prywatnego
brak dress code’u
kawa / herbata
napoje
dofinansowanie biletów do kina, teatru
inicjatywy dobroczynne
P&P Solutions Sp. z o.o.
Przewiń do profilu firmy
Świadczymy usługi outsourcingowe i rekrutacyjne oraz wspieramy transformację cyfrową klientów na całym świecie. Współpracujemy zarówno ze startupami, software house’ami, jak i dużymi organizacjami i korporacjami – głównie w branżach IT, telekomunikacji, fintech, bankowości, logistyce oraz sektorze publicznym.
Działamy zespołowo – rekrutacja ściśle współpracuje z działem sprzedaży i innymi jednostkami biznesowymi, wspólnie dbając o najwyższą jakość realizowanych projektów.Programista .NET (k/m)
ORLEN PACZKA sp. z o.o.O firmie
ważna 11 godzin
Annopol 17A, Białołęka, Warszawa
mazowieckie
umowa o pracę
pełny etat
specjalista / specjalistka (mid / regular)
praca hybrydowa
Praca od zaraz
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
System wynagrodzeń:
stała podstawa wynagrodzenia + stała premia (np. kwartalna, roczna)
Specjalizacje:
Backend
Siedziba firmy
ORLEN PACZKA sp. z o.o.
ORLEN PACZKA sp. z o.o.
Annopol 17A, Białołęka, Warszawa
Sprawdź czas dojazdu
Zlokalizuj się lub podaj dokładny adres
Samochód
-
Komunikacja
-
Rower
-
Pieszo
-
Technologie, których używamy
Wymagane
.NET
C#
SQL
Kafka
RabbitMQ
Twój zakres obowiązków
Rozwój aplikacji biznesowych (projektowanie, development, testy) m.in. dedykowanym rozwiązaniom kurierskim i logistycznym
Implementacja logiki biznesowej zgodnie z wymaganiami projektowymi oraz dobrymi praktykami programistycznymi
Szacowanie pracochłonności dla wytwarzanego oprogramowania
Wykonywanie testów systemowych oraz integracyjnych
Wdrażanie zmian na środowiska przedprodukcyjne, testowe oraz produkcyjne
Optymalizacja wdrożonych rozwiązań
Współpraca z zespołami dostawców usług IT celem integrowania systemów
Realizowanie zadań jako 3-linia wsparcia dla użytkowników usługi ORLEN Paczka celem zapewnienia ciągłości biznesowej usługi
Opracowanie lub aktualizacja dokumentacji technicznej
Nasze wymagania
Minimum 3 lat doświadczenia w roli .NET Developera
Znajomość i doświadczenie w pracy z konteneryzacją (Docker/Kubernetes)
Znajomość platformy .NET (C#, Winforms,Blazor, ASP .NET, MVC)
Znajomość́ starszych technologii WinForms i IIS
Doświadczenie w tworzeniu usług backendowych: REST API, gRPC, mikroserwisy
Znajomość baz danych SQL (MS SQL, PostgreSQL)
Znajomość systemów kolejkowych (Kafka, RabbitMQ)
Znajomość narzędzia Visual Studio
Znajomość Grafana, Prometheus
Znajomość CI/CD (Azure DevOps)
Doświadczenie w pracy z bazami danych w podejściu Code First oraz Database First
Znajomość Entity Framework Core oraz Dapper
Doświadczenie w projektowaniu i zarządzaniu bazami danych, w tym ich strukturą oraz zadaniami wykonywanymi po stronie serwera.
Znajomość zagadnień związanych z zarządzaniem użytkownikami, rolami i uprawnieniami w bazach danych
Umiejętność analizy i optymalizacji zapytań SQL oraz wydajności baz danych
Znajomość i doświadczenie w pracy z Redis – wykorzystanie cache, zarządzanie kluczami i czasem życia danych (TTL) oraz diagnostyka i monitoring.
Znajomość narzędzi wspierających zarządzanie pracą zespołu i procesem wytwarzania oprogramowania, w szczególności Jira/DevOps.
Mile widziane
Znajomość rozwiązań aplikacyjnych stosowanych w usługach kurierskich lub logistyce
Wykształcenie wyższe, informatyczne
To oferujemy
Zatrudnienie na podstawie Umowy o Pracę
Wynagrodzenie stałe oraz system prowizyjny
Pakiet benefitów pozapłacowych: system kafeteryjny MyBenefit, karta Multisport, prywatna opieka medyczna, ubezpieczenie na życie, karta paliwowa,
Dofinansowanie w ramach ZFŚS m.in. do wypoczynku, bonów świątecznych i innych
Elastyczny czas rozpoczynania pracy
Możliwość rozwoju zawodowego i poszerzania kompetencji w ramach udziału w wielu ciekawych projektach
Benefity
prywatna opieka medyczna
ubezpieczenie na życie
możliwość pracy zdalnej
elastyczny czas pracy
owoce
zniżki na firmowe produkty i usługi
dodatkowe świadczenia socjalne
karty przedpłacone
dofinansowanie wypoczynku
ORLEN PACZKA sp. z o.o.
Przewiń do profilu firmy
ORLEN Paczka to nowoczesna i wygodna usługa logistyczna dla e-commerce. Współpracujemy z wiodącymi platformami sprzedażowymi i sklepami internetowymi, a z naszej metody dostawy korzystają miliony klientów. Stawiamy na nieustanny rozwój i wprowadzanie innowacyjnych rozwiązań. Zespół ORLEN Paczki to ludzie z pasją, którzy rozwijają usługę w oparciu o potrzeby klientów. Dzięki wysokiej jakości świadczonych usług zdobyliśmy nagrodę Best Logistic Tool w konkursie e-Commerce Polska Awards 2024. Dołącz do ORLEN Paczki i buduj z nami jedną z najbardziej rozpoznawalnych usług na rynku.Nowość
Pracownik / Pracowniczka kuchni
SOLLEIM GROUP sp. z o.o.O firmie
32,00 – 33,00 zł
brutto / godz. | umowa zlecenie
ważna jeszcze miesiąc
(do 18 paź)
Hoża 29/31, Śródmieście, Warszawa
mazowieckie
umowa zlecenie
pełny etat, część etatu
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Praca od zaraz
Bez doświadczenia
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
Dni pracy:
dni robocze (poniedziałek - piątek), sobota, niedziela, święta
Godziny pracy:
elastyczny grafik
Możliwa praca w godzinach nocnych:
tak
Tryb wypłaty:
miesięczna
System wynagrodzeń:
stała podstawa wynagrodzenia + premia za wyniki + premia uznaniowa + napiwki
Więcej szczegółów
Siedziba firmy
SOLLEIM GROUP sp. z o.o.
SOLLEIM GROUP sp. z o.o.
Hoża 29/31, Śródmieście, Warszawa
Sprawdź czas dojazdu
Zlokalizuj się lub podaj dokładny adres
Samochód
-
Komunikacja
-
Rower
-
Pieszo
-
Twój zakres obowiązków
SOLLEIM wjeżdża na ulicę Hożą!
Szukamy osób do pracy w nowo otwartej restauracji przy ulicy Hożej w Warszawie. Potrzebujemy ludzi, którzy są gotowi zbudować z nami zgrany zespół i smażyć koreańskiego kurczaka w nowej miejscówce.
Lubisz gotować i czujesz się dobrze w pracy na kuchni? Być może to właśnie Ciebie poszukujemy, by ramię w ramię budować wizerunek naszej marki.
Chcemy, by SOLLEIM stało się miejscem, w którym Klient poczuje się dobrze zaopiekowany, poinformowany i przede wszystkim - najedzony!
Szukamy ludzi pozytywnych i chętnych do rozwoju naszej koreańskiej street foodowej marki!
Nasze wymagania
Luźny język połączony z wysoką kulturą osobistą, to wyjątkowo cenione przez nas skille, ale szeroki uśmiech to już must have do pracy w Solleim.
Charyzma i "ten błysk w oku" będą Twoim dodatkowym atutem ;)
Nie musisz zasłaniać się wykształceniem i rzucać w nas dyplomami, interesuje nas Twoja osobowość, chęć do nawiązywania relacji i otwartość.
Szukamy osób lojalnych i godnych zaufania, wewnętrznych ambasadorów, którym dobrze z oczu patrzy - bo co z oczu, to i z serca :).
Potrzebujemy kogoś, kto dba o czystość swojego stanowiska pracy i od czasu do czasu machnie szmatką, żeby na koniec zmiany wszystkim łatwiej się sprzątało ;)
Weźmiemy Cię chętnie na cały etat, ale mniejszy wymiar pracy też jest dla nas OK!
To oferujemy
Praca w Solleim, to przede wszystkim dołączenie do SolleimFamily - młodego, wspierającego się zespołu, w którym każdy ma przestrzeń do bycia sobą :) Kolczyki, tatuaże i kolorowe włosy - żaden problem!
Dbamy o swoich :) Nasi ludzie w trakcie pracy jedzą ze zniżką, a wieczorem chodzą na siłownie z Kartą Multisport. Bawimy się też wspólnie na integracjach.
Przyjemne z pożytecznym - po ćwiczeniach, przychodzi czas na pracę, ale nie martw się: gwarantujemy porządne szkolenie - na start nie wymagamy doświadczenia!
Płacimy na czas!
Jeśli jeszcze go nie posiadasz, to pomożemy w wyrobieniu orzeczenia do celów sanitarno-epidemiologicznych / książeczki.
Na dzień dobry podpisujemy umowę zlecenie. Wchodzisz w to?
Benefity
dofinansowanie zajęć sportowych
elastyczny czas pracy
zniżki na firmowe produkty i usługi
spotkania integracyjne
kawa / herbata
O nas
SOLLEIM to street food z autentyczną koreańską szamką. Naszą specjalnością są Korean Fried Chicken serwowane w towarzystwie autorskich sosów. Na wrocławskim rynku działamy od 2019 roku. Pierwszy lokal w Bielanach Wrocławskich otworzyła młoda polsko-koreańska ekipa tworząc własne, unikatowe receptury. Od tamtej pory poszerzamy obszary działalności o kolejne miejscówki.Kucharz (ze znajomością kuchni ukraińskiej)
UBICOM sp. z o.o.O firmie
35,00 – 45,00 zł
brutto / godz. | umowa zlecenie
ważna jeszcze 25 dni
(do 13 paź)
Aleje Jerozolimskie 179, Ochota, Warszawa
mazowieckie
umowa zlecenie
pełny etat
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Запрошуємо працівників з України
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
Dni pracy:
dni robocze (poniedziałek - piątek), sobota, niedziela, święta,
Godziny pracy:
elastyczny grafik, możliwe nadgodziny,
Tryb wypłaty:
miesięczna
System wynagrodzeń:
stała podstawa wynagrodzenia
Siedziba firmy
UBICOM sp. z o.o.
Aleje Jerozolimskie 179, Ochota, Warszawa
Sprawdź czas dojazdu
Zlokalizuj się lub podaj dokładny adres
Samochód
-
Komunikacja
-
Rower
-
Pieszo
-
Twój zakres obowiązków
Obowiązki Kucharza:
Samodzielne przygotowywanie potraw zgodnie z menu oraz obowiązującymi standardami lokalu.
Kontrola jakości produktów, przestrzeganie zasad sanitarnych oraz prawidłowego przechowywania żywności.
Sporządzanie zamówień na produkty, kontrola stanów magazynowych oraz przeprowadzanie inwentaryzacji.
Utrzymywanie porządku w kuchni oraz nadzór nad sprawnością sprzętu.
Opracowywanie ofert sezonowych oraz aktualizacja menu.Kucharz do Bistro (m/k)
Level WorkO firmie
7 800 – 8 800 zł
brutto / mies. | umowa o pracę
ważna jeszcze miesiąc
(do 17 paź)
Warszawa
mazowieckie
umowa o pracę
pełny etat
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Praca od zaraz
Szukamy wielu kandydatów3 wakaty
Запрошуємо працівників з України
Asystent Pracuj.pl
Sprawdź, jak dobrze ta oferta do Ciebie pasuje
Podsumowanie oferty
Zobacz
Dodatkowe informacje
System wynagrodzeń:
stała podstawa wynagrodzenia
Bez delegacji:
tak
Praca zmianowa:
nie
Dni pracy:
dni robocze (poniedziałek - piątek)
Godziny pracy:
6:00-14:00, 7:00-15:00
Możliwa praca w godzinach nocnych:
nie
Tryb wypłaty:
miesięczna
Specjalne uprawnienia:
Aktualne badania sanitarno-epidemiologiczne
Wymagane języki:
angielski
Mniej szczegółów
Rekrutujemy dla
Dołącz do zespołu i przygotowuj dania kuchni ciepłej i zimnej, dbając o najwyższą jakość i estetykę serwowanych potraw.
Twój zakres obowiązków
Na tym stanowisku będziesz przygotowywać różnorodne dania kuchni ciepłej i zimnej. Zależy nam na smaku, jakości i estetyce podania, dlatego szukamy osoby doświadczonej, samodzielnej i dobrze zorganizowanej.
Będziesz odpowiadać za przygotowanie potraw zgodnie ze standardami, właściwą organizację pracy oraz utrzymanie porządku i higieny na swoim stanowisku.
Nasze wymagania
Minimum 4 lata doświadczenia w pracy jako kucharz;
Komunikatywna znajomość języka angielskiego;
Aktualne orzeczenie do celów sanitarno-epidemiologicznych;
Samodzielność, punktualność i odpowiedzialność;
Dbałość o smak, jakość i wygląd przygotowywanych dań.
To oferujemy
Wynagrodzenie 7800–8800 zł brutto miesięcznie.
Premia kwartalna wypłacana co 3 miesiące – 15% wynagrodzenia.
Umowa o pracę.
Praca od poniedziałku do piątku.
Stałe godziny: 6:00–14:00 lub 7:00–15:00.
Wolne weekendy, wieczory i noce.
Bezpłatne posiłki pracownicze.
Prywatna opieka medyczna.
Dofinansowanie karty sportowej.
Ubezpieczenie na życie.
Program poleceń pracowniczych.
Profesjonalne wdrożenie i szkolenia.
Praca w komfortowej lokalizacji przy Rondzie Daszyńskiego.
Benefity
dofinansowanie zajęć sportowych
prywatna opieka medyczna
ubezpieczenie na życie
Bezpłatne posiłki pracownicze
Program poleceń
Gastronomia bez wieczorów, nocek i pracy w weekendy? Tak, to możliwe!
Dołącz do zespołu restauracji/bistro mieszczącego się w nowoczesnym biurowcu w świetnie skomunikowanej części Warszawy.
Tutaj pracujesz od poniedziałku do piątku, kończysz najpóźniej o 15:00, a popołudnia i weekendy masz dla siebie. Otrzymujesz umowę o pracę, wynagrodzenie od 7800 do 8800 zł brutto oraz premię kwartalną w wysokości 15% wynagrodzenia.
Dobre godziny. Dobra lokalizacja. Stabilne zatrudnienie.`;

/**
 * Ręcznie wyizolowane, „czyste” wersje każdej oferty — te same zdania źródłowe
 * co w pełnym wklejeniu (RAW_CORPUS), ale bez sąsiadującego szumu innej oferty.
 * Służą do rozdzielenia dwóch różnych źródeł utraty jakości: błędów segmentacji
 * (`preprocessJobOfferPaste`, mierzone na RAW_CORPUS) od błędów samej ekstrakcji
 * pól (`parseJobDescriptionLocal`, mierzone tutaj na czystym tekście jednej oferty).
 */
export const CLEAN_TEXTS: Record<string, string> = {
  elektrobudowa: `Programista C/C++
ELEKTROBUDOWA sp. z o.o.O firmie
Katowice
śląskie
umowa o pracę
pełny etat
specjalista / specjalistka (mid / regular)
praca stacjonarna
Asystent Pracuj.pl
Podsumowanie oferty
Backend
Technologie, których używamy
Wymagane
C
C++
Git
System operacyjny
Twój zakres obowiązków
projektowanie i tworzenie oprogramowania do produkcji zabezpieczeń,
współpraca z wydziałem produkcji i technologii,
tworzenie oprogramowania pod systemem operacyjnym Windows.
Nasze wymagania
bardzo dobra znajomość języka C/C++,
bardzo dobra znajomość zagadnień sieciowych TCP/IP, unicast, multicast, broadcast, ISO, OSI,
znajomość programu GIT,
umiejętność pracy w zespole,
prawo jazdy kat. B.
Mile widziane
znajomość języka Pascal,
umiejętność przejścia z języka Pascal na C++,
znajomość protokołu komunikacyjnego IEC61850,
znajomość protokołów komunikacyjnych IEC870-5-103, DNP3, CANBUS, MODBUS,
znajomość zagadnień energetyki zabezpieczeniowej,
programista embedded,
znajomości języka angielskiego,
znajomość frameworka QT.
To oferujemy
zatrudnienie na podstawie umowy o pracę,
wynagrodzenie dostosowane do posiadanych umiejętności i doświadczenia,
możliwość doskonalenia zawodowego poprzez system szkoleń.`,

  pp_solutions: `Senior .NET Developer / Solution Architect
P&P Solutions Sp. z o.o.O firmie
100,00 – 120,00 zł
netto (+ VAT) / godz. | kontrakt B2B
Siedziba firmy:
Katowice
śląskie
Miejsce pracy:
Cała Polska (praca zdalna)
kontrakt B2B
pełny etat
starszy specjalista / starsza specjalistka (senior)
praca zdalna
Asystent Pracuj.pl
Podsumowanie oferty
Specjalizacje:
Backend
Wymagane języki:
angielski
Technologie, których używamy
Wymagane
.NET
C#
Oracle SQL
Git
PL/SQL
Mile widziane
DevExpress WinForms
Dapper
XPO
Docker
Jira
Confluence
Bitbucket
GitHub
O projekcie
Poszukujemy Senior .NET Developera / Solution Architecta do długoterminowego projektu.
Tech Stack: .NET Framework 4.7.2, .NET 6, C#, WinForms, WPF, Oracle 11.2/19c, PL/SQL, Dapper, DevExpress, XPO, Docker, Git, CI/CD.
Twój zakres obowiązków
projektowanie i implementacja nowych funkcjonalności w C#/.NET,
rozwój i utrzymanie istniejących aplikacji,
projektowanie rozwiązań zgodnie z CQRS, DDD, MVVM i dobrymi praktykami,
tworzenie testów jednostkowych i udział w code review.
Nasze wymagania
minimum 5 lat samodzielnego doświadczenia komercyjnego w programowaniu,
bardzo dobra znajomość C# / .NET / .NET Framework,
doświadczenie w pracy z Oracle SQL / PL/SQL oraz znajomość relacyjnych baz danych, w tym PostgreSQL,
praktyczne doświadczenie z WinForms i/lub WPF,
znajomość MVVM, CQRS i DDD,
znajomość technologii internetowych, REST API i integracji systemowych,
znajomość Git oraz procesów CI/CD,
wykształcenie wyższe,
język angielski min. B1.
Mile widziane
DevExpress WinForms,
Dapper / XPO,
znajomość Docker,
doświadczenie w Scrum,
znajomość Jira, Confluence, Bitbucket,
doświadczenie w systemach ERP,
GitHub lub inne portfolio projektów.
To oferujemy
pracę hybrydową lub 100% zdalną,
wynagrodzenie 100–120 PLN/h netto.`,

  orlen_paczka: `Programista .NET (k/m)
ORLEN PACZKA sp. z o.o.O firmie
Annopol 17A, Białołęka, Warszawa
mazowieckie
umowa o pracę
pełny etat
specjalista / specjalistka (mid / regular)
praca hybrydowa
Asystent Pracuj.pl
Podsumowanie oferty
Specjalizacje:
Backend
Technologie, których używamy
Wymagane
.NET
C#
SQL
Kafka
RabbitMQ
Twój zakres obowiązków
Rozwój aplikacji biznesowych.
Nasze wymagania
Minimum 3 lat doświadczenia w roli .NET Developera
Znajomość i doświadczenie w pracy z konteneryzacją (Docker/Kubernetes)
Znajomość platformy .NET (C#, Winforms,Blazor, ASP .NET, MVC)
Doświadczenie w tworzeniu usług backendowych: REST API, gRPC, mikroserwisy
Znajomość baz danych SQL (MS SQL, PostgreSQL)
Znajomość systemów kolejkowych (Kafka, RabbitMQ)
Znajomość Grafana, Prometheus
Znajomość CI/CD (Azure DevOps)
Znajomość Entity Framework Core oraz Dapper
Znajomość i doświadczenie w pracy z Redis
Znajomość narzędzi wspierających zarządzanie pracą zespołu, w szczególności Jira/DevOps.
Mile widziane
Znajomość rozwiązań aplikacyjnych stosowanych w usługach kurierskich lub logistyce
Wykształcenie wyższe, informatyczne
To oferujemy
Zatrudnienie na podstawie Umowy o Pracę.`,

  solleim: `Pracownik / Pracowniczka kuchni
SOLLEIM GROUP sp. z o.o.O firmie
32,00 – 33,00 zł
brutto / godz. | umowa zlecenie
Hoża 29/31, Śródmieście, Warszawa
mazowieckie
umowa zlecenie
pełny etat, część etatu
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Praca od zaraz
Bez doświadczenia
Asystent Pracuj.pl
Podsumowanie oferty
Twój zakres obowiązków
Szukamy osób do pracy w nowo otwartej restauracji.
Nasze wymagania
Luźny język połączony z wysoką kulturą osobistą.
Nie musisz zasłaniać się wykształceniem.
To oferujemy
Dbamy o swoich, jedzą ze zniżką.
Jeśli jeszcze go nie posiadasz, to pomożemy w wyrobieniu orzeczenia do celów sanitarno-epidemiologicznych / książeczki.`,

  ubicom: `Kucharz (ze znajomością kuchni ukraińskiej)
UBICOM sp. z o.o.O firmie
35,00 – 45,00 zł
brutto / godz. | umowa zlecenie
Aleje Jerozolimskie 179, Ochota, Warszawa
mazowieckie
umowa zlecenie
pełny etat
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Asystent Pracuj.pl
Podsumowanie oferty
Twój zakres obowiązków
Obowiązki Kucharza:
Samodzielne przygotowywanie potraw zgodnie z menu oraz obowiązującymi standardami lokalu.
Kontrola jakości produktów, przestrzeganie zasad sanitarnych oraz prawidłowego przechowywania żywności.
Sporządzanie zamówień na produkty, kontrola stanów magazynowych oraz przeprowadzanie inwentaryzacji.
Utrzymywanie porządku w kuchni oraz nadzór nad sprawnością sprzętu.
Opracowywanie ofert sezonowych oraz aktualizacja menu.`,

  level_work: `Kucharz do Bistro (m/k)
Level WorkO firmie
7 800 – 8 800 zł
brutto / mies. | umowa o pracę
Warszawa
mazowieckie
umowa o pracę
pełny etat
pracownik fizyczny / pracowniczka fizyczna
praca stacjonarna
Praca od zaraz
Asystent Pracuj.pl
Podsumowanie oferty
Specjalne uprawnienia:
Aktualne badania sanitarno-epidemiologiczne
Wymagane języki:
angielski
Twój zakres obowiązków
Na tym stanowisku będziesz przygotowywać różnorodne dania kuchni ciepłej i zimnej.
Nasze wymagania
Minimum 4 lata doświadczenia w pracy jako kucharz;
Komunikatywna znajomość języka angielskiego;
Aktualne orzeczenie do celów sanitarno-epidemiologicznych;
Samodzielność, punktualność i odpowiedzialność;
Dbałość o smak, jakość i wygląd przygotowywanych dań.
To oferujemy
Wynagrodzenie 7800–8800 zł brutto miesięcznie.
Premia kwartalna wypłacana co 3 miesiące.`,
};
