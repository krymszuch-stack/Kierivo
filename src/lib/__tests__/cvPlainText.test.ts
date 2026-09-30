import { describe, expect, it } from 'vitest';
import type { MasterVault, TailoredResume } from '../../types';
import { applyManualCvOverrides, buildCvPlainText } from '../cvPlainText';
import { createEmptyVault } from '../sampleVault';

describe('Tekst skopiowanego CV', () => {
  it('używa stanowiska dopasowanego i zawiera wszystkie treści widoczne w podglądzie', () => {
    const vault: MasterVault = createEmptyVault('Alicja Testowa', 'alicja@example.test');
    vault.personalInfo.title = 'Pracownik biurowy';
    vault.personalInfo.summary = 'Podsumowanie profilu';
    vault.skillsMatrix.hardSkills = ['Excel'];
    vault.skillsMatrix.toolsAndTech = ['Teams'];
    vault.skillsMatrix.softSkills = ['Komunikacja'];
    vault.skillsMatrix.certifications = [{ id: 'cert-1', name: 'Certyfikat testowy', issuer: 'Jednostka testowa', date: '2024' }];
    vault.profiler.licenses = ['sep_g1_e_1kv'];
    vault.profiler.languages = [{ id: 'lang-1', language: 'Polski', level: 'Native', context: '' }];
    vault.history = [{
      id: 'exp-1', company: 'Firma Testowa', role: 'Specjalistka wsparcia',
      location: 'Kraków', startDate: '2022-01', endDate: '2024-05', isCurrent: false,
      description: 'Obsługa zgłoszeń użytkowników.',
      highlights: [{ id: 'hl-1', text: 'Rozwiązywanie problemów Windows.', action: 'Rozwiązywanie', target: '', tool: '', metric: '', keywords: ['Windows'] }],
    }];
    vault.education = [{
      id: 'edu-1', institution: 'Technikum Testowe', degree: 'Technik',
      fieldOfStudy: 'Informatyka', startDate: '2018', endDate: '2022',
    }];
    const tailored: TailoredResume = {
      targetJobTitle: 'Specjalistka IT Support', companyName: 'Pracodawca Testowy',
      summary: 'Podsumowanie dla oferty', selectedHighlights: [],
      skillsMatched: { hardSkills: ['Excel'], toolsAndTech: [], softSkills: [] }, atsScore: 75,
    };

    const text = buildCvPlainText(vault, tailored);

    expect(text).toContain('Specjalistka IT Support');
    expect(text).not.toContain('Pracownik biurowy');
    expect(text).toContain('Podsumowanie dla oferty');
    expect(text).toContain('NARZĘDZIA I TECHNOLOGIE:\nTeams');
    expect(text).toContain('UMIEJĘTNOŚCI INTERPERSONALNE:\nKomunikacja');
    expect(text).toContain('Obsługa zgłoszeń użytkowników.');
    expect(text).toContain('• Rozwiązywanie problemów Windows.');
    expect(text).toContain('Technik — Informatyka');
    expect(text).toContain('Technikum Testowe');
    expect(text).toContain('SEP G1 E1 do 1 kV — eksploatacja');
    expect(text).toContain('Certyfikat testowy — Jednostka testowa (2024)');
    expect(text).toContain('Polski — Native');
    expect(text).not.toContain('undefined');
  });

  it('ręcznie poprawiony tytuł i podsumowanie mają pierwszeństwo przed dopasowaniem', () => {
    const vault = createEmptyVault('Alicja Testowa', 'alicja@example.test');
    vault.personalInfo.title = 'Moje stanowisko';
    vault.personalInfo.summary = 'Moje podsumowanie';
    const tailored: TailoredResume = {
      targetJobTitle: 'Stanowisko z oferty', companyName: 'Firma Testowa',
      summary: 'Stare podsumowanie dopasowane', selectedHighlights: [],
      skillsMatched: { hardSkills: [], toolsAndTech: [], softSkills: [] }, atsScore: 75,
    };

    const edited = applyManualCvOverrides(tailored, {
      title: 'Ręcznie zmieniony tytuł',
      summary: 'Ręcznie zmienione podsumowanie',
    });
    const text = buildCvPlainText(vault, edited);

    expect(text).toContain('Ręcznie zmieniony tytuł');
    expect(text).toContain('Ręcznie zmienione podsumowanie');
    expect(text).not.toContain('Stanowisko z oferty');
    expect(text).not.toContain('Stare podsumowanie dopasowane');
  });

  it('zwraca pusty tekst dla pustego profilu zamiast dodawać zastępcze fakty', () => {
    expect(buildCvPlainText(createEmptyVault())).toBe('');
  });
});
