/**
 * Niezależny, ślepy holdout ekstrakcji JD.
 *
 * Tekst i gold są utrzymywane razem wyłącznie po to, aby test był
 * samowystarczalny i powtarzalny. Gold został zapisany ręcznie przed
 * uruchomieniem parsera; nie jest generowany z jego wyniku ani z benchmarku
 * historycznego.
 */

export interface HoldoutGoldFormalRequirement {
  id: string;
  label: string;
  required: boolean;
}

export interface HoldoutGold {
  id: string;
  domain: 'IT' | 'NON_IT';
  language: 'PL' | 'EN' | 'MIXED';
  title: string;
  company: string;
  seniority: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ON_SITE';
  contractTypes: string[];
  salary: { min: number; max: number; currency: string; period: string; grossNet: string } | null;
  location: string;
  experienceMinYears: number | null;
  languages: string[];
  requiredSkills: string[];
  niceSkills: string[];
  formalRequirements: HoldoutGoldFormalRequirement[];
}

export interface HoldoutOffer {
  gold: HoldoutGold;
  text: string;
  noisyPortalPaste?: boolean;
}

const offer = (
  gold: HoldoutGold,
  body: string,
  noisyPortalPaste = false,
): HoldoutOffer => ({
  gold,
  text: `${gold.title}\n${gold.company} O firmie\n${body}`,
  noisyPortalPaste,
});

export const HOLDOUT_OFFERS: HoldoutOffer[] = [
  offer({
    id: '01-java-backend',
    domain: 'IT', language: 'PL', title: 'Java Backend Developer', company: 'Northstar Labs sp. z o.o.',
    seniority: 'MID', workMode: 'HYBRID', contractTypes: ['umowa o pracę'],
    salary: { min: 16000, max: 22000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Warszawa', experienceMinYears: 3, languages: ['angielski (B2)'],
    requiredSkills: ['java', 'spring', 'postgresql', 'docker', 'kafka', 'git'],
    niceSkills: ['kubernetes', 'aws', 'ci/cd'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 3 lata doświadczenia', required: true }],
  }, `Warszawa\numowa o pracę\n16 000 – 22 000 PLN brutto / miesiąc\npraca hybrydowa\nmid / regular\nTwój zakres obowiązków\nRozwój usług backendowych.\nNasze wymagania\nMinimum 3 lata doświadczenia. Java, Spring, PostgreSQL, Docker, Kafka i Git. Angielski (B2).\nMile widziane\nKubernetes, AWS, CI/CD.`),
  offer({
    id: '02-kotlin-backend', domain: 'IT', language: 'EN', title: 'Senior Kotlin Backend Engineer', company: 'Blue Orbit Ltd.',
    seniority: 'SENIOR', workMode: 'REMOTE', contractTypes: ['kontrakt B2B'],
    salary: { min: 18000, max: 25000, currency: 'PLN', period: 'miesiąc', grossNet: 'netto' },
    location: 'Kraków / remote', experienceMinYears: 5, languages: ['English (C1)'],
    requiredSkills: ['kotlin', 'java', 'spring', 'postgresql', 'docker', 'kubernetes'],
    niceSkills: ['aws', 'terraform', 'ci/cd'],
    formalRequirements: [{ id: 'experience_years', label: 'Minimum 5 years experience', required: true }],
  }, `Kraków / remote\nkontrakt B2B\n18 000 – 25 000 PLN netto / miesiąc\nremote\nsenior\nResponsibilities\nBuild backend services.\nRequirements\nMinimum 5 years experience. Kotlin, Java, Spring, PostgreSQL, Docker and Kubernetes. English (C1).\nNice to have\nAWS, Terraform, CI/CD.`),
  offer({
    id: '03-it-support', domain: 'IT', language: 'PL', title: 'Specjalista IT Support', company: 'Asteria Services S.A.',
    seniority: 'ENTRY', workMode: 'ON_SITE', contractTypes: ['umowa o pracę'],
    salary: null, location: 'Poznań', experienceMinYears: null, languages: ['angielski (B2)'],
    requiredSkills: ['windows', 'linux', 'jira', 'active directory'],
    niceSkills: ['sql', 'azure'],
    formalRequirements: [{ id: 'degree', label: 'Wykształcenie wyższe', required: false }],
  }, `Poznań\numowa o pracę\npraca stacjonarna\njunior / entry\nTwój zakres obowiązków\nWsparcie użytkowników i obsługa zgłoszeń.\nNasze wymagania\nWindows, Linux, Jira i Active Directory. Angielski (B2).\nMile widziane\nSQL, Azure. Wykształcenie wyższe.`),
  offer({
    id: '04-frontend', domain: 'IT', language: 'MIXED', title: 'Remote Frontend Developer', company: 'Pixel Grove Sp. z o.o.',
    seniority: 'MID', workMode: 'REMOTE', contractTypes: ['umowa o pracę', 'kontrakt B2B'],
    salary: { min: 14000, max: 19000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Cała Polska', experienceMinYears: 2, languages: ['English (B2)'],
    requiredSkills: ['typescript', 'javascript', 'react', 'next.js', 'css', 'git'],
    niceSkills: ['graphql', 'cypress', 'tailwind'],
    formalRequirements: [{ id: 'experience_years', label: '2 years of experience', required: true }],
  }, `Cała Polska\numowa o pracę lub kontrakt B2B\n14 000 – 19 000 PLN brutto / miesiąc\n100% zdalnie\nregular\nResponsibilities\nBuild accessible web interfaces.\nRequirements\n2 years of experience. TypeScript, JavaScript, React, Next.js, CSS and Git. English (B2).\nNice to have\nGraphQL, Cypress, Tailwind.`),
  offer({
    id: '05-plc', domain: 'IT', language: 'PL', title: 'Inżynier automatyki PLC', company: 'Faktor Machines Sp. z o.o.',
    seniority: 'MID', workMode: 'ON_SITE', contractTypes: ['umowa o pracę'],
    salary: { min: 12000, max: 17000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Wrocław', experienceMinYears: 2, languages: [],
    requiredSkills: ['plc', 'siemens', 'scada', 'electrical engineering'],
    niceSkills: ['t ia portal', 'robotics', 'english'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 2 lata doświadczenia', required: true }],
  }, `Wrocław\numowa o pracę\n12 000 – 17 000 PLN brutto / miesiąc\npraca stacjonarna\nspecjalista\nTwój zakres obowiązków\nProgramowanie sterowników i uruchomienia.\nNasze wymagania\nMinimum 2 lata doświadczenia. PLC, Siemens, SCADA i electrical engineering.\nMile widziane\nTIA Portal, robotyka, English.`),
  offer({
    id: '06-bi', domain: 'IT', language: 'PL', title: 'Analityk BI', company: 'Data Meadow S.A.',
    seniority: 'MID', workMode: 'HYBRID', contractTypes: ['umowa o pracę'],
    salary: null, location: 'Gdańsk', experienceMinYears: 3, languages: ['angielski'],
    requiredSkills: ['sql', 'power bi', 'python', 'excel'],
    niceSkills: ['azure', 'tableau', 'etl'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 3 lata doświadczenia', required: true }],
  }, `Gdańsk\numowa o pracę\npraca hybrydowa\nregular\nTwój zakres obowiązków\nBudowa raportów i modeli danych.\nNasze wymagania\nMinimum 3 lata doświadczenia. SQL, Power BI, Python i Excel. Angielski.\nMile widziane\nAzure, Tableau, ETL.`),
  offer({
    id: '07-customer-service', domain: 'NON_IT', language: 'PL', title: 'Specjalista ds. obsługi klienta', company: 'Dobry Kontakt Sp. z o.o.',
    seniority: 'ENTRY', workMode: 'HYBRID', contractTypes: ['umowa zlecenie'],
    salary: { min: 30, max: 34, currency: 'PLN', period: 'godzina', grossNet: 'brutto' },
    location: 'Łódź', experienceMinYears: null, languages: ['angielski (B2)'],
    requiredSkills: ['komunikatywność', 'praca zespołowa'], niceSkills: ['crm'],
    formalRequirements: [],
  }, `Łódź\numowa zlecenie\n30 – 34 PLN brutto / godz.\npraca hybrydowa\njunior\nObowiązki\nKontakt z klientami i obsługa zgłoszeń.\nWymagania\nKomunikatywność i praca zespołowa. Angielski (B2).\nMile widziane\nZnajomość CRM.`),
  offer({
    id: '08-warehouse', domain: 'NON_IT', language: 'PL', title: 'Magazynier - operator wózka widłowego', company: 'LogiPark Polska', seniority: 'ENTRY',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: { min: 5200, max: 6500, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Katowice', experienceMinYears: null, languages: [], requiredSkills: ['wózki widłowe', 'udt'],
    niceSkills: ['system magazynowy'], formalRequirements: [{ id: 'udt', label: 'Uprawnienia UDT na wózki widłowe', required: true }],
  }, `Katowice\numowa o pracę\n5 200 – 6 500 PLN brutto / miesiąc\npraca stacjonarna\nObowiązki\nPrzyjęcie i wydanie towaru.\nWymagania\nUprawnienia UDT na wózki widłowe.\nMile widziane\nZnajomość systemu magazynowego.`),
  offer({
    id: '09-accountant', domain: 'NON_IT', language: 'PL', title: 'Samodzielna księgowa', company: 'Saldo Partner sp. z o.o.', seniority: 'SENIOR',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: { min: 9000, max: 12000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Warszawa', experienceMinYears: 4, languages: [],
    requiredSkills: ['pełna księgowość', 'excel'], niceSkills: ['enova', 'symfonia'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 4 lata doświadczenia', required: true }],
  }, `Warszawa\numowa o pracę\n9 000 – 12 000 PLN brutto / miesiąc\nstacjonarnie\nsenior\nObowiązki\nProwadzenie ksiąg i deklaracji.\nWymagania\nMinimum 4 lata doświadczenia. Pełna księgowość i Excel.\nMile widziane\nenova, Symfonia.`),
  offer({
    id: '10-cook', domain: 'NON_IT', language: 'PL', title: 'Kucharz kuchni polskiej', company: 'Bistro Rzeka', seniority: 'ENTRY',
    workMode: 'ON_SITE', contractTypes: ['umowa zlecenie'], salary: { min: 32, max: 38, currency: 'PLN', period: 'godzina', grossNet: 'brutto' },
    location: 'Kraków', experienceMinYears: null, languages: [],
    requiredSkills: ['kuchnia polska', 'praca zespołowa'], niceSkills: ['sanepid'],
    formalRequirements: [],
  }, `Kraków\numowa zlecenie\n32 – 38 PLN brutto / godz.\npraca stacjonarna\njunior\nObowiązki\nPrzygotowanie dań kuchni polskiej.\nWymagania\nZnajomość kuchni polskiej i praca zespołowa.\nMile widziane\nKsiążeczka sanepidowska.`),
  offer({
    id: '11-office', domain: 'NON_IT', language: 'PL', title: 'Koordynator biura', company: 'Urban Office S.A.', seniority: 'MID',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: null, location: 'Warszawa', experienceMinYears: 2,
    languages: ['angielski (B2)'], requiredSkills: ['excel', 'organizacja pracy'], niceSkills: ['powerpoint'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 2 lata doświadczenia', required: true }],
  }, `Warszawa\numowa o pracę\npraca stacjonarna\nregular\nObowiązki\nKoordynacja biura i dostaw.\nWymagania\nMinimum 2 lata doświadczenia. Excel i dobra organizacja pracy. Angielski (B2).\nMile widziane\nPowerPoint.`),
  offer({
    id: '12-devops', domain: 'IT', language: 'EN', title: 'DevOps Engineer', company: 'Cloud Harbor Inc.', seniority: 'SENIOR',
    workMode: 'REMOTE', contractTypes: ['kontrakt B2B'], salary: { min: 22000, max: 30000, currency: 'PLN', period: 'miesiąc', grossNet: 'netto' },
    location: 'Remote, Poland', experienceMinYears: 5, languages: ['English (C1)'],
    requiredSkills: ['linux', 'docker', 'kubernetes', 'terraform', 'aws', 'ci/cd'],
    niceSkills: ['azure', 'python', 'grafana'], formalRequirements: [{ id: 'experience_years', label: 'Minimum 5 years experience', required: true }],
  }, `Remote, Poland\nkontrakt B2B\n22 000 – 30 000 PLN netto / miesiąc\nremote\nsenior\nResponsibilities\nOperate cloud infrastructure.\nRequirements\nMinimum 5 years experience. Linux, Docker, Kubernetes, Terraform, AWS and CI/CD. English (C1).\nNice to have\nAzure, Python, Grafana.`),
  offer({
    id: '13-embedded', domain: 'IT', language: 'EN', title: 'Embedded C/C++ Developer', company: 'Signal Devices GmbH', seniority: 'MID',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: null, location: 'Wrocław', experienceMinYears: 3, languages: ['English (B2)'],
    requiredSkills: ['c', 'c++', 'embedded', 'linux', 'git'], niceSkills: ['canbus', 'qt', 'python'],
    formalRequirements: [{ id: 'experience_years', label: '3 years of experience', required: true }],
  }, `Wrocław\numowa o pracę\npraca stacjonarna\nmid\nResponsibilities\nDevelop firmware for devices.\nRequirements\n3 years of experience. C, C++, Embedded, Linux and Git. English (B2).\nNice to have\nCANBUS, Qt, Python.`),
  offer({
    id: '14-digital-marketing', domain: 'NON_IT', language: 'MIXED', title: 'Digital Marketing Specialist', company: 'Market Bloom Sp. z o.o.', seniority: 'MID',
    workMode: 'HYBRID', contractTypes: ['umowa o pracę'], salary: { min: 8000, max: 11000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Poznań', experienceMinYears: 2, languages: ['angielski (B2)'],
    requiredSkills: ['google analytics', 'seo', 'copywriting'], niceSkills: ['google ads', 'meta ads'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 2 lata doświadczenia', required: true }],
  }, `Poznań\numowa o pracę\n8 000 – 11 000 PLN brutto / miesiąc\npraca hybrydowa\nspecjalista\nObowiązki\nPlanowanie kampanii online.\nWymagania\nMinimum 2 lata doświadczenia. SEO, Google Analytics i copywriting. Angielski (B2).\nMile widziane\nGoogle Ads, Meta Ads.`),
  offer({
    id: '15-hotel', domain: 'NON_IT', language: 'PL', title: 'Recepcjonista hotelowy', company: 'Hotel Panorama', seniority: 'ENTRY',
    workMode: 'ON_SITE', contractTypes: ['umowa zlecenie'], salary: { min: 30, max: 35, currency: 'PLN', period: 'godzina', grossNet: 'brutto' },
    location: 'Gdańsk', experienceMinYears: null, languages: ['angielski (B2)'],
    requiredSkills: ['obsługa klienta', 'komunikatywność'], niceSkills: ['niemiecki', 'system hotelowy'], formalRequirements: [],
  }, `Gdańsk\numowa zlecenie\n30 – 35 PLN brutto / godz.\npraca stacjonarna\nentry\nObowiązki\nObsługa gości i rezerwacji.\nWymagania\nObsługa klienta i komunikatywność. Angielski (B2).\nMile widziane\nNiemiecki, znajomość systemu hotelowego.`),
  offer({
    id: '16-business-systems', domain: 'IT', language: 'EN', title: 'Business Systems Analyst', company: 'Process Bridge S.A.', seniority: 'MID',
    workMode: 'HYBRID', contractTypes: ['umowa o pracę'], salary: null, location: 'Warszawa', experienceMinYears: 3, languages: ['English (B2)'],
    requiredSkills: ['sql', 'jira', 'erp', 'agile'], niceSkills: ['uml', 'power bi'],
    formalRequirements: [{ id: 'experience_years', label: '3 years of experience', required: true }],
  }, `Warszawa\numowa o pracę\npraca hybrydowa\nregular\nResponsibilities\nMap business processes and system requirements.\nRequirements\n3 years of experience. SQL, Jira, ERP and Agile. English (B2).\nNice to have\nUML, Power BI.`),
  offer({
    id: '17-procurement', domain: 'NON_IT', language: 'PL', title: 'Specjalista ds. zakupów', company: 'Supply Works S.A.', seniority: 'MID',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: { min: 8500, max: 11500, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Katowice', experienceMinYears: 2, languages: ['angielski (B2)'],
    requiredSkills: ['negocjacje', 'excel', 'erp'], niceSkills: ['sap'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 2 lata doświadczenia', required: true }],
  }, `Katowice\numowa o pracę\n8 500 – 11 500 PLN brutto / miesiąc\nstacjonarnie\nspecjalista\nObowiązki\nProwadzenie zakupów i negocjacji.\nWymagania\nMinimum 2 lata doświadczenia. Negocjacje, Excel i ERP. Angielski (B2).\nMile widziane\nSAP.`),
  offer({
    id: '18-qa', domain: 'IT', language: 'MIXED', title: 'QA Automation Engineer', company: 'Quality Loop Ltd.', seniority: 'MID',
    workMode: 'REMOTE', contractTypes: ['kontrakt B2B'], salary: { min: 15000, max: 21000, currency: 'PLN', period: 'miesiąc', grossNet: 'netto' },
    location: 'Cała Polska', experienceMinYears: 3, languages: ['English (B2)'],
    requiredSkills: ['javascript', 'cypress', 'selenium', 'api', 'git'],
    niceSkills: ['typescript', 'playwright', 'ci/cd'], formalRequirements: [{ id: 'experience_years', label: 'Min. 3 lata doświadczenia', required: true }],
  }, `Cała Polska\nkontrakt B2B\n15 000 – 21 000 PLN netto / miesiąc\nremote\nmid\nResponsibilities\nAutomate web and API tests.\nRequirements\nMinimum 3 lata doświadczenia. JavaScript, Cypress, Selenium, API and Git. English (B2).\nNice to have\nTypeScript, Playwright, CI/CD.`),
  offer({
    id: '19-medical', domain: 'NON_IT', language: 'PL', title: 'Rejestrator medyczny', company: 'Centrum Zdrowia Nova', seniority: 'ENTRY',
    workMode: 'ON_SITE', contractTypes: ['umowa o pracę'], salary: null, location: 'Łódź', experienceMinYears: null, languages: [],
    requiredSkills: ['obsługa pacjenta', 'komunikatywność'], niceSkills: ['rejestracja medyczna'], formalRequirements: [],
  }, `Łódź\numowa o pracę\npraca stacjonarna\nentry\nObowiązki\nRejestracja pacjentów i kontakt telefoniczny.\nWymagania\nObsługa pacjenta i komunikatywność.\nMile widziane\nDoświadczenie w rejestracji medycznej.`),
  offer({
    id: '20-sales-dotnet', domain: 'IT', language: 'MIXED', title: '.NET / React Developer', company: 'Portal House Sp. z o.o.', seniority: 'SENIOR',
    workMode: 'REMOTE', contractTypes: ['umowa o pracę', 'kontrakt B2B'],
    salary: { min: 17000, max: 24000, currency: 'PLN', period: 'miesiąc', grossNet: 'brutto' },
    location: 'Kraków / remote', experienceMinYears: 4, languages: ['angielski (B2)'],
    requiredSkills: ['c#', '.net', 'asp.net', 'react', 'typescript', 'postgresql', 'ef core', 'git'],
    niceSkills: ['docker', 'ci/cd', 'azure'],
    formalRequirements: [{ id: 'experience_years', label: 'Min. 4 lata doświadczenia', required: true }],
  }, `Portal ogłoszeń\nAplikuj teraz\nSprawdź dopasowanie\nKraków / remote\numowa o pracę lub kontrakt B2B\n17 000 – 24 000 PLN brutto / miesiąc\npraca zdalna\nsenior\nWażna jeszcze 12 dni\nAsystent portalu\nPodsumowanie oferty\nObowiązki\nRozwój platformy sprzedażowej.\nWymagania\nMinimum 4 lata doświadczenia. C#, .NET, ASP.NET, React, TypeScript, PostgreSQL, EF Core i Git. Angielski (B2).\nMile widziane\nDocker, CI/CD, Azure.\nBenefity\nPrywatna opieka medyczna, karta sportowa.` , true),
];

export const HOLDOUT_OFFER_ORDER = HOLDOUT_OFFERS.map(({ gold }) => gold.id);
