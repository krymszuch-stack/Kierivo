import { describe, it, expect } from 'vitest';
import { simulateAtsCheck } from '../atsSimulator';
import { createEmptyVault } from '../sampleVault';
import { MasterVault, TailoredResume } from '../../types';

/**
 * `FlagCategory` był zadeklarowany w typach i zapisywany w profilu, ale żaden
 * scoring go nie odczytywał. Te testy pilnują dwóch rzeczy naraz: że zaczął
 * działać i że **nie rusza samego wyniku**.
 */
function cvWithProblems(): { resume: TailoredResume; vault: MasterVault } {
  const vault = createEmptyVault('Marek Nowak');
  vault.personalInfo.title = 'Monter';
  vault.personalInfo.summary = 'Monter instalacji z doświadczeniem w serwisie.';
  vault.skillsMatrix.hardSkills = ['Lutowanie'];
  vault.history = [
    {
      id: 'exp-1',
      company: 'Gromgaz',
      role: 'Monter',
      location: 'Kraków',
      // Format daty, którego parsery nie odczytają — wywoła zalecenie o formacie.
      startDate: 'wiosna 2018',
      endDate: 'Obecnie',
      isCurrent: true,
      highlights: [
        { id: 'h1', text: 'Przeglądy kotłów ★★★', action: '', target: '', tool: '', metric: '', keywords: [] },
      ],
    },
  ];

  const resume: TailoredResume = {
    targetJobTitle: 'Serwisant kotłów gazowych',
    companyName: '',
    summary: vault.personalInfo.summary,
    selectedHighlights: [],
    skillsMatched: { hardSkills: ['Lutowanie'], toolsAndTech: [], softSkills: [] },
    atsScore: 0,
  };

  return { resume, vault };
}

const JD = `Serwisant kotłów gazowych. Wymagane uprawnienia SEP G3, analiza spalin,
  próby szczelności instalacji gazowej oraz obsługa analizatora Testo.`;

describe('Profil raportu ATS', () => {
  it('domyślnie zostaje przy dotychczasowym zachowaniu', () => {
    const { resume, vault } = cvWithProblems();

    expect(simulateAtsCheck(resume, vault, JD).appliedProfile).toBe('OFFICE_IT');
  });

  it('czyta profil z vaultu, gdy użytkownik go ustawił', () => {
    const { resume, vault } = cvWithProblems();
    vault.profiler.flags = ['PHYSICAL'];

    expect(simulateAtsCheck(resume, vault, JD).appliedProfile).toBe('PHYSICAL');
  });

  it('argument jawny ma pierwszeństwo przed profilem z vaultu', () => {
    const { resume, vault } = cvWithProblems();
    vault.profiler.flags = ['OFFICE_IT'];

    expect(simulateAtsCheck(resume, vault, JD, 'PHYSICAL').appliedProfile).toBe('PHYSICAL');
  });

  it('nie zmienia wyniku punktowego — tylko kolejność zaleceń', () => {
    // To jest granica, której ta funkcja nie może przekroczyć. Ta sama treść
    // CV nie może dostawać różnych ocen zależnie od checkboxa w profilu.
    const office = cvWithProblems();
    const physical = cvWithProblems();

    const a = simulateAtsCheck(office.resume, office.vault, JD, 'OFFICE_IT');
    const b = simulateAtsCheck(physical.resume, physical.vault, JD, 'PHYSICAL');

    expect(b.overallScore).toBe(a.overallScore);
    expect(b.structureScore).toBe(a.structureScore);
    expect(b.keywordCoverageScore).toBe(a.keywordCoverageScore);
    // Ten sam zbiór zaleceń, inna kolejność.
    expect([...b.recommendations].sort()).toEqual([...a.recommendations].sort());
  });

  it('przy profilu fizycznym czytelność dla parsera idzie przed gęstością tytułu', () => {
    const { resume, vault } = cvWithProblems();

    const physical = simulateAtsCheck(resume, vault, JD, 'PHYSICAL');

    const structureIdx = physical.recommendations.findIndex((r) => r.startsWith('Struktura PDF'));
    const titleIdx = physical.recommendations.findIndex((r) => r.startsWith('Nazwa stanowiska z oferty'));

    // Test ma sens tylko wtedy, gdy oba zalecenia faktycznie padły.
    expect(structureIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(structureIdx).toBeLessThan(titleIdx);
  });

  it('nie zgłasza różnicy nazw, gdy tytuł oferty i nagłówek CV są nieznane', () => {
    const { resume, vault } = cvWithProblems();
    resume.targetJobTitle = '';
    vault.personalInfo.title = '';

    const result = simulateAtsCheck(resume, vault, JD);

    expect(result.recommendations.some((item) => item.startsWith('Nazwa stanowiska z oferty'))).toBe(false);
    expect(result.recommendations.some((item) => item.startsWith('W profilu nie podano tytułu zawodowego'))).toBe(false);
  });

  it('oddziela brak nagłówka profilu od rzeczywistej różnicy tytułów', () => {
    const { resume, vault } = cvWithProblems();
    vault.personalInfo.title = '';

    const result = simulateAtsCheck(resume, vault, JD);

    expect(result.recommendations.some((item) => item.startsWith('W profilu nie podano tytułu zawodowego'))).toBe(true);
    expect(result.recommendations.some((item) => item.startsWith('Nazwa stanowiska z oferty'))).toBe(false);
  });
});
