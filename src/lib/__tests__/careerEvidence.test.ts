import { describe, it, expect } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import { hasCareerEvidence } from '../careerEvidence';
import { scoreCanonicalAts } from '../canonicalAts';
import { getAtsScoreContext, getAtsScoreDisplayInfo, isValidAtsScoreContext } from '../atsScoreEvidence';

function metadataOnlyVault() {
  const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
  vault.personalInfo.summary = '';
  vault.skillsMatrix.hardSkills = ['Python', 'AWS', 'Docker'];
  vault.history = [{
    id: 'metadata-only',
    company: 'Acme',
    role: 'Developer',
    location: '',
    startDate: '2020-01',
    endDate: '2024-01',
    isCurrent: false,
    highlights: [],
  }];
  vault.projects = [{
    id: 'named-only',
    name: 'Platform project',
    role: '',
    description: '',
    techStack: ['Python'],
  }];
  return vault;
}

describe('dowod kariery', () => {
  it('nie uznaje nazw firmy, stanowiska ani projektu za tresc doswiadczenia', () => {
    expect(hasCareerEvidence(metadataOnlyVault())).toBe(false);
  });

  it('uznaje merytoryczny opis stanowiska lub projektu', () => {
    const workVault = metadataOnlyVault();
    workVault.history[0].highlights = [{
      id: 'work-detail',
      text: 'Rozwiazywalem problemy techniczne uzytkownikow.',
      action: '',
      target: '',
      tool: '',
      metric: '',
      keywords: [],
    }];
    expect(hasCareerEvidence(workVault)).toBe(true);

    const projectVault = metadataOnlyVault();
    projectVault.history = [];
    projectVault.projects[0].description = 'Automatyzowalem wdrozenia srodowisk testowych.';
    expect(hasCareerEvidence(projectVault)).toBe(true);
  });

  it('oznacza zapisany wynik jako wstepny dla profilu z samymi metadanymi kariery', () => {
    const vault = metadataOnlyVault();
    const result = scoreCanonicalAts(vault, 'Requirements: Python, AWS, Docker. At least 3 years of experience.');
    const context = getAtsScoreContext(result, 86, hasCareerEvidence(vault));

    expect(result.state).toBe('SCORABLE');
    expect(context?.careerEvidenceAvailable).toBe(false);
    expect(getAtsScoreDisplayInfo(result.score!, context).state).toBe('limited');
  });

  it('nie buduje kontekstu zapisu dla kanonicznego wyniku spoza zakresu', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    const baseline = scoreCanonicalAts(vault, 'Wymagania: Python.');
    const scores = [null, Number.NaN, -1, 101];

    for (const score of scores) {
      const malformed = { ...baseline, state: 'SCORABLE' as const, score } as typeof baseline;
      expect(getAtsScoreContext(malformed, 100, true)).toBeUndefined();
    }
  });

  it('nie pokazuje pełnego wyniku przy niepoprawnym zapisanym kontekście', () => {
    const valid = {
      detectedRequirementCount: 3,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5 as const,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2 as const,
    };
    expect(getAtsScoreDisplayInfo(91, valid).state).toBe('full');

    for (const profileCompleteness of [Number.NaN, 101, -1]) {
      const context = { ...valid, profileCompleteness };
      expect(isValidAtsScoreContext(context)).toBe(false);
      const display = getAtsScoreDisplayInfo(91, context);
      expect(display.state).toBe('unknown');
      expect(display.label).toBe('Wynik historyczny: 91%');
      expect(display.note).not.toContain('NaN');
    }

    for (const context of [
      { ...valid, unmetBlockingRequirementCount: 4 },
      { ...valid, unconfirmedRequirementCount: 4 },
      { ...valid, unmetBlockingRequirementCount: 2, unconfirmedRequirementCount: 2 },
    ]) {
      expect(isValidAtsScoreContext(context)).toBe(false);
      expect(getAtsScoreDisplayInfo(91, context).state).toBe('unknown');
    }
  });

  it('nie pokazuje procentu, gdy zapisana wartość wyniku nie jest liczbą z zakresu 0–100', () => {
    const context = {
      detectedRequirementCount: 3,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5 as const,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2 as const,
    };

    for (const score of [null, Number.NaN, 101, -1]) {
      const display = getAtsScoreDisplayInfo(score, context);
      expect(display.state).toBe('unknown');
      expect(display.label).toBe('Niezweryfikowany wynik');
      expect(display.label).not.toContain('%');
      expect(display.note).not.toContain('NaN');
    }
  });

  it('zachowuje niepotwierdzony wymog spawalniczy jako ograniczenie zapisanego wyniku', () => {
    const vault = metadataOnlyVault();
    vault.skillsMatrix.hardSkills = ['spawanie TIG'];
    vault.skillsMatrix.toolsAndTech = ['palnik TIG'];
    vault.history[0].highlights = [{
      id: 'tig-work',
      text: 'Spawanie konstrukcji stalowych metodą TIG 141.',
      action: '',
      target: '',
      tool: '',
      metric: '',
      keywords: [],
    }];

    const result = scoreCanonicalAts(vault, 'Wymagane uprawnienia spawalnicze TIG.');
    const context = getAtsScoreContext(result, 100, true);

    expect(result.formalFindings.find((finding) => finding.label.includes('spawalnicze'))?.satisfied).toBe(false);
    expect(context?.unmetBlockingRequirementCount).toBe(1);
    expect(getAtsScoreDisplayInfo(result.score!, context).state).toBe('limited');
    expect(getAtsScoreDisplayInfo(result.score!, context).label).toBe(`Niepotwierdzony wymóg obowiązkowy: ${result.score}%`);
    expect(getAtsScoreDisplayInfo(result.score!, context).note).toContain('1 wymogu, który oferta oznacza jako obowiązkowy');
    expect(getAtsScoreDisplayInfo(result.score!, context).label).toBe(`Niepotwierdzony wymóg obowiązkowy: ${result.score}%`);
    expect(getAtsScoreDisplayInfo(result.score!, context).note).toContain('1 wymogu, który oferta oznacza jako obowiązkowy');
  });

  it('przenosi brak terminu waznosci do kontekstu aktualnego wyniku SEP', () => {
    const vault = metadataOnlyVault();
    vault.profiler.licenses = ['sep_1kv'];
    vault.skillsMatrix.hardSkills = ['elektromontaz', 'pomiary elektryczne', 'Python'];
    vault.history[0].description = 'Serwis instalacji elektrycznych i wykonywanie pomiarow.';

    const result = scoreCanonicalAts(vault, 'Wymagane aktualne uprawnienia SEP G1 do 1 kV. Wymagane doświadczenie z Python.');
    const context = getAtsScoreContext(result, 100, true);

    expect(result.state).toBe('SCORABLE');
    expect(result.formalFindings.some((finding) => !finding.satisfied && finding.label.includes('termin waznosci'))).toBe(true);
    expect(result.formalFindings.find((finding) => finding.label.includes('termin waznosci'))?.status).toBe('unknown');
    expect(result.components.formal).toBeNull();
    expect(result.missingRequirements.some((requirement) => requirement.includes('termin waznosci'))).toBe(false);
    expect(result.unconfirmedRequirements).toHaveLength(1);
    expect(context?.detectedRequirementCount).toBe(2);
    expect(context?.unmetBlockingRequirementCount).toBe(0);
    expect(context?.unconfirmedBlockingRequirementCount).toBe(1);
    expect(getAtsScoreDisplayInfo(result.score!, context).state).toBe('limited');
    expect(getAtsScoreDisplayInfo(result.score!, context).label).toBe('Wstępny wynik — niepełne dane formalne');
    expect(getAtsScoreDisplayInfo(result.score!, context).note).toContain('1 wymóg formalny wymaga potwierdzenia');
  });

  it('zachowuje niepewny wymagany staż w kontekście wyniku zapisanego do Pipeline', () => {
    const vault = metadataOnlyVault();
    vault.history[0].startDate = '';
    vault.history[0].endDate = '';
    vault.history[0].description = 'Obsługa systemów i rozwiązywanie problemów technicznych.';

    const result = scoreCanonicalAts(vault, 'Wymagania: Python, AWS, Docker. Minimum 3 years of experience.');
    const context = getAtsScoreContext(result, 100, hasCareerEvidence(vault));

    expect(result.state).toBe('SCORABLE');
    expect(result.unconfirmedRequirements).toContain('Min. 3 lata doświadczenia');
    expect(context?.unconfirmedBlockingRequirementCount).toBe(0);
    expect(context?.unconfirmedRequirementCount).toBe(1);
    expect(isValidAtsScoreContext(context)).toBe(true);
    expect(getAtsScoreDisplayInfo(result.score!, context).state).toBe('limited');
    expect(getAtsScoreDisplayInfo(result.score!, context).label).toBe('Wstępny wynik — wymagania do potwierdzenia');
    expect(getAtsScoreDisplayInfo(result.score!, context).note).toContain('1 wymóg wymaga potwierdzenia');
  });
});
