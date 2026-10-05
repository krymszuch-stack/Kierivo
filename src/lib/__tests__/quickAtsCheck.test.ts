import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { runQuickAtsCheck, extractTopThreeProblems, QuickCheckError, MIN_CV_CHARS } from '../quickAtsCheck';
import { calculateJobMatch } from '../jobMatcherEngine';
import { mapJdKeywords } from '../jdKeywordMapper';
import type { JobOffer } from '../../types';

// Równoważność dwóch ścieżek porównujemy przy tym samym czasie obliczenia.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

const CV = `
Anna Kowalska
Email: anna.kowalska@example.pl
Tel: +48 600 700 800
Stanowisko: Backend Developer

Podsumowanie: Programistka backendu z pięcioletnim doświadczeniem w budowie usług sieciowych.

Umiejętności: Python, Django, PostgreSQL, Git, Docker

Doświadczenie zawodowe:
Acme Sp. z o.o. - Backend Developer, 2020 - 2025
Projektowanie i utrzymanie usług REST w Pythonie oraz optymalizacja zapytań do bazy PostgreSQL.

Wykształcenie:
Politechnika Warszawska - Inżynier - Informatyka, 2015 - 2019
`;

const JD = `
Poszukujemy Senior Backend Developera.

Wymagania:
- Bardzo dobra znajomość Pythona i frameworka Django
- Doświadczenie z bazami PostgreSQL
- Znajomość Kubernetes i Terraform
- Doświadczenie z AWS
- Umiejętność pracy zespołowej i komunikatywność

Oferujemy pracę zdalną i pakiet medyczny.
`;

describe('Szybkie sprawdzenie CV pod ofertę', () => {
  it('nie pokazuje zera ani nie obwinia pustego CV, gdy parser nie wydobył treści z wklejonego dokumentu', () => {
    const rawCv = 'SYNTHETIC TEST PROFILE\nIT Support Technician\nDoświadczenie: rozwiązywanie zgłoszeń, obsługa Microsoft 365, diagnoza Windows 11 i eskalacje do II linii.';
    const jd = 'We are looking for a colleague to join our friendly company team. This is an office-based role with onboarding and support. Apply now and talk to us.';
    const result = runQuickAtsCheck(rawCv, jd);

    expect(result.canonicalResult.state).toBe('INSUFFICIENT_CV');
    expect(result.canonicalResult.score).toBeNull();
    expect(result.canonicalResult.reason).toContain('sprawdź odczyt CV');
  });

  it('odrzuca zbyt długie CV przed liczeniem wyniku i wskazuje pole CV', () => {
    const longCv = `${CV}${' dodatkowy opis'.repeat(14_000)}`;

    try {
      runQuickAtsCheck(longCv, JD);
      throw new Error('Oczekiwano QuickCheckError dla CV przekraczającego limit.');
    } catch (error) {
      expect(error).toBeInstanceOf(QuickCheckError);
      expect(error).toMatchObject({ field: 'cv' });
      expect((error as Error).message).toMatch(/przekracza limit 200.?000 znaków/i);
    }
  });

  it('szybki start nie zgłasza alternatywnej Jiry i wykrywa triage z obowiązków', () => {
    const cv = `MAJA NOWAK\nIT Support Specialist\nPodsumowanie\nWsparcie użytkowników w środowisku Microsoft 365. Diagnozowanie problemów, obsługa zgłoszeń i komunikacja z użytkownikami.\nDoświadczenie\nIT Support Specialist — Example Helpdesk, Warszawa | 2022–2025\n• Obsługa 25–30 zgłoszeń dziennie w ServiceNow; kategoryzowanie, ustalanie priorytetu i przekazywanie incydentów do zespołów L2.\n• Pilnowanie terminów SLA oraz informowanie użytkowników o postępie rozwiązania.\n• Resetowanie haseł, konfiguracja kont i skrzynek w Microsoft 365 / Exchange Online.\n• Dokumentowanie rozwiązań w bazie wiedzy i wdrażanie nowych użytkowników.\nUmiejętności\nServiceNow, Microsoft 365, Exchange Online, Active Directory, Windows 10/11, diagnostyka, obsługa klienta.`;
    const jd = `Support Engineer — Example Support Ltd\nRequired\n• Experience with ticketing systems such as ServiceNow or Jira Service Management.\n• Incident triage, prioritization and escalation to L2.\n• Customer-facing technical support.\n• Microsoft Exchange Online administration.\n• PowerShell scripting experience.\nPreferred\n• Microsoft Intune device management.`;
    const result = runQuickAtsCheck(cv, jd);

    expect(result.canonicalResult.missingRequirements).not.toContain('jira');
    expect(result.canonicalResult.matchedRequirements).toContain('incident triage');
    expect(result.canonicalResult.matchedRequirements).toContain('customer-facing support');
    expect(result.canonicalResult.missingRequirements).toContain('powershell');
    expect(result.missingSkills).not.toContain('jira');

    // Regresja caĹ‚ej Ĺ›cieĹĽki: parser CV, szybki wynik, matcher szczegĂłĹ‚owy i rachunek dowodĂłw
    // muszÄ… zachowaÄ‡ to samo rozumienie jawnie opisanych obowiÄ…zkĂłw.
    const offer: JobOffer = {
      id: 'synthetic-support-evidence',
      title: 'Support Engineer',
      company: 'Example Support Ltd',
      salary: '',
      location: '',
      description: jd,
      requirements: [],
      remote: false,
      portal: 'synthetic-test',
      techStack: [],
    };
    const detailed = calculateJobMatch(result.vault, offer);
    expect(detailed.canonicalResult).toEqual(result.canonicalResult);

    const evidence = mapJdKeywords(jd, result.vault, detailed.tailoredResume);
    const findKeyword = (term: string) => evidence.keywords.find((item) => item.term.toLowerCase() === term.toLowerCase());
    expect(findKeyword('incident triage')?.status).toBe('MATCHED_IN_CV');
    expect(findKeyword('customer-facing support')?.status).toBe('MATCHED_IN_CV');
    expect(findKeyword('powershell')?.status).toBe('MISSING_IN_VAULT');
    expect(findKeyword('incident triage')?.foundInCvEvidence?.join(' ')).toMatch(/kategoryz|priorytet|incydent/i);
  });

  it('zwraca wynik liczbowy w sensownym zakresie', () => {
    const { ats } = runQuickAtsCheck(CV, JD);

    expect(ats.overallScore).toBeGreaterThan(0);
    expect(ats.overallScore).toBeLessThanOrEqual(100);
  });

  it('wskazuje konkretne braki, a nie samą liczbę', () => {
    // To jest wartość, którą użytkownik pokazuje dalej znajomym: nie „62%",
    // tylko „brakuje Kubernetes i Terraform".
    const { missingSkills } = runQuickAtsCheck(CV, JD);

    expect(missingSkills.length).toBeGreaterThan(0);
    const joined = missingSkills.join(' ').toLowerCase();
    expect(joined).toMatch(/kubernetes|terraform|aws/);
  });

  it('nie zgłasza odmienionej nazwy stanowiska jako brakującej umiejętności', () => {
    const jd = `Poszukujemy specjalisty wsparcia IT do naszego zespołu.
Wymagania: znajomość Windows 11, Microsoft 365, Exchange Online, TCP/IP i obsługa klienta.
Oferujemy stabilne zatrudnienie i pakiet benefitów.`;
    const result = runQuickAtsCheck(CV, jd);

    expect(result.canonicalResult.missingRequirements.map((item) => item.toLowerCase()))
      .not.toContain('specjalisty');
    expect(result.missingSkills.map((item) => item.toLowerCase()))
      .not.toContain('specjalisty');
    expect(result.missingSkills.map((item) => item.toLowerCase()))
      .toEqual(expect.arrayContaining(['exchange online']));
    expect(result.missingSkills.map((item) => item.toLowerCase()))
      .toEqual(expect.arrayContaining(['windows 11', 'microsoft 365', 'tcp/ip']));
    expect(result.canonicalResult.components.skills).toBeLessThan(100);
  });

  it('nie traktuje słowa Required z nagłówka oferty jako wymaganej umiejętności', () => {
    const jd = `Helpdesk Analyst
Required qualifications
Microsoft Exchange Online administration is required for daily mailbox support.
ServiceNow ticket management is required.`;
    const result = runQuickAtsCheck(CV, jd);

    expect(result.missingSkills.map((item) => item.toLowerCase())).not.toContain('required');
    expect(result.missingSkills.map((item) => item.toLowerCase())).toContain('exchange online');
    expect(result.canonicalResult.missingRequirements.map((item) => item.toLowerCase())).not.toContain('required');
  });

  it('NIE zgłasza jako brakującej umiejętności, którą CV wprost zawiera', () => {
    // Regresja: nagłówek sekcji stojący w tej samej linii co treść
    // („Umiejętności: Python, Django, …") nie pasował do żadnego wzorca sekcji,
    // więc lista umiejętności zostawała pusta, a jedynym źródłem była zaszyta
    // lista kilkunastu słów kluczowych. CV z Django dostawało informację,
    // że brakuje mu Django — czyli dokładnie to, co niszczy zaufanie do wyniku.
    const { missingSkills, vault } = runQuickAtsCheck(CV, JD);

    expect(vault.skillsMatrix.hardSkills).toContain('Django');
    expect(missingSkills.map((s) => s.toLowerCase())).not.toContain('django');
    expect(missingSkills.map((s) => s.toLowerCase())).not.toContain('python');
  });

  it('nie pokazuje fragmentów zdań jako brakujących umiejętności', () => {
    // Frazy z ogłoszenia bywają resztkami zdań („senior backend developera.").
    // Jedna taka pozycja na liście podważa cały wynik.
    const { missingSkills } = runQuickAtsCheck(CV, JD);

    for (const skill of missingSkills) {
      expect(skill).not.toMatch(/[.!?;:]$/);
      expect(skill.split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(skill.length).toBeLessThanOrEqual(32);
    }
  });

  it('odczytuje profil z CV bez dopisywania czegokolwiek', () => {
    const { vault, parsed } = runQuickAtsCheck(CV, JD);

    expect(vault.personalInfo.fullName).toBe('Anna Kowalska');
    expect(vault.skillsMatrix.hardSkills).toContain('Python');
    expect(vault.history.length).toBeGreaterThan(0);
    expect(parsed.education[0].institution).toBe('Politechnika Warszawska');
  });

  it('daje ten sam wynik dla tej samej pary danych', () => {
    // Ocena musi być powtarzalna — użytkownik, który poprawi CV i uruchomi
    // ponownie, ma widzieć skutek swojej zmiany, a nie szum.
    expect(runQuickAtsCheck(CV, JD).ats.overallScore).toBe(runQuickAtsCheck(CV, JD).ats.overallScore);
  });

  it('pokazuje tę samą miarę kanoniczną co tryb zaawansowany dla CV/oferty', () => {
    const quick = runQuickAtsCheck(CV, JD);
    const offer: JobOffer = {
      id: 'synthetic-parity',
      title: '',
      company: '',
      salary: '',
      location: '',
      description: JD,
      requirements: [],
      remote: false,
      portal: 'synthetic-test',
      techStack: [],
    };
    const advanced = calculateJobMatch(quick.vault, offer);

    expect(quick.canonicalResult).toEqual(advanced.canonicalResult);
    expect(quick.canonicalResult.score).toBe(advanced.tailoredResume.atsScore);
  });

  it('lista braków szybkiego ekranu nie uznaje SAP z nazwy pracodawcy za umiejętność', () => {
    const cv = `
Alicja Testowa
alicia@example.test
Specjalistka wsparcia operacyjnego
Podsumowanie: Nie znam SAP ani AWS. Jestem w trakcie nauki Kubernetes.

Doświadczenie zawodowe:
SAP Polska - Specjalistka obsługi klienta, 2021 - 2025
Obsługa zgłoszeń, organizacja dokumentacji oraz kontakt z klientami.

Umiejętności: obsługa klienta, dokumentacja, komunikacja, organizacja pracy, w trakcie nauki Kubernetes.

Wykształcenie:
AWS Academy Kraków - Technik logistyk, 2017 - 2021
`;
    const jd = `Wymagania: znajomość SAP i AWS do obsługi systemu firmowego.
Doświadczenie we wsparciu użytkowników i sprawnej komunikacji z zespołem.`;
    const result = runQuickAtsCheck(cv, jd);

    expect(result.canonicalResult.missingRequirements).toContain('sap');
    expect(result.canonicalResult.missingRequirements).toContain('aws');
    expect(result.canonicalResult.components.skills).toBe(0);
    expect(result.vault.skillsMatrix.hardSkills).not.toContain('SAP');
    expect(result.vault.skillsMatrix.toolsAndTech).not.toContain('SAP');
    expect(result.vault.skillsMatrix.hardSkills).not.toContain('AWS');
    expect(result.vault.skillsMatrix.toolsAndTech).not.toContain('AWS');
    expect(result.vault.skillsMatrix.hardSkills).not.toContain('Kubernetes');
    expect(result.vault.skillsMatrix.toolsAndTech).not.toContain('Kubernetes');
    expect(result.vault.skillsMatrix.hardSkills.map((skill) => skill.toLowerCase())).not.toEqual(
      expect.arrayContaining(['i do not know sap or aws', 'currently learning kubernetes'])
    );
    expect(result.missingSkills.map((skill) => skill.toLowerCase())).toEqual(expect.arrayContaining(['sap', 'aws']));
    const problemText = extractTopThreeProblems(result).map((problem) => problem.title.toLowerCase()).join(' ');
    expect(problemText).toContain('sap');
    expect(problemText).toContain('aws');

    const cvWithExplicitEvidence = cv.replace(
      'Umiejętności: obsługa klienta, dokumentacja, komunikacja, organizacja pracy, w trakcie nauki Kubernetes.',
      'Umiejętności: SAP, AWS, obsługa klienta, dokumentacja, komunikacja, organizacja pracy.'
    );
    const matchedResult = runQuickAtsCheck(cvWithExplicitEvidence, jd);
    expect(matchedResult.canonicalResult.components.skills).toBe(100);
    expect(matchedResult.missingSkills.map((skill) => skill.toLowerCase())).not.toEqual(
      expect.arrayContaining(['sap', 'aws'])
    );
  });

  it('nie zamienia ogłoszenia bez wykrytych wymagań na wynik zero procent', () => {
    const result = runQuickAtsCheck(
      CV,
      'Szukamy osoby do miłego zespołu. Oferujemy owoce, kawę, spokojne miejsce pracy i przyjazną atmosferę dla całego zespołu.'
    );

    expect(result.canonicalResult.state).toBe('NO_REQUIREMENTS_DETECTED');
  });

  it('lepiej dopasowane CV dostaje wyższy wynik', () => {
    const better = `${CV}\nDodatkowe umiejętności: Kubernetes, Terraform, AWS`;

    expect(runQuickAtsCheck(better, JD).ats.overallScore!).toBeGreaterThanOrEqual(
      runQuickAtsCheck(CV, JD).ats.overallScore!
    );
  });

  it('odmawia liczenia na zbyt krótkim CV, zamiast zwracać wynik z niczego', () => {
    expect(() => runQuickAtsCheck('Jan Kowalski', JD)).toThrow(QuickCheckError);

    try {
      runQuickAtsCheck('Jan Kowalski', JD);
    } catch (err) {
      expect((err as QuickCheckError).field).toBe('cv');
    }
  });

  it('odmawia liczenia bez treści ogłoszenia', () => {
    try {
      runQuickAtsCheck(CV, 'Szukamy programisty');
      throw new Error('powinno rzucić');
    } catch (err) {
      expect((err as QuickCheckError).field).toBe('jd');
    }
  });

  it('próg długości CV jest faktycznie egzekwowany', () => {
    const justUnder = 'a '.repeat(Math.floor((MIN_CV_CHARS - 10) / 2));

    expect(() => runQuickAtsCheck(justUnder, JD)).toThrow(QuickCheckError);
  });

  it('nie wywraca się na CV bez sekcji wykształcenia i certyfikatów', () => {
    const minimal = `
      Piotr Mazur
      Stanowisko: Frontend Developer
      Umiejętności: React, TypeScript, CSS
      Doświadczenie zawodowe:
      Studio Web - Frontend Developer, 2021 - 2024
      Budowa interfejsów użytkownika w React i TypeScript dla klientów zagranicznych.
    `;

    const { ats, vault } = runQuickAtsCheck(minimal, JD);

    expect(ats.overallScore).toBeGreaterThanOrEqual(0);
    expect(vault.education).toEqual([]);
    expect(vault.skillsMatrix.certifications).toEqual([]);
  });
});

describe('Checklista wymagań formalnych', () => {
  const CV_MONTER = `Jan Kowalski
jan.kowalski@example.pl
+48 600 100 200
Kraków

Doświadczenie zawodowe
Serwis Gazowy Gromgaz, Monter instalacji gazowych, 01.2019 - Obecnie
Przeglądy okresowe kotłów gazowych, próby szczelności instalacji,
wymiana wymienników ciepła, obsługa analizatora spalin.

Umiejętności
Diagnostyka pieców gazowych, lutowanie, obsługa manometru.`;

  const JD_MONTER = `Poszukujemy serwisanta kotłów gazowych do obsługi klientów indywidualnych.
Wymagane uprawnienia SEP G3 oraz aktualny certyfikat F-Gaz.
Konieczne prawo jazdy kat. B. Wymagana dyspozycyjność do pracy w systemie zmianowym.
Mile widziane doświadczenie z markami Junkers i Vaillant.`;

  it('wypisuje uprawnienia, których stary audyt nie widział', () => {
    const result = runQuickAtsCheck(CV_MONTER, JD_MONTER);
    const ids = result.knockouts.blocking.map((finding) => finding.ruleId);

    // Dokładnie te trzy odsiewają montera, zanim ktokolwiek przeczyta jego CV.
    expect(ids).toContain('sep_g3');
    expect(ids).toContain('fgas');
    expect(ids).toContain('shift_work');
  });

  it('rozpoznaje specjalizację z treści ogłoszenia', () => {
    const result = runQuickAtsCheck(CV_MONTER, JD_MONTER);

    expect(result.detectedSubRole?.subRole.id).toBe('gas_heating_technician');
  });

  it('nie zgłasza wymagań technicznych przy ogłoszeniu biurowym', () => {
    const jdBiuro = `Specjalista ds. obsługi klienta. Wymagana komunikatywność,
      obsługa pakietu MS Office oraz doświadczenie w pracy z klientem.
      Oferujemy stabilne zatrudnienie i pracę w miłym zespole.`;

    const result = runQuickAtsCheck(CV_MONTER, jdBiuro);
    const ids = result.knockouts.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain('sep_g3');
    expect(ids).not.toContain('udt_forklift');
  });

  it('nie wykonuje żadnego żądania sieciowego', () => {
    // To jest obietnica z README i jedyny powód, dla którego ten ekran można
    // reklamować bez zbierania czyichkolwiek danych: CV nie opuszcza urządzenia.
    const originalFetch = globalThis.fetch;
    const calls: unknown[] = [];
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      throw new Error('Ścieżka darmowa nie może wołać sieci.');
    }) as typeof fetch;

    try {
      runQuickAtsCheck(CV_MONTER, JD_MONTER);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(0);
  });
});
