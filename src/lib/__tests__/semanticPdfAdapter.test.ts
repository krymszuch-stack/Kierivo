import { describe, it, expect } from 'vitest';
import { adaptMasterVaultToSemanticProfile } from '../semanticPdfAdapter';
import { MasterVault, TailoredResume } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('semanticPdfAdapter Suite (Zero Fabrication & Contract Integrity)', () => {
  const createSampleVault = (): MasterVault => {
    const vault = createEmptyVault('Janusz Kowalski', 'janusz@example.pl');
    vault.personalInfo = {
      fullName: 'Janusz Kowalski',
      title: 'Inżynier Automatyk',
      summary: 'Podsumowanie bazowe: 8 lat doświadczenia w automatyce.',
      email: 'janusz@example.pl',
      phone: '+48 600 700 800',
      location: 'Warszawa',
      linkedin: 'linkedin.com/in/jkowalski',
      github: 'github.com/jkowalski',
    };
    vault.skillsMatrix = {
      hardSkills: ['Sterowniki PLC', 'SQL'],
      toolsAndTech: ['TIA Portal', 'SCADA'],
      softSkills: ['Komunikacja techniczna'],
      certifications: [
        {
          id: 'c1',
          name: 'SEP do 1 kV',
          issuer: 'SEP',
          date: '2022-05',
        },
      ],
    };
    vault.history = [
      {
        id: 'exp1',
        company: 'Automatyka Przemysłowa S.A.',
        role: 'Automatyk Serwisowy',
        location: 'Warszawa',
        startDate: '2020-03',
        endDate: '2024-01',
        isCurrent: false,
        highlights: [
          {
            id: 'h1',
            text: 'Zredukowano czasy awarii o 30% na linii lakierniczej.',
            action: 'Optymalizacja',
            target: 'Linia lakiernicza',
            tool: 'Siemens S7',
            metric: '30%',
            keywords: ['PLC', 'Siemens'],
          },
          {
            id: 'h2',
            text: 'Bieżący nadzór nad szafami sterowniczymi i dokumentacją.',
            action: 'Nadzór',
            target: 'Szafy sterownicze',
            tool: 'EPLAN',
            metric: '',
            keywords: ['Dokumentacja'],
          },
        ],
      },
    ];
    vault.education = [
      {
        id: 'edu1',
        institution: 'Politechnika Warszawska',
        degree: 'Inżynier',
        fieldOfStudy: 'Automatyka i Robotyka',
        startDate: '2016-10',
        endDate: '2020-02',
      },
    ];
    vault.profiler = {
      flags: ['PHYSICAL'],
      experienceLevel: 'SENIOR',
      location: {
        city: 'Warszawa',
        radiusKm: 30,
        willingnessToTravel: true,
        hybridWork: false,
        remoteOnly: false,
      },
      languages: [
        { id: 'l1', language: 'polski', level: 'Native', context: 'ojczysty' },
        { id: 'l2', language: 'angielski', level: 'B2', context: 'techniczny' },
      ],
      licenses: ['SEP E do 1 kV', 'Prawo jazdy kat. B'],
    };
    return vault;
  };

  it('poprawnie mapuje podstawowe dane profilu bez fabrykowania wartości', () => {
    const vault = createSampleVault();
    const profile = adaptMasterVaultToSemanticProfile(vault);

    expect(profile.name).toBe('Janusz Kowalski');
    expect(profile.initials).toBe('JK');
    expect(profile.title).toBe('Inżynier Automatyk');
    expect(profile.contact.city).toBe('Warszawa');
    expect(profile.contact.phone).toBe('+48 600 700 800');
    expect(profile.contact.email).toBe('janusz@example.pl');
    expect(profile.contact.linkedin).toBe('linkedin.com/in/jkowalski');
    expect(profile.summary.display).toContain('Podsumowanie bazowe');

    // Umiejętności
    expect(profile.skills.length).toBe(5);
    const plcSkill = profile.skills.find((s) => s.label === 'Sterowniki PLC');
    expect(plcSkill).toBeDefined();
    expect(plcSkill?.group).toBe('core');
    expect(plcSkill?.weight).toBe(8);

    // Historia zatrudnienia
    expect(profile.experience.length).toBe(1);
    const exp = profile.experience[0];
    expect(exp.company).toBe('Automatyka Przemysłowa S.A.');
    expect(exp.start).toBe('03.2020');
    expect(exp.end).toBe('01.2024');

    // Podział na result i duty
    expect(exp.bullets.length).toBe(2);
    expect(exp.bullets[0].kind).toBe('result');
    expect(exp.bullets[0].semantic).toContain('Rezultat mierzalny: 30%');
    expect(exp.bullets[1].kind).toBe('duty');

    // Uprawnienia i certyfikaty
    expect(profile.licenses).toEqual(['SEP E do 1 kV', 'Prawo jazdy kat. B']);
    expect(profile.certifications.length).toBe(1);
    expect(profile.certifications[0].name).toBe('SEP do 1 kV');
    expect(profile.languages.length).toBe(2);
  });

  it('uwzględnia dopasowanie TailoredResume: priorytety stanowiska, podsumowania i wag skilli', () => {
    const vault = createSampleVault();
    const tailored: TailoredResume = {
      targetJobTitle: 'Główny Inżynier Utrzymania Ruchu',
      companyName: 'Fabryka Przyszłości',
      summary: 'Dedykowane podsumowanie pod Fabrykę Przyszłości: ekspert automatyk.',
      selectedHighlights: [],
      skillsMatched: {
        hardSkills: ['Sterowniki PLC'],
        toolsAndTech: ['SCADA'],
        softSkills: [],
      },
      atsScore: 92,
    };

    const profile = adaptMasterVaultToSemanticProfile(vault, tailored);

    expect(profile.title).toBe('Główny Inżynier Utrzymania Ruchu');
    expect(profile.summary.display).toBe(
      'Dedykowane podsumowanie pod Fabrykę Przyszłości: ekspert automatyk.'
    );

    // Umiejętność dopasowana zyskuje podwyższoną wagę
    const matchedSkill = profile.skills.find((s) => s.label === 'Sterowniki PLC');
    expect(matchedSkill?.weight).toBe(12);

    const nonMatchedSkill = profile.skills.find((s) => s.label === 'SQL');
    expect(nonMatchedSkill?.weight).toBe(8);

    const matchedTool = profile.skills.find((s) => s.label === 'SCADA');
    expect(matchedTool?.weight).toBe(10);
  });

  it('respektuje jawny summaryOverride ponad tailoredResume', () => {
    const vault = createSampleVault();
    const tailored: TailoredResume = {
      targetJobTitle: 'Automatyk',
      companyName: 'X',
      summary: 'Podsumowanie Tailored',
      selectedHighlights: [],
      skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] },
      atsScore: 90,
    };

    const profile = adaptMasterVaultToSemanticProfile(vault, tailored, {
      summaryOverride: 'Mój manualny override podsumowania',
    });

    expect(profile.summary.display).toBe('Mój manualny override podsumowania');
  });

  it('wspiera własną klauzulę RODO przekazaną w opcjach', () => {
    const vault = createSampleVault();
    const profile = adaptMasterVaultToSemanticProfile(vault, null, {
      rodoClause: 'Zgadzam się na przetwarzanie danych dla firmy ABC.',
    });

    expect(profile.clause).toBe('Zgadzam się na przetwarzanie danych dla firmy ABC.');
  });

  it('wzbogaca semantycznie kompetencje (Skill Graph Enrichment) bez modyfikowania etykiety wizualnej', () => {
    const vault = createSampleVault();
    vault.skillsMatrix.hardSkills.push('Spawanie TIG', 'Pneumatyka');
    vault.skillsMatrix.toolsAndTech.push('Docker');

    const profile = adaptMasterVaultToSemanticProfile(vault);

    // Etykiety wizualne nienaruszone (Zasada 1: Zero wymyślonych danych na wydruku)
    const plc = profile.skills.find((s) => s.label === 'Sterowniki PLC');
    expect(plc).toBeDefined();
    expect(plc?.label).toBe('Sterowniki PLC');
    // Warstwa semantyczna ActualText i JSON-LD zawiera pełne synonimy i standardy
    expect(plc?.semantic).toContain('Programmable Logic Controller');
    expect(plc?.semantic).toContain('Siemens');

    const scada = profile.skills.find((s) => s.label === 'SCADA');
    expect(scada?.label).toBe('SCADA');
    expect(scada?.semantic).toContain('Supervisory Control and Data Acquisition');

    const tig = profile.skills.find((s) => s.label === 'Spawanie TIG');
    expect(tig?.semantic).toContain('141');
    expect(tig?.semantic).toContain('argon');

    const cert = profile.certifications[0];
    expect(cert.name).toBe('SEP do 1 kV');
    expect(cert.semantic).toContain('Stowarzyszenie Elektryków Polskich');
  });
});
