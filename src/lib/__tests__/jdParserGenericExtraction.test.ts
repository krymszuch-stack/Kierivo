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
      label: 'Min. 3 lata doświadczenia',
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

  it('wyciąga próg stażu, gdy nagłówek wymagań i treść są w tej samej linii', () => {
    const polish = parseJobDescriptionLocal('Specjalista\nWymagania: co najmniej 3 lata doświadczenia zawodowego. Python.\nMile widziane: AWS.');
    const english = parseJobDescriptionLocal('Support Engineer\nRequirements: At least 4 years of professional experience. SQL.');

    expect(polish.experienceMinYears).toBe(3);
    expect(english.experienceMinYears).toBe(4);
    expect(polish.requiredHardSkills.map((skill) => skill.toLowerCase())).toContain('python');
    expect(polish.niceToHaveHardSkills?.map((skill) => skill.toLowerCase())).toContain('aws');
    expect(english.requiredHardSkills.map((skill) => skill.toLowerCase())).toContain('sql');
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
});
