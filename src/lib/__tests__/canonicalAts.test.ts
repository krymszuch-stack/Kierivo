import { describe, it, expect } from 'vitest';
import { scoreCanonicalAts, recomputeCanonicalTotal, CANONICAL_WEIGHTS, getCanonicalScoreBand, CANONICAL_SCORE_BAND_LABELS, hasSufficientCvContent, hasCanonicalAtsScore } from '../canonicalAts';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../../types';
import { extractDynamicJdPhrases } from '../atsSimulator';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault } from '../../types';

/**
 * Kanoniczny wynik ATS: specyfikacja i własności (fazy 3, 6, 9, 11).
 */

function vaultWith(over: Partial<{
  title: string; summary: string; hard: string[]; tools: string[];
  history: MasterVault['history'];
}> = {}): MasterVault {
  const v = createEmptyVault('Jan Kowalski', 'jan@example.com');
  v.personalInfo.title = over.title ?? 'Developer';
  v.personalInfo.summary = over.summary ?? '';
  v.skillsMatrix.hardSkills = over.hard ?? [];
  v.skillsMatrix.toolsAndTech = over.tools ?? [];
  v.history = over.history ?? [];
  return v;
}

function hist(id: string, text: string, start = '2020-01', end = '2024-01') {
  return {
    id, company: 'X', role: 'Developer', location: '', startDate: start,
    endDate: end, isCurrent: false,
    highlights: [{ id: `h-${id}`, text, action: '', target: '', tool: '', metric: '', keywords: [] }],
  };
}

const JD = 'We need Python developer. Requirements: Python, AWS, Docker.';

describe('ekstrakcja wymagań z nagłówkiem oferty', () => {
  it('nie zamienia stanowiska i nazwy firmy w wymagane umiejętności', () => {
    const extraction = extractDynamicJdPhrases(`Specjalista IT Support
Testowa Firma

Wymagania:
Windows 11, Microsoft 365, Exchange Online, TCP/IP, obsługa klienta.

Mile widziane: Intune, Entra ID, PowerShell.`);
    const phrases = extraction.hardSkills.map(({ phrase }) => phrase);

    expect(phrases).not.toContain('testowa');
    expect(phrases).toEqual(expect.arrayContaining([
      'windows 11', 'microsoft 365', 'exchange online', 'tcp/ip', 'obsługa klienta',
    ]));
    expect(phrases).not.toEqual(expect.arrayContaining(['intune', 'entra id', 'powershell']));
  });

  it('używa wspólnej taksonomii w kanonicznym wyniku i nie myli jej z tytułem roli', () => {
    const jd = [
      'Stanowisko: IT Support Technician',
      'Wymagania:',
      '- Zendesk',
    ].join('\n');
    const candidate = vaultWith({
      summary: 'IT support professional with customer service and troubleshooting experience.',
    });
    const extraction = extractDynamicJdPhrases(jd);
    const result = scoreCanonicalAts(candidate, jd);

    expect(extraction.hardSkills.map(({ phrase }) => phrase)).not.toContain('zendesk');
    expect(extraction.hardSkills.map(({ phrase }) => phrase)).not.toContain('technician');
    expect(result.state).toBe('SCORABLE');
    expect(result.missingRequirements).toContain('zendesk');
    expect(result.missingRequirements).not.toContain('technician');

    const responsibilityOnly = scoreCanonicalAts(candidate, [
      'Stanowisko: IT Support Technician',
      'Obowiązki:',
      '- Obsługa zgłoszeń za pomocą Zendesk.',
    ].join('\n'));
    expect(responsibilityOnly.state).toBe('NO_REQUIREMENTS_DETECTED');
  });

  it('liczy wymagania elektryczne z oferty i zostawia bez dowodu tylko czytanie projektów', () => {
    const jd = 'Szukamy elektryka do prac montażowych. Wymagania: montaż instalacji elektrycznych, uprawnienia SEP do 1kV, podłączanie rozdzielnic elektrycznych, pomiary ochronne, czytanie projektów elektrycznych.';
    const candidate = vaultWith({
      title: 'Elektryk instalator',
      summary: 'Uprawniony elektromonter z doświadczeniem w montażu instalacji elektrycznych. Uprawnienia SEP E+D do 1kV z pomiarami ochronnymi.',
      hard: [
        'Instalacje elektryczne',
        'Montaż rozdzielnic elektrycznych',
        'Pomiary elektryczne ochronne',
      ],
      history: [hist('electrician', 'Prefabrykowałem i podłączałem rozdzielnice elektryczne. Wykonywałem pomiary ochronne.')],
    });

    const result = scoreCanonicalAts(candidate, jd);

    expect(result.state).toBe('SCORABLE');
    expect(result.components.skills).toBe(75);
    expect(result.matchedRequirements).toEqual(expect.arrayContaining([
      'instalacje elektryczne',
      'montaż rozdzielnic elektrycznych',
      'pomiary elektryczne ochronne',
    ]));
    expect(result.missingRequirements).toContain('czytanie projektów elektrycznych');
    expect(result.missingRequirements).not.toContain('SEP');
  });

  it('usuwa angielskie sekcje Desirable z wymagań i kanonicznych braków', () => {
    const jd = `Support Engineer
Mandatory: customer-facing support, Windows troubleshooting and ServiceNow.
Desirable: Exchange Online, Entra ID, Intune, PowerShell and ITIL.`;
    const candidate = vaultWith({
      summary: 'Customer support and Windows troubleshooting experience.',
      hard: ['customer-facing support', 'Windows troubleshooting'],
      history: [hist('support', 'Resolved Windows support issues for users.')],
    });
    const extraction = extractDynamicJdPhrases(jd);
    const result = scoreCanonicalAts(candidate, jd);
    const extractedSkills = extraction.hardSkills.map(({ phrase }) => phrase);

    expect(extractedSkills).toContain('servicenow');
    expect(extractedSkills).not.toEqual(expect.arrayContaining([
      'exchange online', 'entra id', 'intune', 'powershell', 'itil',
    ]));
    expect(result.missingRequirements).toContain('servicenow');
    expect(result.missingRequirements).not.toEqual(expect.arrayContaining([
      'exchange online', 'entra id', 'intune', 'powershell', 'itil',
    ]));
  });

  it('nie obniża dopasowania przez kryteria wyraźnie zaprzeczone w wymaganiach', () => {
    const jd = `Specjalista terenowy
Wymagania
Prawo jazdy kat. B nie jest wymagane.
Angielski nie jest wymagany.
Minimum 3 lata doświadczenia nie jest wymagane.
ServiceNow jest wymagany.`;
    const result = scoreCanonicalAts(vaultWith({
      summary: 'Doświadczenie w obsłudze zgłoszeń IT, rozwiązywaniu problemów technicznych i wsparciu użytkowników.',
    }), jd);

    expect(result.state).toBe('SCORABLE');
    expect(result.missingRequirements).toContain('servicenow');
    expect(result.missingRequirements.map((item) => item.toLocaleLowerCase('pl-PL'))).not.toEqual(expect.arrayContaining([
      'angielski', 'english', 'prawo jazdy', 'prawo jazdy kat. b', 'min. 3 lata doświadczenia',
    ]));
    expect(result.missingRequirements).toHaveLength(1);
  });

  it('pomija „no requirement” i „not necessary” w kanonicznej punktacji', () => {
    const jd = `Data Analyst
Requirements
No requirement for PowerShell.
AWS is not necessary.
Python is required.`;
    const result = scoreCanonicalAts(vaultWith({
      summary: 'Analiza danych i budowanie raportów operacyjnych.',
    }), jd);

    expect(result.missingRequirements.map((item) => item.toLowerCase())).toEqual(['python']);
  });

  it('zachowuje jawny wymóg po atucie, gdy oba są w jednym wierszu', () => {
    const jd = 'Wymagania: mile widziane Entra ID, wymagane ServiceNow.';
    const candidate = vaultWith({
      summary: 'IT support professional with customer service and troubleshooting experience.',
    });
    const extraction = extractDynamicJdPhrases(jd);
    const result = scoreCanonicalAts(candidate, jd);

    expect(extraction.hardSkills.map(({ phrase }) => phrase)).toContain('servicenow');
    expect(extraction.hardSkills.map(({ phrase }) => phrase)).not.toContain('entra id');
    expect(result.missingRequirements).toContain('servicenow');
    expect(result.missingRequirements).not.toContain('entra id');

    const english = extractDynamicJdPhrases(
      'Requirements: not required Entra ID, required ServiceNow.',
    );
    expect(english.hardSkills.map(({ phrase }) => phrase)).toContain('servicenow');
    expect(english.hardSkills.map(({ phrase }) => phrase)).not.toContain('entra id');
  });

  it('nie obniża kanonicznego wyniku przez wymóg zapisany jako „is a plus”', () => {
    const jd = `Support Engineer
Requirements:
JavaScript is a plus.
ServiceNow is required.`;
    const candidate = vaultWith({
      summary: 'IT support professional with customer service and troubleshooting experience.',
    });
    const extraction = extractDynamicJdPhrases(jd);
    const result = scoreCanonicalAts(candidate, jd);

    expect(extraction.hardSkills.map(({ phrase }) => phrase)).not.toContain('javascript');
    expect(extraction.hardSkills.map(({ phrase }) => phrase)).toContain('servicenow');
    expect(result.missingRequirements.map((phrase) => phrase.toLowerCase())).not.toContain('javascript');
    expect(result.missingRequirements.map((phrase) => phrase.toLowerCase())).toContain('servicenow');
  });
});

describe('kanon: kształt i granice', () => {
  it('nie używa liczby sprzed zmiany reguł jako bieżącego kanonicznego wyniku', () => {
    expect(CANONICAL_ATS_SCORE_PROVENANCE).toBe('canonical-v2');
    expect(hasCanonicalAtsScore({ atsScore: 41, atsScoreProvenance: 'canonical-v1' })).toBe(false);
  });

  it('uznaje wynik ATS tylko z jawnie kanonicznym źródłem i w zakresie 0–100', () => {
    expect(hasCanonicalAtsScore({ atsScore: 0, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE })).toBe(true);
    expect(hasCanonicalAtsScore({ atsScore: 41 })).toBe(false);
    expect(hasCanonicalAtsScore({ atsScore: 101, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE })).toBe(false);
  });

  it('uznaje CV za wystarczające dopiero od 20 znaków treści dowodowej', () => {
    expect(hasSufficientCvContent(vaultWith({ summary: 'abcdefghi' }))).toBe(false);
    expect(hasSufficientCvContent(vaultWith({ summary: 'abcdefghijklmnopqrst' }))).toBe(false);
    expect(hasSufficientCvContent(vaultWith({ summary: 'Experienced in user support and ticket triage.' }))).toBe(true);
    expect(hasSufficientCvContent(vaultWith({ summary: '123456789012345678901234567890' }))).toBe(false);

    const metadataOnly = vaultWith({ title: 'Specjalista wsparcia IT i administracji systemami' });
    metadataOnly.history = [{
      id: 'job-1', company: 'Długa Nazwa Pracodawcy Sp. z o.o.', role: 'Starszy Specjalista ds. Wsparcia',
      location: 'Warszawa', startDate: '2020-01', endDate: '2024-01', isCurrent: false, highlights: [],
    }];
    metadataOnly.education = [{ id: 'edu-1', institution: 'Akademia Informatyki', degree: 'Inżynier', fieldOfStudy: 'Systemy komputerowe', startDate: '2015', endDate: '2019' }];
    expect(hasSufficientCvContent(metadataOnly)).toBe(false);
  });

  it('nie dolicza pustych sekcji ani nazw sekcji wspomnianych w opisie do struktury CV', () => {
    const jd = 'Wymagania: Python i AWS.';
    const base = vaultWith({ summary: 'Experienced in user support and ticket triage.' });
    const sectionNamesInNarrative = vaultWith({
      summary: 'Experienced in user support and ticket triage. My skills and work experience focus on incident resolution.',
    });
    const blankHistory = vaultWith({ summary: base.personalInfo.summary });
    blankHistory.history = [{
      id: 'empty-history-entry',
      company: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      highlights: [],
    }];
    const blankSkills = vaultWith({ summary: base.personalInfo.summary, hard: ['  '] });

    const expected = scoreCanonicalAts(base, jd);

    expect(scoreCanonicalAts(sectionNamesInNarrative, jd).components.structure).toBe(expected.components.structure);
    expect(scoreCanonicalAts(blankHistory, jd).components.structure).toBe(expected.components.structure);
    expect(scoreCanonicalAts(blankSkills, jd).components.structure).toBe(expected.components.structure);
    expect(scoreCanonicalAts(sectionNamesInNarrative, jd).score).toBe(expected.score);
    expect(scoreCanonicalAts(blankHistory, jd).score).toBe(expected.score);
    expect(scoreCanonicalAts(blankSkills, jd).score).toBe(expected.score);
  });

  it('obniża składnik struktury dla niepoprawnego adresu kontaktowego', () => {
    const candidate = vaultWith({
      summary: 'Experienced in user support and ticket triage.',
      hard: ['Python'],
      history: [hist('support', 'Worked with Python and ticket queues.')],
    });
    const jd = 'Wymagania: znajomość Python i obsługa zgłoszeń.';
    const validEmailScore = scoreCanonicalAts(candidate, jd).components.structure;
    candidate.personalInfo.email = 'jan@';

    const result = scoreCanonicalAts(candidate, jd);

    expect(result.penalties).toContain('Brak prawidłowego adresu e-mail.');
    expect(result.components.structure).toBe(validEmailScore! - 10);
  });

  it('używa tych samych progów i etykiet dla szybkiego i szczegółowego wyniku', () => {
    expect(getCanonicalScoreBand(75)).toBe('high');
    expect(getCanonicalScoreBand(74)).toBe('moderate');
    expect(getCanonicalScoreBand(50)).toBe('moderate');
    expect(getCanonicalScoreBand(49)).toBe('low');
    expect(CANONICAL_SCORE_BAND_LABELS[getCanonicalScoreBand(73)]).toBe('Umiarkowane dopasowanie');
  });

  it('traktuje ServiceNow lub Jira jako jedną alternatywę i rozpoznaje opisane triage incydentów', () => {
    const candidate = vaultWith({
      tools: ['ServiceNow'],
      history: [hist('support', 'Kategoryzowanie, ustalanie priorytetu i przekazywanie incydentów do zespołów L2.')],
    });
    const result = scoreCanonicalAts(candidate, `Support Engineer\nRequired\nExperience with ticketing systems such as ServiceNow or Jira Service Management.\nIncident triage, prioritization and escalation to L2.`);

    expect(result.missingRequirements).not.toContain('jira');
    expect(result.matchedRequirements).toContain('incident triage');
    expect(result.missingRequirements).not.toContain('incident triage');
  });

  it('wagi sumują się do 1', () => {
    expect(
      CANONICAL_WEIGHTS.skills + CANONICAL_WEIGHTS.experience +
      CANONICAL_WEIGHTS.structure + CANONICAL_WEIGHTS.formal
    ).toBeCloseTo(1, 10);
  });

  it('0 <= score <= 100 i uzgodnienie z komponentami', () => {
    const v = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS work')] });
    const r = scoreCanonicalAts(v, JD, 'Developer');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(recomputeCanonicalTotal(r.components)).toBe(r.score);
    expect(r.state).toBe('SCORABLE');
  });

  it('stany bez danych nie udają wyniku 0%', () => {
    const full = vaultWith({ hard: ['Python'], history: [hist('1', 'Python')] });
    expect(scoreCanonicalAts(full, '   ').state).toBe('INSUFFICIENT_JD');
    expect(scoreCanonicalAts(full, '   ').score).toBeNull();
    const empty = vaultWith({ title: '', hard: [] });
    const re = scoreCanonicalAts(empty, JD);
    expect(re.state).toBe('INSUFFICIENT_CV');
    expect(re.score).toBeNull();
    const noRequirements = scoreCanonicalAts(full, 'Ładna kultura pracy i owoce w biurze.');
    expect(noRequirements.state).toBe('NO_REQUIREMENTS_DETECTED');
    expect(noRequirements.score).toBeNull();
  });

  it('sam długi tytuł zawodowy nie jest uznawany za treść CV', () => {
    const titleOnly = vaultWith({
      title: 'Specjalista wsparcia IT i administracji systemami',
      summary: '',
      hard: [],
      tools: [],
      history: [],
    });

    expect(scoreCanonicalAts(titleOnly, JD).state).toBe('INSUFFICIENT_CV');
  });

  it('tytuł „Python Developer” sam nie potwierdza wymaganej umiejętności Python', () => {
    const titleOnly = vaultWith({
      title: 'Python Developer',
      summary: 'Profil kandydata bez opisu umiejętności.',
      hard: [],
      tools: [],
      history: [],
    });
    const result = scoreCanonicalAts(titleOnly, 'Wymagania: Python, AWS, Docker.');

    expect(result.missingRequirements).toContain('python');
    expect(result.matchedRequirements).not.toContain('python');
  });

  it('nie traktuje nazwy stanowiska ani projektu jako dowodu umiejetnosci', () => {
    const candidate = vaultWith({
      title: 'Python Developer',
      summary: 'Doswiadczenie w planowaniu wydan i wspolpracy z zespolami produktowymi.',
      history: [{
        ...hist('role-python', 'Wspolpraca z zespolami przy planowaniu wydan.'),
        role: 'Python Developer',
      }],
    });
    candidate.projects = [{
      id: 'project-kubernetes',
      name: 'Kubernetes platforma',
      role: 'Koordynator',
      description: 'Koordynacja harmonogramu wdrozenia i komunikacja z interesariuszami.',
      techStack: [],
    }];
    const result = scoreCanonicalAts(candidate, 'Wymagania: Python i Kubernetes.');
    const control = {
      ...candidate,
      history: candidate.history.map((job) => ({ ...job, role: 'Developer' })),
    };
    const controlResult = scoreCanonicalAts(control, 'Wymagania: Python i Kubernetes.');

    expect(result.missingRequirements).toEqual(expect.arrayContaining(['python', 'kubernetes']));
    expect(result.matchedRequirements).not.toEqual(expect.arrayContaining(['python', 'kubernetes']));
    expect(result.components.experience).toBe(controlResult.components.experience);
  });

  it('nie pokazuje 100% umiejętności, gdy oferta ma tylko wymagania formalne', () => {
    const v = vaultWith({
      title: 'Specjalistka wsparcia IT',
      summary: 'Doświadczenie w obsłudze IT i wsparciu użytkowników.',
      hard: [],
      tools: [],
      history: [hist('1', 'Obsługa zgłoszeń użytkowników.')],
    });
    const jd = 'Wymagania: prawo jazdy kat. B, uprawnienia SEP G3, certyfikat F-Gaz.';

    const result = scoreCanonicalAts(v, jd);

    expect(result.state).toBe('SCORABLE');
    expect(result.components.skills).toBeNull();
    expect(result.effectiveWeights.skills).toBe(0);
    expect(result.score).toBe(recomputeCanonicalTotal(result.components));
    expect(result.score).toBeLessThan(100);
  });

  it('nie przyznaje 100% formaliów, gdy oferta nie zawiera kryteriów formalnych', () => {
    const v = vaultWith({
      title: 'Developer',
      summary: 'Pracowałem z Pythonem i AWS.',
      hard: ['Python', 'AWS'],
      history: [hist('1', 'Python AWS')],
    });

    const result = scoreCanonicalAts(v, 'Wymagania: Python, AWS, Docker.');

    expect(result.components.skills).not.toBeNull();
    expect(result.components.formal).toBeNull();
    expect(result.effectiveWeights.formal).toBe(0);
    expect(result.score).toBe(recomputeCanonicalTotal(result.components));
  });

  it('nie pokazuje ogólnego wymogu obok bardziej szczegółowego knock-outu', () => {
    const v = vaultWith({
      title: 'Specjalistka wsparcia IT',
      summary: 'Doświadczenie w obsłudze IT i wsparciu użytkowników.',
      history: [hist('1', 'Obsługa zgłoszeń użytkowników.')],
    });
    const jd = 'Wymagania: prawo jazdy kat. B, uprawnienia SEP G3, certyfikat F-Gaz.';

    const result = scoreCanonicalAts(v, jd);

    expect(result.missingRequirements).not.toContain('prawo jazdy');
    expect(result.missingRequirements).toContain('Prawo jazdy kat. B');
    expect(result.missingRequirements).not.toContain('certyfikat');
    expect(result.missingRequirements).toContain('Certyfikat F-Gaz');
  });

  it('nie przenosi mile widzianej kwalifikacji do braków obowiązkowych ani wyniku formalnego', () => {
    const v = vaultWith({
      title: 'Specjalistka IT',
      summary: 'Wsparcie użytkowników i administracja usługami Microsoft.',
      hard: ['Windows 11'],
      history: [hist('1', 'Wsparcie Windows 11 i Microsoft 365.')],
    });
    const result = scoreCanonicalAts(
      v,
      'Wymagania: Windows 11. Mile widziane: certyfikat Azure.',
    );

    expect(result.missingRequirements).not.toContain('Certyfikat Microsoft Azure');
    expect(result.formalFindings).toContainEqual({
      label: 'Certyfikat Microsoft Azure',
      satisfied: false,
      severity: 'preferred',
      status: 'unsatisfied',
    });
    expect(result.components.formal).toBeNull();
  });

  it('nie liczy metody spawania drugi raz obok wymaganego uprawnienia spawalniczego', () => {
    const v = vaultWith({
      title: 'Monter i serwisant',
      summary: 'Doświadczenie techniczne przy instalacjach przemysłowych.',
      history: [hist('1', 'Prace przy urządzeniach przemysłowych.')],
    });
    const result = scoreCanonicalAts(
      v,
      'Wymagane uprawnienia SEP G3 E, UDT na wózki widłowe, certyfikat F-Gaz kat. I, uprawnienia spawalnicze TIG 141 oraz prawo jazdy C+E.',
    );

    expect(result.missingRequirements).not.toContain('tig');
    expect(result.missingRequirements).toContain('Uprawnienia spawalnicze (metoda wymagana w ogłoszeniu)');
    expect(result.missingRequirements).toContain('Uprawnienia SEP G3 (gazowe)');
    expect(result.missingRequirements).toContain('Certyfikat F-Gaz');
    expect(result.missingRequirements).toContain('Uprawnienia UDT — wózki widłowe');
    expect(result.missingRequirements).toContain('Prawo jazdy kat. C+E');
  });
});

describe('kanon: własności', () => {
  it('DETERMINIZM: ten sam wkład → ten sam wynik', () => {
    const mk = () => vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS work')] });
    expect(scoreCanonicalAts(mk(), JD).score).toBe(scoreCanonicalAts(mk(), JD).score);
  });

  it('MONOTONICZNOŚĆ: zweryfikowany dowód nie obniża skills', () => {
    const base = vaultWith({ hard: ['Python'], history: [hist('1', 'Python work')] });
    const plus = vaultWith({ hard: ['Python', 'AWS'], history: [hist('1', 'Python AWS work')] });
    expect(scoreCanonicalAts(plus, JD).components.skills!)
      .toBeGreaterThanOrEqual(scoreCanonicalAts(base, JD).components.skills!);
  });

  it('USUWANIE: utrata dowodu nie podnosi skills', () => {
    const full = vaultWith({ hard: ['Python', 'AWS'], history: [hist('1', 'Python AWS work')] });
    const less = vaultWith({ hard: ['Python'], history: [hist('1', 'Python work')] });
    expect(scoreCanonicalAts(less, JD).components.skills!)
      .toBeLessThanOrEqual(scoreCanonicalAts(full, JD).components.skills!);
  });

  it('NEGACJA: `do not know Python` nie spełnia', () => {
    const v = vaultWith({ summary: 'I do not know Python.', history: [hist('1', 'I do not know Python.')] });
    const r = scoreCanonicalAts(v, 'Need Python developer');
    expect(r.missingRequirements).toContain('python');
    expect(r.matchedRequirements).not.toContain('python');
  });

  it('nazwa pracodawcy nie jest dowodem umiejętności', () => {
    const v = vaultWith({
      title: 'Koordynator obsługi',
      summary: 'Koordynacja zgłoszeń i praca z klientami.',
      history: [{ ...hist('sap-company', 'Obsługa zgłoszeń i klientów.'), company: 'SAP Polska' }],
    });
    const result = scoreCanonicalAts(v, 'Wymagania: znajomość SAP do obsługi systemu firmowego.');

    expect(result.missingRequirements).toContain('sap');
    expect(result.matchedRequirements).not.toContain('sap');
  });

  it('nazwa szkoły nie jest dowodem umiejętności', () => {
    const v = vaultWith({
      title: 'Koordynator operacji',
      summary: 'Organizacja pracy magazynu i kontakt z klientami.',
    });
    v.education = [{
      id: 'aws-school',
      institution: 'AWS Academy Kraków',
      degree: 'Technik logistyk',
      fieldOfStudy: 'Logistyka',
      startDate: '2018',
      endDate: '2022',
    }];
    const result = scoreCanonicalAts(v, 'Wymagania: znajomość AWS i Linux do pracy z chmurą.');

    expect(result.missingRequirements).toContain('aws');
    expect(result.matchedRequirements).not.toContain('aws');
  });

  it('zmiana kolejności kart doświadczenia nie zmienia wyniku ani świeżości', () => {
    const history = [
      hist('old-skill', 'Obsługa Python.', '2012-01', '2014-01'),
      hist('mid-1', 'Obsługa zgłoszeń.', '2015-01', '2017-01'),
      hist('mid-2', 'Wsparcie klientów.', '2018-01', '2020-01'),
      hist('recent', 'Koordynacja pracy zespołu.', '2021-01', '2024-01'),
    ];
    const jd = 'Wymagania: Python jest potrzebny do automatyzacji.';
    const newestFirst = scoreCanonicalAts(vaultWith({ history }), jd);
    const oldestFirst = scoreCanonicalAts(vaultWith({ history: [...history].reverse() }), jd);

    expect(oldestFirst.components.experience).toBe(newestFirst.components.experience);
    expect(oldestFirst.score).toBe(newestFirst.score);
  });

  it('wymagany staż z oferty wpływa na komponent doświadczenia', () => {
    const candidate = vaultWith({
      summary: 'Doświadczenie w programowaniu i utrzymaniu systemów backendowych.',
      history: [hist('two-years', 'Programowanie Python.', '2022-01', '2024-01')],
    });
    const twoYears = scoreCanonicalAts(candidate, 'Requirements:\nPython.\nAt least 2 years of experience.');
    const fiveYears = scoreCanonicalAts(candidate, 'Requirements:\nPython.\nAt least 5 years of experience.');

    expect(twoYears.state).toBe('SCORABLE');
    expect(fiveYears.state).toBe('SCORABLE');
    expect(fiveYears.components.experience).toBeLessThan(twoYears.components.experience!);
    expect(fiveYears.score!).toBeLessThan(twoYears.score!);
    expect(twoYears.matchedRequirements).toContain('Min. 2 lata doświadczenia');
    expect(fiveYears.missingRequirements).toContain('Min. 5 lat doświadczenia');
  });

  it.each(['Monter', 'Spawacz', 'Magazynier'])('ocenia sam wymagany staż dla roli %s bez listy narzędzi i uprawnień', (role) => {
    const candidate = vaultWith({
      title: role,
      summary: 'Doświadczenie zawodowe w zadaniach technicznych i pracy zespołowej.',
      history: [{ ...hist('two-years', 'Zadania techniczne i organizacja pracy.', '2022-01', '2024-01'), role }],
    });
    const result = scoreCanonicalAts(candidate, 'Wymagania:\nMinimum 5 lat doświadczenia zawodowego.');

    expect(result.state).toBe('SCORABLE');
    expect(result.components.skills).toBeNull();
    expect(result.components.experience).toBe(40);
    expect(result.missingRequirements).toContain('Min. 5 lat doświadczenia');
  });

  it('zachowuje sam wymagany staż jako niepotwierdzony, gdy profil nie ma dat', () => {
    const candidate = vaultWith({ summary: 'Doświadczenie zawodowe w obsłudze klientów i pracy zespołowej.' });
    const result = scoreCanonicalAts(candidate, 'Wymagania:\nMinimum 5 lat doświadczenia zawodowego.');

    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia');
    expect(result.missingRequirements).toEqual([]);
  });

  it('potwierdza sam próg stażu, gdy wiarygodne daty go pokrywają', () => {
    const candidate = vaultWith({ history: [hist('two-years', 'Organizacja pracy magazynu.', '2022-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania:\nMinimum 2 lata doświadczenia zawodowego.');

    expect(result.state).toBe('SCORABLE');
    expect(result.components.experience).toBe(100);
    expect(result.matchedRequirements).toContain('Min. 2 lata doświadczenia');
    expect(result.missingRequirements).toEqual([]);
  });

  it('sam opcjonalny staż nie tworzy obowiązkowego wymagania ani punktacji', () => {
    const candidate = vaultWith({ history: [hist('two-years', 'Organizacja pracy magazynu.', '2022-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Mile widziane:\nMinimum 5 lat doświadczenia zawodowego.');

    expect(result.state).toBe('NO_REQUIREMENTS_DETECTED');
    expect(result.score).toBeNull();
    expect(result.missingRequirements).toEqual([]);
  });

  it('nie porównuje stażu magazyniera do okresu gwarancji sprzętu', () => {
    const candidate = vaultWith({
      title: 'Magazynier',
      history: [{ ...hist('four-years', 'Organizacja pracy i kompletowanie zamówień.', '2020-01', '2024-01'), role: 'Magazynier' }],
    });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 2 lata gwarancji producenta na sprzęt.\nMinimum 5 lat doświadczenia zawodowego.');

    expect(result.components.experience).toBe(80);
    expect(result.missingRequirements).toContain('Min. 5 lat doświadczenia');
    expect(result.matchedRequirements).not.toContain('Min. 2 lata doświadczenia');
  });

  it.each([
    ['Monter', 'Minimum 5 lat doświadczenia w montażu instalacji.'],
    ['Spawacz', 'Minimum 5 lat doświadczenia w spawaniu TIG.'],
    ['Magazynier', 'Minimum 5 lat doświadczenia na stanowisku magazyniera.'],
    ['Developer', 'At least 5 years of experience with Python.'],
  ])('nie zalicza ogólnego stażu jako czasu w wymaganym obszarze dla roli %s', (role, requirement) => {
    const candidate = vaultWith({
      title: role,
      hard: ['Python', 'TIG'],
      history: [hist('other-work', 'Obsługa klientów i organizacja pracy zespołu.', '2010-01', '2024-01')],
    });
    const result = scoreCanonicalAts(candidate, `Requirements\n${requirement}`);

    expect(result.components.experience).toBeNull();
    expect(result.unconfirmedRequirements.some((item) => item.startsWith('Min. 5 lat doświadczenia'))).toBe(true);
    expect(result.matchedRequirements.some((item) => item.startsWith('Min. 5 lat doświadczenia'))).toBe(false);
  });

  it('punkt z technologią nie potwierdza używania jej przez cały okres zatrudnienia', () => {
    const candidate = vaultWith({
      hard: ['Python'],
      history: [hist('python-work', 'Tworzenie skryptów Python.', '2010-01', '2024-01')],
    });
    const result = scoreCanonicalAts(candidate, 'Requirements\nAt least 5 years of experience with Python.');

    expect(result.components.experience).toBeNull();
    expect(result.unconfirmedRequirements.some((item) => item.includes('Python'))).toBe(true);
    expect(result.penalties).toContain('Daty zatrudnienia nie potwierdzają czasu doświadczenia w wymaganym obszarze.');
  });

  it('ocenia staż ogólny oddzielnie od niepotwierdzonego czasu w konkretnym obszarze', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2020-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 3 lata doświadczenia zawodowego.\nMinimum 5 lat doświadczenia w montażu instalacji.');
    expect(result.matchedRequirements).toContain('Min. 3 lata doświadczenia');
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia (w montażu instalacji)');
    expect(result.missingRequirements).not.toContain('Min. 5 lat doświadczenia (w montażu instalacji)');
    expect(result.components.experience).toBe(100);
  });

  it('nie ignoruje późniejszego, wyższego obowiązkowego progu ogólnego stażu', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2020-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 3 lata doświadczenia zawodowego.\nMinimum 5 lat doświadczenia zawodowego.');
    expect(result.matchedRequirements).toContain('Min. 3 lata doświadczenia');
    expect(result.missingRequirements).toContain('Min. 5 lat doświadczenia');
    expect(result.components.experience).toBe(80);
  });

  it('wyjaśnia niepotwierdzony obszar bez fałszywego komunikatu o braku dat', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2010-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 5 lat doświadczenia na stanowisku magazyniera.');
    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.reason).toContain('Daty zatrudnienia nie potwierdzają czasu doświadczenia w wymaganym obszarze.');
    expect(result.reason).not.toContain('Brak wiarygodnych dat zatrudnienia');
  });

  it('nie uznaje przyszłej daty zakończenia za wiarygodny staż', () => {
    const candidate = vaultWith({
      summary: 'Experienced in programming and maintaining backend systems.',
      hard: ['Python', 'AWS'],
      history: [hist('future-end', 'Programming with Python and AWS.', '2020-01', '2099-01')],
    });
    const result = scoreCanonicalAts(candidate, 'Requirements:\\nMinimum 5 years of experience.\\nRequired skills: Python and AWS.');

    expect(result.components.experience).toBeNull();
    expect(result.missingRequirements).not.toContain('Min. 5 lat doświadczenia');
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia');
    expect(result.penalties.join(' ')).toContain('brak wiarygodnych dat zatrudnienia');
    expect(result.penalties.join(' ')).toContain('przyszłym zakresem dat');
  });

  it('porównuje staż z pełnym progiem ułamkowym, bez wycinania cyfry po przecinku', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2022-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 2,5 lata doświadczenia zawodowego.');
    expect(result.components.experience).toBe(80);
    expect(result.missingRequirements).toContain('Min. 2,5 roku doświadczenia');
  });

  it('przedział lat nie podnosi minimalnego progu do jego górnego końca', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2020-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Requirements\n3–5 years of experience.');
    expect(result.components.experience).toBe(100);
    expect(result.matchedRequirements).toContain('Min. 3 lata doświadczenia');
    expect(result.missingRequirements).toEqual([]);
  });

  it('uwzględnia obowiązkowy staż zapisany po nazwie doświadczenia', () => {
    const candidate = vaultWith({ history: [hist('support-work', 'Obsługa klientów i organizacja pracy zespołu.', '2022-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nDoświadczenie zawodowe: minimum 5 lat.');
    expect(result.state).toBe('SCORABLE');
    expect(result.components.experience).toBe(40);
    expect(result.missingRequirements).toContain('Min. 5 lat doświadczenia');
  });

  it('bez dat nie zamienia odwróconego wymogu stażu w brak wykrytych wymagań', () => {
    const candidate = vaultWith({ summary: 'Obsługa klientów i organizacja pracy zespołu.' });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nDoświadczenie zawodowe: minimum 5 lat.');
    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia');
  });

  it('nazwa technologii przed doświadczeniem nie pozwala zaliczyć ogólnego stażu', () => {
    const candidate = vaultWith({ hard: ['Python'], history: [hist('support-work', 'Obsługa klientów i tworzenie skryptów Python.', '2010-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Requirements\nPython experience: at least 5 years.');
    expect(result.components.experience).toBeNull();
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia (Python)');
  });

  it.each([
    ['Maksymalnie 5 lat doświadczenia zawodowego.', '2022-01', 100, 'Maks. 5 lat doświadczenia', true],
    ['Experience: at most 5 years.', '2018-01', 0, 'Maks. 5 lat doświadczenia', false],
    ['Experience: 5 years maximum.', '2018-01', 0, 'Maks. 5 lat doświadczenia', false],
    ['Less than 5 years of experience.', '2019-01', 0, 'Mniej niż 5 lat doświadczenia', false],
    ['Experience: less than 5 years.', '2022-01', 100, 'Mniej niż 5 lat doświadczenia', true],
    ['Ponad 5 lat doświadczenia zawodowego.', '2019-01', 0, 'Ponad 5 lat doświadczenia', false],
    ['Experience: more than 5 years.', '2018-01', 100, 'Ponad 5 lat doświadczenia', true],
  ])('ocenia granicę stażu zgodnie z jej kierunkiem: %s', (requirement, start, score, label, matched) => {
    const candidate = vaultWith({ history: [hist('work', 'Obsługa klientów i organizacja pracy zespołu.', start, '2024-01')] });
    const result = scoreCanonicalAts(candidate, `Requirements\n${requirement}`);
    expect(result.state).toBe('SCORABLE');
    expect(result.components.experience).toBe(score);
    expect(matched ? result.matchedRequirements : result.missingRequirements).toContain(label);
    expect(result.unconfirmedRequirements).not.toContain(label);
    expect(result.missingRequirements).not.toContain('Min. 5 lat doświadczenia');
  });

  it('nie uznaje braku dat za spełnienie górnego limitu stażu', () => {
    const candidate = vaultWith({ summary: 'Obsługa klientów i organizacja pracy zespołu.' });
    const result = scoreCanonicalAts(candidate, 'Requirements\nExperience: at most 5 years.');
    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.unconfirmedRequirements).toContain('Maks. 5 lat doświadczenia');
  });

  it('nie ignoruje górnej granicy obok spełnionego minimum', () => {
    const candidate = vaultWith({ history: [hist('work', 'Obsługa klientów i organizacja pracy zespołu.', '2018-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, 'Wymagania\nMinimum 3 lata doświadczenia zawodowego.\nMaksymalnie 5 lat doświadczenia zawodowego.');
    expect(result.components.experience).toBe(0);
    expect(result.matchedRequirements).toContain('Min. 3 lata doświadczenia');
    expect(result.missingRequirements).toContain('Maks. 5 lat doświadczenia');
  });

  it.each(['5', '0'])('ogólny staż nie potwierdza maksymalnie %s lat w konkretnym obszarze', (years) => {
    const candidate = vaultWith({ history: [hist('work', 'Obsługa klientów i organizacja pracy zespołu.', '2018-01', '2024-01')] });
    const result = scoreCanonicalAts(candidate, `Wymagania\nDoświadczenie magazynowe: maksymalnie ${years} lat.`);
    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.unconfirmedRequirements).toContain(`Maks. ${years} lat doświadczenia (magazynowe)`);
  });

  it.each([
    ['Magazynier', 'magazynowe'],
    ['Spawacz', 'spawalnicze'],
    ['Monter', 'montażowe'],
  ])('odwrócony wymóg dla roli %s nie zalicza 14 lat innej pracy', (role, scope) => {
    const candidate = vaultWith({
      title: role,
      history: [hist('other-work', 'Obsługa klientów i organizacja pracy zespołu.', '2010-01', '2024-01')],
    });
    const result = scoreCanonicalAts(candidate, `Wymagania\nDoświadczenie ${scope}: minimum 5 lat.`);
    const label = `Min. 5 lat doświadczenia (${scope})`;
    expect(result.state, JSON.stringify(result)).toBe(scope === 'spawalnicze' ? 'SCORABLE' : 'UNCONFIRMED_REQUIREMENTS');
    if (scope !== 'spawalnicze') expect(result.score).toBeNull();
    expect(result.components.experience).toBeNull();
    expect(result.unconfirmedRequirements).toContain(label);
    expect(result.matchedRequirements).not.toContain(label);
    expect(result.missingRequirements).not.toContain(label);
  });

  it.each(['.NET', 'Node.js'])('narzędzie %s z atutem lub zaprzeczeniem nie tworzy obowiązkowego wymogu', (tool) => {
    const candidate = vaultWith({ summary: 'Obsługa klientów i organizacja pracy zespołu.' });
    for (const suffix of ['is not required', 'would be a plus']) {
      const result = scoreCanonicalAts(candidate, `Requirements\n${tool} ${suffix}.\nPython is required.`);
      expect(result.state, JSON.stringify(result)).toBe('SCORABLE');
      const labels = [...result.matchedRequirements, ...result.missingRequirements, ...result.unconfirmedRequirements];
      expect(labels.map((label) => label.toLowerCase())).not.toContain(tool.toLowerCase());
      expect(result.missingRequirements).toContain('python');
    }
  });

  it('brak dat zatrudnienia nie daje wymyslonego wyniku stazu', () => {
    const candidate = vaultWith({ hard: ['Python'], summary: 'Developer skilled in Python and building reliable software.' });
    const result = scoreCanonicalAts(candidate, 'Requirements:\nPython.\nAt least 5 years of experience.');

    expect(result.components.experience).toBeNull();
    expect(result.effectiveWeights.experience).toBe(0);
    expect(result.missingRequirements.some((requirement) => requirement.includes('5'))).toBe(false);
    expect(result.unconfirmedRequirements).toContain('Min. 5 lat doświadczenia');
    expect(result.penalties.join(' ')).toContain('brak wiarygodnych dat zatrudnienia');
    expect(result.score).toBe(recomputeCanonicalTotal(result.components));
  });

  it('brak dowodu umiejetnosci w stanowisku nie zeruje swiezosci', () => {
    const candidate = vaultWith({
      hard: ['Python'],
      history: [hist('dated-role', 'Wspolpraca z klientami.', '2020-01', '2024-01')],
    });
    const result = scoreCanonicalAts(candidate, 'Requirements:\nPython.');

    expect(result.components.experience).toBe(27);
  });

  it('sama data rozpoczecia nie potwierdza wymaganego stazu', () => {
    const candidate = vaultWith({
      hard: ['Python'],
      summary: 'Developer skilled in Python and building reliable software.',
      history: [{ ...hist('incomplete-role', 'Python development.', '2020-01', ''), endDate: '' }],
    });
    const result = scoreCanonicalAts(candidate, 'Requirements:\nPython.\nAt least 5 years of experience.');

    expect(result.components.experience).toBeNull();
    expect(result.effectiveWeights.experience).toBe(0);
    expect(result.missingRequirements.some((requirement) => requirement.includes('5'))).toBe(false);
  });

  it('nie myli niepotwierdzonego wymogu formalnego z brakiem wymagań w ofercie', () => {
    const candidate = vaultWith({
      summary: 'Pracownik techniczny z doświadczeniem w serwisie urządzeń.',
    });
    candidate.profiler.licenses = ['fgas'];

    const result = scoreCanonicalAts(candidate, 'Wymagania: aktualny certyfikat F-Gaz.');

    expect(result.state).toBe('UNCONFIRMED_REQUIREMENTS');
    expect(result.score).toBeNull();
    expect(result.unconfirmedRequirements).toContain('Certyfikat F-Gaz (termin waznosci niepotwierdzony)');
    expect(result.reason).toContain('Nie można potwierdzić wymogów z oferty');
  });

  it('DUPLIKACJA: ×3 treści ≈ ten sam wynik', () => {
    const one = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS')] });
    const tri = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS Python AWS Python AWS')] });
    tri.personalInfo.summary = 'Python AWS Python AWS';
    expect(Math.abs(scoreCanonicalAts(tri, JD).score! - scoreCanonicalAts(one, JD).score!)).toBeLessThanOrEqual(5);
  });

  it('BIAŁE ZNAKI: wariant formatowania ≈ ten sam wynik', () => {
    const a = vaultWith({ hard: ['Python'], history: [hist('1', 'Python AWS work')] });
    const b = vaultWith({ hard: ['Python'], history: [hist('1', '  python   AWS\n\nwork  ')] });
    expect(Math.abs(scoreCanonicalAts(a, JD).score! - scoreCanonicalAts(b, JD).score!)).toBeLessThanOrEqual(3);
  });
});
