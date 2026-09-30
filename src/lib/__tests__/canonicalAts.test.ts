import { describe, it, expect } from 'vitest';
import { scoreCanonicalAts, recomputeCanonicalTotal, CANONICAL_WEIGHTS } from '../canonicalAts';
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
});

describe('kanon: kształt i granice', () => {
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

  it('stany puste: score 0 + jawny stan', () => {
    const full = vaultWith({ hard: ['Python'], history: [hist('1', 'Python')] });
    expect(scoreCanonicalAts(full, '   ').state).toBe('INSUFFICIENT_JD');
    expect(scoreCanonicalAts(full, '   ').score).toBe(0);
    const empty = vaultWith({ title: '', hard: [] });
    const re = scoreCanonicalAts(empty, JD);
    expect(re.state).toBe('INSUFFICIENT_CV');
    expect(re.score).toBe(0);
    expect(scoreCanonicalAts(full, 'Ładna kultura pracy i owoce w biurze.').state)
      .toBe('NO_REQUIREMENTS_DETECTED');
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
    expect(fiveYears.score).toBeLessThan(twoYears.score);
    expect(twoYears.matchedRequirements).toContain('Min. 2 lata doświadczenia');
    expect(fiveYears.missingRequirements).toContain('Min. 5 lat doświadczenia');
  });

  it('DUPLIKACJA: ×3 treści ≈ ten sam wynik', () => {
    const one = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS')] });
    const tri = vaultWith({ hard: ['Python'], tools: ['AWS'], history: [hist('1', 'Python AWS Python AWS Python AWS')] });
    tri.personalInfo.summary = 'Python AWS Python AWS';
    expect(Math.abs(scoreCanonicalAts(tri, JD).score - scoreCanonicalAts(one, JD).score)).toBeLessThanOrEqual(5);
  });

  it('BIAŁE ZNAKI: wariant formatowania ≈ ten sam wynik', () => {
    const a = vaultWith({ hard: ['Python'], history: [hist('1', 'Python AWS work')] });
    const b = vaultWith({ hard: ['Python'], history: [hist('1', '  python   AWS\n\nwork  ')] });
    expect(Math.abs(scoreCanonicalAts(a, JD).score - scoreCanonicalAts(b, JD).score)).toBeLessThanOrEqual(3);
  });
});
