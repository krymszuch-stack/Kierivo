import { describe, it, expect } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { benefitPackageValue, benefitSourcesFromOffer, detectBenefits } from '../commuteCalculator';

/**
 * Osobne testy regresji precyzji dla remediacji recall z rozdziału "JD
 * holdout" — NIE mieszać z zamrożonymi plikami `jdExtractionHoldout.*`
 * (fixtures/harness/test), których liczby są punktem odniesienia i nie mogą
 * się zmienić. Ten plik chroni jedną rzecz: że nowa "bezpieczna ścieżka
 * generyczna" (`extractGenericRequirementCandidates` w
 * `jdSkillTaxonomy.ts`), rozszerzona taksonomia i rozpoznawanie angielskich
 * nagłówków sekcji NIE zaczęły łapać jako umiejętności rzeczy, które nigdy
 * nimi nie są: benefitów, widełek płacowych, nazw miast, ogólnych
 * rzeczowników, opisu firmy ani szumu portalu ogłoszeniowego. Każdy test to
 * jedna konkretna kategoria ryzyka wymieniona przez użytkownika w zadaniu.
 */
describe('jdParser — regresja precyzji po rozszerzeniu taksonomii', () => {
  it('rozpoznaje wymagania po inline nagłówku „Wymagania obowiązkowe”', () => {
    const parsed = parseJobDescriptionLocal(
      'IT Support Technician\nWymagania obowiązkowe: Zendesk ticketing system. Minimum 3 lata doświadczenia.'
    );

    expect(parsed.sourceSections?.required.join(' ')).toContain('Zendesk ticketing system');
    expect(parsed.experienceMinYears).toBe(3);
  });

  it('rozpoznaje nagłówek wymagań po zdaniu wprowadzającym w tym samym wierszu', () => {
    const parsed = parseJobDescriptionLocal(
      'Szukamy elektryka do prac montażowych. Wymagania: montaż instalacji elektrycznych, uprawnienia SEP do 1kV, podłączanie rozdzielnic elektrycznych, pomiary ochronne, czytanie projektów elektrycznych.'
    );

    const requiredText = parsed.sourceSections?.required.join(' ') ?? '';
    expect(requiredText).toContain('montaż instalacji elektrycznych');
    expect(requiredText).toContain('podłączanie rozdzielnic elektrycznych');
    expect(requiredText).toContain('pomiary ochronne');
    expect(requiredText).not.toContain('Szukamy elektryka');
    expect(parsed.requiredHardSkills).toEqual(expect.arrayContaining([
      'Instalacje elektryczne',
      'Montaż rozdzielnic elektrycznych',
      'Pomiary elektryczne ochronne',
      'Czytanie projektów elektrycznych',
    ]));
  });

  it('łączy wymagania z kilku sekcji i nie wciąga rozdzielających je obowiązków', () => {
    const parsed = parseJobDescriptionLocal(`
      IT Support Technician
      Wymagania: ServiceNow, Windows 11.
      Twój zakres obowiązków:
      Konfiguracja Jira Service Management i Docker.
      Wymagania obowiązkowe: Zendesk, Microsoft 365.
    `);

    const requiredText = parsed.sourceSections?.required.join(' ') ?? '';
    expect(requiredText).toContain('ServiceNow, Windows 11.');
    expect(requiredText).toContain('Zendesk, Microsoft 365.');
    expect(requiredText).not.toContain('Jira Service Management');
    expect(requiredText).not.toContain('Docker');
    expect(parsed.toolsAndTech).toEqual(expect.arrayContaining(['ServiceNow', 'Windows', 'Zendesk', 'Microsoft 365']));
    expect(parsed.toolsAndTech).not.toEqual(expect.arrayContaining(['Jira Service Management', 'Docker']));
  });

  it('nie wyciąga benefitów jako wymaganych/mile widzianych umiejętności', () => {
    const jd = `
      Specjalista ds. sprzedaży
      Firma: Nordic Ventures Sp. z o.o.
      Wymagania
      Minimum 2 lata doświadczenia. Prawo jazdy kat. B, obsługa klienta.
      Mile widziane
      Doświadczenie w sprzedaży B2B.
      Benefity
      Prywatna opieka medyczna, karta sportowa, dofinansowanie do okularów,
      owocowe czwartki, elastyczne godziny pracy, parking dla pracowników.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const benefit of ['opieka medyczna', 'karta sportowa', 'okularów', 'czwartki', 'parking', 'elastyczne godziny']) {
      expect(allSkills.some((s) => s.includes(benefit))).toBe(false);
    }
  });

  it('parser i kalkulator nie zamieniają zaprzeczonych benefitów w zapewnione', () => {
    const description = `
      Oferujemy prywatną opiekę medyczną LuxMed.
      Nie zapewniamy karty MultiSport ani budżetu szkoleniowego.
      Pracodawca nie zapewnia laptopa.
    `;
    const parsed = parseJobDescriptionLocal(description);
    const benefits = detectBenefits(benefitSourcesFromOffer({ description }, parsed));

    expect(parsed.benefits).toEqual(['Opieka medyczna / LuxMed / Medicover / PZU']);
    expect(benefitPackageValue(benefits)).toBe(180);
    expect(benefits.find((item) => item.key === 'SPORT')?.status).toBe('MISSING');
    expect(benefits.find((item) => item.key === 'TRAINING')?.status).toBe('MISSING');
    expect(benefits.find((item) => item.key === 'EQUIPMENT')?.status).toBe('MISSING');
  });

  it('nie wyciąga widełek płacowych ani waluty jako umiejętności', () => {
    const jd = `
      Analityk finansowy
      Firma: Capital Bridge S.A.
      Wymagania
      Minimum 3 lata doświadczenia. Excel, analiza finansowa.
      Widełki: 12 000 - 18 000 PLN brutto / miesiąc
      Mile widziane
      Znajomość MS Project.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const noise of ['12 000', '18 000', 'pln', 'brutto', 'miesiąc']) {
      expect(allSkills.some((s) => s.includes(noise))).toBe(false);
    }
  });

  it('nie wyciąga nazw miast/lokalizacji jako umiejętności', () => {
    const jd = `
      Koordynator logistyki
      Firma: Trans Południe Sp. z o.o.
      Warszawa / Kraków / Katowice
      Wymagania
      Minimum 2 lata doświadczenia. Prawo jazdy kat. B, MS Excel, WMS.
      Mile widziane
      Gotowość do delegacji do Wrocławia i Gdańska.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const city of ['warszawa', 'kraków', 'katowice', 'wrocław', 'gdańsk']) {
      expect(allSkills.some((s) => s.includes(city))).toBe(false);
    }
  });

  it('nie wyciąga ogólnych rzeczowników pospolitych ze zdań wymagań jako nazw własnych', () => {
    const jd = `
      Asystentka biura
      Firma: Green Office Sp. z o.o.
      Wymagania
      Minimum 1 rok doświadczenia. Dokładność, rzetelność, umiejętność pracy w zespole,
      dobra organizacja czasu pracy, znajomość obsługi biura.
      Mile widziane
      Znajomość języka niemieckiego na poziomie B1.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const noise of ['dokładność', 'rzetelność', 'organizacja czasu pracy', 'obsługi biura']) {
      expect(allSkills.some((s) => s.includes(noise))).toBe(false);
    }
  });

  it('nie wyciąga zdań opisu firmy jako umiejętności', () => {
    const jd = `
      Programista .NET
      Firma: Meadowlight Technologies Sp. z o.o.
      O firmie
      Jesteśmy dynamicznie rozwijającą się spółką technologiczną działającą
      na rynku od 2010 roku, dostarczającą innowacyjne rozwiązania dla klientów
      z sektora finansowego w całej Europie Środkowej.
      Wymagania
      Minimum 3 lata doświadczenia. C#, .NET, SQL Server.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const noise of ['dynamicznie', 'spółką', 'rynku', 'europie środkowej', 'sektora finansowego']) {
      expect(allSkills.some((s) => s.includes(noise))).toBe(false);
    }
  });

  it('nie wyciąga szumu interfejsu portalu ogłoszeniowego jako umiejętności', () => {
    const jd = `
      Portal ogłoszeń
      Aplikuj teraz
      Sprawdź dopasowanie
      Ważna jeszcze 12 dni
      Asystent portalu
      Podsumowanie oferty
      Specjalista ds. obsługi klienta
      Firma: Portal House Sp. z o.o.
      Wymagania
      Minimum 1 rok doświadczenia. Obsługa klienta, komunikatywność.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.requiredSoftSkills, ...parsed.toolsAndTech,
      ...(parsed.niceToHaveHardSkills ?? []), ...(parsed.niceToHaveSoftSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    for (const noise of ['aplikuj teraz', 'sprawdź dopasowanie', 'ważna jeszcze', 'asystent portalu', 'podsumowanie oferty']) {
      expect(allSkills.some((s) => s.includes(noise))).toBe(false);
    }
  });

  it('nie duplikuje złożonego terminu CI/CD jako dwóch osobnych trafień "CI" i "CD"', () => {
    const jd = `
      DevOps Engineer
      Firma: Cloud Harbor Inc.
      Requirements
      Minimum 5 years experience. Linux, Docker, Kubernetes, Terraform, AWS and CI/CD.
      Nice to have
      Azure, Python, Grafana.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.toolsAndTech, ...(parsed.niceToHaveHardSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    expect(allSkills).toContain('ci/cd');
    expect(allSkills).not.toContain('ci');
    expect(allSkills).not.toContain('cd');
  });

  it('rozpoznaje synonimy/warianty zapisu bez fałszywych dodatkowych trafień (SQL, ASP.NET, Power BI)', () => {
    const jd = `
      Analityk danych
      Firma: Data Meadow S.A.
      Wymagania
      Minimum 2 lata doświadczenia. SQL, Power BI, Excel.
      Mile widziane
      Tableau, Python.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const requiredLower = parsed.requiredHardSkills.map((s) => s.toLocaleLowerCase('pl-PL'));
    const toolsLower = parsed.toolsAndTech.map((s) => s.toLocaleLowerCase('pl-PL'));
    expect(requiredLower).toContain('sql');
    expect(toolsLower.some((s) => s.includes('power bi'))).toBe(true);
    expect(toolsLower.some((s) => s.includes('excel'))).toBe(true);
    expect(parsed.requiredHardSkills.length + parsed.toolsAndTech.length).toBeLessThanOrEqual(5);
  });

  it('rozpoznaje złożone terminy spoza IT (wózki widłowe, pełna księgowość, system hotelowy) bez rozbicia na fałszywe fragmenty', () => {
    const jd = `
      Magazynier
      Firma: LogiPark Polska
      Wymagania
      Minimum 1 rok doświadczenia. Obsługa wózków widłowych, znajomość systemu magazynowego.
      Mile widziane
      Uprawnienia UDT.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.toolsAndTech, ...(parsed.niceToHaveHardSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    expect(allSkills.some((s) => s.includes('wózk'))).toBe(true);
    expect(allSkills.some((s) => s.includes('system magazynow'))).toBe(true);
  });

  it('nie tworzy fałszywych umiejętności z samych liczb lat doświadczenia ani formalnych progów', () => {
    const jd = `
      Kucharz
      Firma: Bistro Rzeka
      Wymagania
      Minimum 3 lata doświadczenia. Kuchnia polska, organizacja pracy w kuchni.
      Mile widziane
      Sanepid, książeczka zdrowia.
    `;
    const parsed = parseJobDescriptionLocal(jd);
    const allSkills = [
      ...parsed.requiredHardSkills, ...parsed.toolsAndTech, ...(parsed.niceToHaveHardSkills ?? []),
    ].map((s) => s.toLocaleLowerCase('pl-PL'));
    expect(allSkills.some((s) => /^3$|3 lata|^lata$/.test(s))).toBe(false);
    expect(allSkills.some((s) => s.includes('kuchnia polska'))).toBe(true);
  });

  it('wyciąga angielskie lata doświadczenia z wymagań, ale nie ze stażu firmy', () => {
    const candidateRequirement = parseJobDescriptionLocal(`
      Backend Developer
      O firmie
      We have 25 years of experience delivering software.
      Requirements
      3 years of professional experience with Python and SQL.
    `);
    const companyHistoryOnly = parseJobDescriptionLocal(`
      Backend Developer
      O firmie
      Our company has 25 years of experience delivering software.
      Requirements
      Python and SQL.
    `);

    expect(candidateRequirement.experienceMinYears).toBe(3);
    expect(candidateRequirement.formalRequirements).toContainEqual(expect.objectContaining({
      id: 'experience_years',
      label: 'Min. 3 lata doświadczenia (with Python and SQL)',
      required: true,
    }));
    expect(companyHistoryOnly.experienceMinYears).toBeNull();
    expect(companyHistoryOnly.formalRequirements?.some((requirement) => requirement.id === 'experience_years')).toBe(false);
  });

  it('obsługuje „minimum of” i zapis z apostrofem w angielskim progu stażu', () => {
    const minimumOf = parseJobDescriptionLocal(`
      Data Analyst
      Requirements
      Minimum of 2 years of experience with SQL.
    `);
    const apostrophe = parseJobDescriptionLocal(`
      Data Analyst
      Requirements
      4+ years' relevant experience with SQL.
    `);

    expect(minimumOf.experienceMinYears).toBe(2);
    expect(apostrophe.experienceMinYears).toBe(4);
  });

  it('nie podnosi wymagań zanegowanych po nazwie kryterium do obowiązkowych', () => {
    const parsed = parseJobDescriptionLocal(`
      Specjalista terenowy
      Wymagania
      Prawo jazdy kat. B nie jest wymagane. Angielski nie jest wymagany.
    `);

    expect(parsed.formalRequirements?.some((requirement) => requirement.id === 'license_b' && requirement.required)).toBe(false);
    expect(parsed.formalRequirements?.some((requirement) => requirement.id === 'language_english' && requirement.required)).toBe(false);
    expect(parsed.structuredLanguages?.find((language) => /angielski|english/i.test(language.language))?.required).toBe(false);
    expect(parsed.requiredHardSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'))).not.toContain('angielski');
    expect(parsed.toolsAndTech.map((skill) => skill.toLocaleLowerCase('pl-PL'))).not.toContain('prawo jazdy kat. b');
  });

  it('rozpoznaje angielskie zaprzeczenia „no requirement”, „not necessary” i „not needed”', () => {
    const parsed = parseJobDescriptionLocal(`
      Data Analyst
      Requirements
      No requirement for PowerShell.
      AWS is not necessary.
      JavaScript is not needed.
      ServiceNow is required.
    `);
    const extracted = [...parsed.requiredHardSkills, ...parsed.toolsAndTech].map((term) => term.toLowerCase());

    expect(extracted).not.toEqual(expect.arrayContaining(['powershell', 'aws', 'javascript']));
    expect(extracted).toContain('servicenow');
  });

  it('nie awansuje angielskiego atutu „is a plus” do wymagania z sekcji Requirements', () => {
    const parsed = parseJobDescriptionLocal(`
      IT Support Specialist
      Requirements
      No requirement for PowerShell.
      AWS is not necessary.
      JavaScript is a plus.
      ServiceNow is required.
    `);
    const required = [...parsed.requiredHardSkills, ...parsed.requiredSoftSkills]
      .map((term) => term.toLocaleLowerCase('pl-PL'));

    expect(required).not.toContain('powershell');
    expect(required).not.toContain('aws');
    expect(required).not.toContain('javascript');
    expect(parsed.niceToHaveHardSkills?.map((term) => term.toLocaleLowerCase('pl-PL'))).toContain('javascript');
    expect(parsed.toolsAndTech.map((term) => term.toLocaleLowerCase('pl-PL'))).toContain('servicenow');
  });

  it('zachowuje osobne, pozytywne wymaganie mimo wcześniejszego zaprzeczenia tej samej kwalifikacji', () => {
    const parsed = parseJobDescriptionLocal(`
      Specjalista terenowy
      Wymagania
      Prawo jazdy kat. B nie jest wymagane.
      Do prowadzenia samochodu serwisowego wymagane prawo jazdy kat. B.
    `);

    expect(parsed.formalRequirements?.some((requirement) => requirement.id === 'license_b' && requirement.required)).toBe(true);
  });

  it('nie wyciąga minimalnego stażu z liczby lat wyraźnie opisanej jako niewymagana', () => {
    const parsed = parseJobDescriptionLocal(`
      Data Analyst
      Requirements
      Minimum 3 years of experience is not required.
    `);

    expect(parsed.experienceMinYears).toBeNull();
    expect(parsed.formalRequirements?.some((requirement) => requirement.id === 'experience_years')).toBe(false);
  });

  it.each([
    ['Requirements\nMinimum 5 years of experience is not required.\nRequired: at least 3 years of experience.', 3],
    ['Requirements\nMinimum 5 years of experience would be a plus.\nRequired: at least 3 years of experience.', 3],
    ['Wymagania\nMinimum 2 lata gwarancji producenta na sprzęt.\nMinimum 5 lat doświadczenia zawodowego.', 5],
    ['Requirements\nMinimum 18 years old.', null],
  ])('wiąże próg lat z obowiązkowym doświadczeniem w %s', (jd, years) => {
    const parsed = parseJobDescriptionLocal(jd);
    expect(parsed.experienceMinYears).toBe(years);
  });

  it('zachowuje próg z przymiotnikami z istniejącego korpusu ofert', () => {
    const parsed = parseJobDescriptionLocal('Nasze wymagania\nminimum 5 lat samodzielnego doświadczenia komercyjnego w programowaniu.');
    expect(parsed.experienceMinYears).toBe(5);
    expect(parsed.experienceRequirements?.[0].scopeText).toBe('komercyjnego w programowaniu');
  });

  it('zachowuje wszystkie progi wraz z właściwym źródłem zamiast pierwszej liczby lat', () => {
    const parsed = parseJobDescriptionLocal('Wymagania\nMinimum 2 lata gwarancji sprzętu.\nMinimum 3 lata doświadczenia zawodowego.\nMinimum 5 lat doświadczenia w montażu instalacji.');
    expect(parsed.experienceMinYears).toBe(5);
    expect(parsed.experienceRequirements).toEqual([
      { years: 3, sourceText: 'Minimum 3 lata doświadczenia zawodowego', scopeText: null },
      { years: 5, sourceText: 'Minimum 5 lat doświadczenia w montażu instalacji', scopeText: 'w montażu instalacji' },
    ]);
    expect(parsed.formalRequirements?.filter(({ id }) => id.startsWith('experience_years')).map(({ sourceText }) => sourceText))
      .toEqual(parsed.experienceRequirements?.map(({ sourceText }) => sourceText));
  });

  it.each([
    ['Minimum 1 rok doświadczenia zawodowego.\nPython i SQL.', null],
    ['At least 5 years of professional experience. Python and SQL.', null],
    ['At least 5 years of relevant experience.', 'At least 5 years of relevant experience'],
    ['Minimum 5 lat doświadczenia z .NET.', 'z .NET'],
  ])('rozróżnia zakres doświadczenia bez przenoszenia osobnej umiejętności: %s', (requirement, scopeText) => {
    const parsed = parseJobDescriptionLocal(`Requirements\n${requirement}`);
    expect(parsed.experienceRequirements?.[0].scopeText).toBe(scopeText);
  });

  it('wyciąga próg stażu, gdy nagłówek wymagań i treść są w tej samej linii', () => {
    const polish = parseJobDescriptionLocal('Specjalista\nWymagania: co najmniej 3 lata doświadczenia zawodowego. Python.\nMile widziane: AWS.');
    const english = parseJobDescriptionLocal('Support Engineer\nRequirements: At least 4 years of professional experience. SQL.');

    expect(polish.experienceMinYears).toBe(3);
    expect(english.experienceMinYears).toBe(4);
    expect(polish.requiredHardSkills.map((skill) => skill.toLowerCase())).toContain('python');
    expect(polish.niceToHaveHardSkills?.map((skill) => skill.toLowerCase())).toContain('aws');
    expect(english.requiredHardSkills.map((skill) => skill.toLowerCase())).toContain('sql');
  });

  it.each([
    ['Minimum 2,5 lata doświadczenia zawodowego.', 2.5],
    ['At least 1.5 years of experience.', 1.5],
    ['Minimum 0,5 roku doświadczenia zawodowego.', 0.5],
    ['3–5 years of experience.', 3],
    ['Minimum 3-5 lat doświadczenia zawodowego.', 3],
    ['Minimum 3 do 5 lat doświadczenia zawodowego.', 3],
    ['3 to 5 years of experience.', 3],
    ['5–3 years of experience.', null],
    ['Minimum -5 lat doświadczenia zawodowego.', null],
    ['Minimum 1.5 years of experience is not required.', null],
    ['Minimum 1.5 years of experience would be a plus.', null],
  ])('nie wycina końcówki liczby ani górnej granicy przed doświadczeniem: %s', (requirement, years) => {
    const parsed = parseJobDescriptionLocal(`Requirements\n${requirement}`);
    expect(parsed.experienceMinYears).toBe(years);
  });

  it.each([
    ['At least 5 years of Python development experience.', 'Python development'],
    ['At least 5 years of .NET development experience.', '.NET development'],
    ['Minimum 5 lat spawalniczego doświadczenia.', 'spawalniczego'],
    ['Minimum 5 lat pracy jako spawacz.', 'jako spawacz'],
    ['Minimum 5 lat doświadczenia jest wymagane w montażu instalacji.', 'w montażu instalacji'],
    ['Minimum 5 lat doświadczenia z .NET is not required.', null],
  ])('zachowuje zakres także przed nazwą doświadczenia lub po znaczniku wymagania: %s', (requirement, scopeText) => {
    const parsed = parseJobDescriptionLocal(`Requirements\n${requirement}`);
    if (scopeText === null) expect(parsed.experienceRequirements).toEqual([]);
    else {
      expect(parsed.experienceMinYears).toBe(5);
      expect(parsed.experienceRequirements?.[0].scopeText).toBe(scopeText);
    }
  });

  it('rozpoznaje angielskie nagłówki Required Qualifications i Preferred Qualifications', () => {
    const parsed = parseJobDescriptionLocal(`
      Platform Engineer
      Required Qualifications
      At least 3 years of experience. Python and SQL.
      Preferred Qualifications
      Azure certification and Kubernetes.
    `);

    expect(parsed.experienceMinYears).toBe(3);
    expect(parsed.requiredHardSkills.map((skill) => skill.toLowerCase())).toEqual(expect.arrayContaining(['python', 'sql']));
    expect(parsed.niceToHaveHardSkills?.map((skill) => skill.toLowerCase())).toEqual(expect.arrayContaining(['azure', 'kubernetes']));
  });

  it.each([
    ['Doświadczenie zawodowe: minimum 3 lata.', 3, null],
    ['Doświadczenie zawodowe minimum 2,5 roku.', 2.5, null],
    ['Staż zawodowy: minimum 3–5 lat.', 3, null],
    ['Professional experience: at least 3 years.', 3, null],
    ['Python experience: at least 5 years.', 5, 'Python'],
    ['Doświadczenie w montażu instalacji: minimum 5 lat.', 5, 'w montażu instalacji'],
    ['Experience with .NET: at least 5 years.', 5, 'with .NET'],
    ['Doświadczenie magazynowe: minimum 5 lat.', 5, 'magazynowe'],
    ['Doświadczenie spawalnicze: minimum 5 lat.', 5, 'spawalnicze'],
    ['Doświadczenie montażowe wymagane: minimum 5 lat.', 5, 'montażowe'],
    ['Experience required: at least 3 years.', 3, null],
    ['Professional experience is required: at least 3 years.', 3, null],
    ['Experience: at least 5 years is not required.', null, null],
    ['Experience: at least 5 years would be a plus.', null, null],
    ['Experience: min. 5 years is not required.', null, null],
    ['Experience: min. 5 years would be a plus.', null, null],
    ['Experience with equipment requiring minimum 2 years warranty.', null, null],
  ])('rozpoznaje staż po nazwie doświadczenia i zachowuje jego zakres: %s', (requirement, years, scopeText) => {
    const parsed = parseJobDescriptionLocal(`Requirements\n${requirement}`);
    expect(parsed.experienceMinYears).toBe(years);
    if (years !== null) {
      expect(parsed.experienceRequirements?.[0].scopeText).toBe(scopeText);
      expect(parsed.experienceRequirements?.[0].sourceText).toBe(requirement.replace(/\.$/u, ''));
    }
    else expect(parsed.experienceRequirements).toEqual([]);
  });

  it('nie dubluje wymogu, gdy liczba przed doświadczeniem jest już rozpoznana', () => {
    const parsed = parseJobDescriptionLocal('Wymagania\nMinimum 3 lata doświadczenia zawodowego.\nDoświadczenie zawodowe: minimum 5 lat.');
    expect(parsed.experienceRequirements?.map(({ years }) => years)).toEqual([3, 5]);
    expect(parsed.experienceMinYears).toBe(5);
  });

  it.each([
    ['Maksymalnie 5 lat doświadczenia zawodowego.', 'at_most', null],
    ['Doświadczenie zawodowe: maksymalnie 5 lat.', 'at_most', null],
    ['Up to 5 years of experience.', 'at_most', null],
    ['Experience: at most 5 years.', 'at_most', null],
    ['No more than 5 years of experience.', 'at_most', null],
    ['Mniej niż 5 lat doświadczenia zawodowego.', 'less_than', null],
    ['Experience: less than 5 years.', 'less_than', null],
    ['Ponad 5 lat doświadczenia zawodowego.', 'more_than', 5],
    ['Experience: more than 5 years.', 'more_than', 5],
    ['>= 5 years of experience.', 'at_least', 5],
    ['<= 5 years of experience.', 'at_most', null],
    ['Experience: < 5 years.', 'less_than', null],
    ['Experience: > 5 years.', 'more_than', 5],
    ['Nie więcej niż 5 lat doświadczenia zawodowego.', 'at_most', null],
    ['Experience: no more than 5 years.', 'at_most', null],
    ['Do 5 lat doświadczenia zawodowego.', 'at_most', null],
    ['Experience: max. 5 years.', 'at_most', null],
    ['Staż zawodowy: maks. 5 lat.', 'at_most', null],
    ['Nie mniej niż 5 lat doświadczenia zawodowego.', 'at_least', 5],
    ['Experience: no less than 5 years.', 'at_least', 5],
    ['Experience: ≤ 5 years.', 'at_most', null],
    ['Experience: ≥ 5 years.', 'at_least', 5],
    ['Experience: 5 years maximum.', 'at_most', null],
    ['5 years of experience at most.', 'at_most', null],
    ['Doświadczenie zawodowe: 5 lat maksymalnie.', 'at_most', null],
    ['Experience: 5 years or less.', 'at_most', null],
    ['Experience: 5 years or more.', 'at_least', 5],
  ])('zachowuje kierunek porównania zamiast udawać minimum: %s', (requirement, comparison, minimum) => {
    const parsed = parseJobDescriptionLocal(`Requirements\n${requirement}`);
    expect(parsed.experienceRequirements).toHaveLength(1);
    expect(parsed.experienceRequirements?.[0].years).toBe(5);
    expect(parsed.experienceRequirements?.[0].comparison ?? 'at_least').toBe(comparison);
    expect(parsed.experienceRequirements?.[0].scopeText).toBeNull();
    expect(parsed.experienceMinYears).toBe(minimum);
  });

  it('skrót max. nie ukrywa zanegowanego górnego progu', () => {
    const parsed = parseJobDescriptionLocal('Requirements\nMax. 5 years of experience is not required.');
    expect(parsed.experienceRequirements).toEqual([]);
  });

  it.each(['Max. 5 years of experience would be a plus.', 'Experience: max. 5 years is not required.', 'Staż zawodowy: maks. 5 lat nie jest wymagany.'])('odrzuca opcjonalny lub zanegowany limit: %s', (requirement) => {
    expect(parseJobDescriptionLocal(`Requirements\n${requirement}`).experienceRequirements).toEqual([]);
  });

  it('informacja o maksimum w następnym zdaniu nie zmienia progu stażu', () => {
    const parsed = parseJobDescriptionLocal('Requirements\nMinimum 3 years of experience. Maximum 5 years warranty on equipment.');
    expect(parsed.experienceRequirements).toHaveLength(1);
    expect(parsed.experienceRequirements?.[0].years).toBe(3);
    expect(parsed.experienceRequirements?.[0].comparison).toBeUndefined();
  });

  it('nie przenosi liczby z następnego zdania na poprzednią wzmiankę o doświadczeniu', () => {
    const parsed = parseJobDescriptionLocal('Requirements\nExperience with customer service.\nMinimum 18 years old.');
    expect(parsed.experienceRequirements).toEqual([]);
  });

  it('zachowuje atuty z każdego nagłówka opcjonalnego rozpoznawanego przez wspólny klasyfikator', () => {
    const parsed = parseJobDescriptionLocal(`
      Support Engineer
      Requirements
      ServiceNow.
      Desirable
      PowerShell.
      Bonus points
      Docker.
      Dodatkowe atuty
      Azure.
      Responsibilities
      Jira ticket handling.
    `);

    expect(parsed.sourceSections?.required.join(' ').toLowerCase()).toContain('servicenow');
    const niceSource = parsed.sourceSections?.niceToHave.join(' ').toLowerCase() || '';
    expect(niceSource).toContain('powershell');
    expect(niceSource).toContain('docker');
    expect(niceSource).toContain('azure');
    expect(niceSource).not.toContain('jira');
  });

  it('nie zgaduje poziomu stanowiska z zawodu ani z obowiązków', () => {
    const unspecified = parseJobDescriptionLocal(`
      Magazynier - operator wózka widłowego
      Wymagania
      Uprawnienia UDT.
      Zakres obowiązków
      Współpraca z senior zespołem logistyki.
    `);
    const explicitTitle = parseJobDescriptionLocal('Senior Embedded Developer\nRequirements\nC++ and Linux.');
    const explicitHeader = parseJobDescriptionLocal('Rejestrator medyczny\nentry\nWymagania\nObsługa pacjenta.');

    expect(unspecified.seniorityLevel).toBe('UNKNOWN');
    expect(explicitTitle.seniorityLevel).toBe('SENIOR');
    expect(explicitHeader.seniorityLevel).toBe('ENTRY');
  });

  it('rozdziela alternatywne formy umowy zamiast zapisywać cały wiersz jako jeden typ', () => {
    const parsed = parseJobDescriptionLocal(`
      Frontend Developer
      Requirements
      React and TypeScript.
      Desirable
      PowerShell.
      Forma zatrudnienia
      Umowa o pracę lub kontrakt B2B.
      Responsibilities
      Jira administration.
    `);

    expect(parsed.contractTypes).toEqual(['umowa o pracę', 'kontrakt B2B']);
    expect(parsed.sourceSections?.niceToHave).toEqual(expect.arrayContaining(['PowerShell.']));
    expect(parsed.sourceSections?.niceToHave.join(' ')).not.toContain('Umowa o pracę');
    expect(parsed.sourceSections?.niceToHave.join(' ')).not.toContain('Jira');
  });

  it('does not infer onsite work when the offer does not specify a work model', () => {
    const parsed = parseJobDescriptionLocal(`
      Support Engineer
      Requirements
      Linux and ticketing system experience.
    `);

    expect(parsed.workModel).toBe('UNKNOWN');
  });

  it('does not turn a remote-work negation into a remote or onsite assertion', () => {
    const parsed = parseJobDescriptionLocal(`
      Support Engineer
      Tryb pracy: praca zdalna nie jest dostępna.
      Requirements
      Linux.
    `);

    expect(parsed.workModel).toBe('UNKNOWN');
  });

  it('does not treat remote-access skills as a remote work model', () => {
    const parsed = parseJobDescriptionLocal(`
      Support Engineer
      Requirements
      Remote Desktop, VPN, and remote server administration.
    `);

    expect(parsed.workModel).toBe('UNKNOWN');
  });

  it('preserves explicit remote, hybrid and onsite work models', () => {
    expect(parseJobDescriptionLocal('Support Engineer\nPraca zdalna.').workModel).toBe('REMOTE');
    expect(parseJobDescriptionLocal('Support Engineer\nPraca hybrydowa.').workModel).toBe('HYBRID');
    expect(parseJobDescriptionLocal('Support Engineer\nPraca stacjonarna.').workModel).toBe('ON_SITE');
  });

  it('recognizes standalone work-mode lines without inferring from location text', () => {
    expect(parseJobDescriptionLocal('Backend Engineer\nremote\nRequirements\nKotlin.').workModel).toBe('REMOTE');
    expect(parseJobDescriptionLocal('Księgowa\nWarszawa\nstacjonarnie\nWymagania\nExcel.').workModel).toBe('ON_SITE');
    expect(parseJobDescriptionLocal('DevOps Engineer\nRemote, Poland\nRequirements\nLinux.').workModel).toBe('UNKNOWN');
  });

  it('recognizes both valid Polish forms of umowa zlecenie', () => {
    expect(parseJobDescriptionLocal('Kucharz\nUmowa zlecenie').contractTypes).toContain('umowa zlecenie');
    expect(parseJobDescriptionLocal('Kucharz\nUmowa zlecenia').contractTypes).toContain('umowa zlecenie');
  });
});
