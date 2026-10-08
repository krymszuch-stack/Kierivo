import { describe, it, expect } from 'vitest';
import {
  parseDateToDecimalYear,
  parseDateRangeToYears,
  calculateYearsDifference,
  detectSkillContradictions,
  validateConsistency,
  renderCvFromClaims,
  renderHudFromClaims,
  renderPitchFromClaims,
  renderLinkedInFromClaims,
  projectRendererOutputs,
  extractClaimsFromVault,
  MAX_ALLOWED_YEAR_DIFFERENCE,
} from '../consistencyGuard';
import { MasterVault } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('ConsistencyGuard Engine', () => {
  it('HUD odróżnia brak czytelnych okresów od zerowego stażu', () => {
    expect(renderHudFromClaims(createEmptyVault()).timelineCoverageYears).toBeNull();
    const vault = createMockVault();
    vault.history = [{ ...vault.history[0], startDate: 'nie wiem', endDate: '2022-01' }];
    expect(renderHudFromClaims(vault).timelineCoverageYears).toBeNull();
    expect(renderHudFromClaims(vault).timelineExcludedEntries).toBe(1);
  });

  it('HUD nie dopisuje końca niekompletnej roli ani przyszłego stażu', () => {
    const vault = createMockVault();
    vault.history = [{ ...vault.history[0], startDate: '2020-01', endDate: '' }];
    expect(renderHudFromClaims(vault).timelineCoverageYears).toBeNull();
    vault.history[0].endDate = '2099-01';
    expect(renderHudFromClaims(vault).timelineCoverageYears).toBeNull();
  });

  it('HUD ujawnia pominięcie nieczytelnego wpisu przy częściowo policzalnym zakresie', () => {
    const vault = createMockVault();
    vault.history[1].startDate = 'nie wiem';
    const hud = renderHudFromClaims(vault);
    expect(hud.timelineCoverageYears).toBe(2);
    expect(hud.timelineExcludedEntries).toBe(1);
  });

  it('odrzuca niepoprawne miesiące i dni zamiast obcinać je do zakresu', () => {
    for (const invalid of ['2020-00', '2020-13', '2020-13-99', '2020-02-30']) {
      expect(parseDateToDecimalYear(invalid)).toBeNull();
    }
    expect(parseDateToDecimalYear('2020-02-29')).toBeCloseTo(2020 + 1.5 / 12, 5);
    expect(parseDateToDecimalYear('2020-02')).toBeCloseTo(2020 + 1.5 / 12, 5);
  });

  const createMockVault = (): MasterVault => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo.title = 'Senior Full-Stack Engineer';
    vault.skillsMatrix.hardSkills = ['TypeScript', 'React', 'Node.js', 'PostgreSQL'];
    vault.skillsMatrix.toolsAndTech = ['Docker', 'Git', 'AWS'];
    vault.history = [
      {
        id: 'exp_1',
        company: 'Cloud Corp',
        role: 'Senior Developer',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2023-01', // Dokładnie 2.0 lata
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Wzrost wydajności API o 40% w architekturze mikroserwisowej.',
            action: 'Wdrożenie',
            target: 'API',
            tool: 'Node.js',
            metric: '+40% TPS',
            keywords: ['TypeScript', 'Node.js', 'PostgreSQL'],
          },
        ],
      },
      {
        id: 'exp_2',
        company: 'Tech Innovators',
        role: 'Lead Architect',
        location: 'Kraków',
        startDate: '2023-02',
        endDate: '2024-08', // 1.5 roku
        isCurrent: false,
        highlights: [
          {
            id: 'hl_2',
            text: 'Budowa portalu w React z czasem ładowania < 1s.',
            action: 'Architektura',
            target: 'Frontend',
            tool: 'React',
            metric: '<1s LCP',
            keywords: ['React', 'TypeScript', 'TailwindCSS'],
          },
        ],
      },
    ];
    vault.projects = [
      {
        id: 'proj_1',
        name: 'System Analityczny ATS',
        role: 'Główny Inżynier',
        description: 'Autorski silnik rankingowy ATS.',
        techStack: ['TypeScript', 'Vitest'],
        metrics: '99.9% uptime',
      },
    ];
    return vault;
  };

  describe('Parsowanie dat i obliczanie różnicy w latach', () => {
    it('nie rozcina pojedynczej daty ISO i zachowuje daty wewnątrz zakresu tekstowego', () => {
      expect(parseDateRangeToYears('2020-01')?.durationYears).toBeCloseTo(1 / 12, 5);
      for (const range of ['2020-01 – 2022-01', '2020-01 - 2022-01', '2020-01-2022-01', '01/2020 / 01/2022']) {
        expect(parseDateRangeToYears(range)?.durationYears).toBeCloseTo(2, 5);
      }
      expect(parseDateRangeToYears({ start: '2022-01', end: '2020-01' })).toBeNull();
    });
    it('poprawnie oblicza czas trwania dla formatu YYYY-MM', () => {
      const parsed = parseDateRangeToYears({ start: '2021-01', end: '2023-01' });
      expect(parsed).not.toBeNull();
      expect(parsed?.durationYears).toBeCloseTo(2.0, 1);
    });

    it('zwraca różnicę <= 0.5 roku dla nieznacznych rozbieżności', () => {
      const rangeA = { start: '2021-01', end: '2023-01' }; // 2.0 lata
      const rangeB = { start: '2021-01', end: '2023-04' }; // 2.25 roku (różnica 0.25 roku)
      const diff = calculateYearsDifference(rangeA, rangeB);
      expect(diff).toBeLessThanOrEqual(MAX_ALLOWED_YEAR_DIFFERENCE);
    });

    it('zwraca różnicę > 0.5 roku gdy rozbieżność przekracza 6 miesięcy', () => {
      const rangeA = { start: '2021-01', end: '2023-01' }; // 2.0 lata
      const rangeB = { start: '2021-01', end: '2024-01' }; // 3.0 lata (różnica 1.0 roku)
      const diff = calculateYearsDifference(rangeA, rangeB);
      expect(diff).toBeGreaterThan(MAX_ALLOWED_YEAR_DIFFERENCE);
    });
  });

  describe('Ekstrakcja claimów z MasterVault', () => {
    it('nie zamienia numeru wersji ani daty w metrykę osiągnięcia', () => {
      const vault = createMockVault();
      vault.history[0].highlights[0].text = 'Obsługa Windows 11 od 2022 roku.';
      vault.history[0].highlights[0].metric = '';
      const claim = extractClaimsFromVault(vault).find(item => item.id === 'hl_1');
      expect(claim?.metric).toBeUndefined();
      vault.history[0].highlights[0].metric = '20%';
      expect(extractClaimsFromVault(vault).find(item => item.id === 'hl_1')?.metric).toBe('20%');
    });
    it('ekstrahuje powiązane claimy z historii i projektów', () => {
      const vault = createMockVault();
      const claims = extractClaimsFromVault(vault);
      expect(claims.length).toBeGreaterThanOrEqual(3);

      const expClaim = claims.find((c) => c.id === 'claim_exp_exp_1');
      expect(expClaim).toBeDefined();
      expect(expClaim?.sourceProject).toBe('Cloud Corp');
      expect(expClaim?.tags).toContain('TypeScript');
    });
  });

  describe('Wykrywanie sprzeczności w skillach (Skill Contradictions)', () => {
    it.each(['Brak znajomości SQL', 'No SQL', 'Bez SEP', 'Brak uprawnień', 'Brak prawa jazdy'])('nie traktuje samej negacji %s jako dodatniej kompetencji', (tag) => {
      const claim = { id: 'negative', sourceProject: 'Profil testowy', tags: [tag] };
      expect(detectSkillContradictions(claim, [claim], [tag])).toEqual([]);
    });

    it('nie tworzy konfliktu między dwoma zgodnymi deklaracjami braku SEP', () => {
      const claim = { id: 'a', sourceProject: 'Monter', tags: ['Bez SEP'], dateRange: '2020 – 2022' };
      const other = { ...claim, id: 'b', sourceProject: 'Magazynier' };
      expect(detectSkillContradictions(claim, [claim, other])).toEqual([]);
    });

    it('wykrywa polską negację uprawnień wobec dodatniego SEP', () => {
      const claim = { id: 'a', sourceProject: 'Monter', tags: ['Brak uprawnień', 'SEP G1'] };
      expect(detectSkillContradictions(claim, [claim]).length).toBeGreaterThan(0);
    });

    it('nie utożsamia negacji Java z deklaracją JavaScript w macierzy', () => {
      const claim = { id: 'a', sourceProject: 'Projekt', tags: ['Nie znam Java'] };
      expect(detectSkillContradictions(claim, [claim], ['JavaScript'])).toEqual([]);
      expect(detectSkillContradictions(claim, [claim], ['Java']).length).toBeGreaterThan(0);
    });

    it('zachowuje dodatni dowód oddzielony od negacji średnikiem', () => {
      const claim = { id: 'a', sourceProject: 'Spawacz', tags: ['Bez SEP; SEP G1'] };
      expect(detectSkillContradictions(claim, [claim]).length).toBeGreaterThan(0);
    });
    it('wykrywa sprzeczność tagu negującego bazę danych z tagiem SQL', () => {
      const claim = {
        id: 'claim_conflict',
        sourceProject: 'Projekt X',
        dateRange: { start: '2022-01', end: '2023-01' },
        tags: ['Brak znajomości SQL', 'PostgreSQL Expert'],
      };
      const issues = detectSkillContradictions(claim, [claim]);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('SQL');
    });

    it('wykrywa sprzeczność deklaracji junior-only ze stanowiskiem Senior/Architect', () => {
      const claim = {
        id: 'claim_conflict_junior',
        sourceProject: 'Projekt Y',
        dateRange: { start: '2022-01', end: '2023-01' },
        tags: ['Tylko Junior', 'Lead Architect'],
      };
      const issues = detectSkillContradictions(claim, [claim]);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('Junior');
    });
  });

  describe('Główny walidator (validateConsistency)', () => {
    it.each(['cv', 'hud', 'pitch'])('nie potwierdza całości, gdy sekcja %s odwołuje się do brakującego faktu', (sectionId) => {
      const result = validateConsistency(createEmptyVault(), { projectedItems: [{
        sectionId, sectionName: sectionId, claimId: 'missing',
      }] });
      expect(result.sections[sectionId].isConsistent).toBe(false);
      expect(result.isConsistent).toBe(false);
    });

    it('nie potwierdza listy nieistniejących faktów', () => {
      const result = validateConsistency(createEmptyVault(), { claimIdsToCheck: ['missing'] });
      expect(result.isConsistent).toBe(false);
    });
    it.each(['cv', 'hud', 'pitch'])('odrzuca zmienioną metrykę projekcji %s', (sectionId) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [], metric: '20%' }];
      const result = validateConsistency(vault, { projectedItems: [{
        sectionId, sectionName: sectionId, claimId: 'metric', claimedMetric: '40%',
      }] });
      expect(result.isConsistent).toBe(false);
      expect(result.sections[sectionId].isConsistent).toBe(false);
      expect(result.alerts.some(item => item.type === 'METRIC_MISMATCH')).toBe(true);
    });

    it.each(['cv', 'hud', 'pitch'])('odrzuca usuniętą metrykę projekcji %s', (sectionId) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [], metric: '20%' }];
      const result = validateConsistency(vault, { projectedItems: [{
        sectionId, sectionName: sectionId, claimId: 'metric',
      }] });
      expect(result.isConsistent).toBe(false);
      expect(result.sections[sectionId].isConsistent).toBe(false);
      expect(result.alerts.some(item => item.type === 'METRIC_MISMATCH')).toBe(true);
    });

    it.each(['cv', 'hud', 'pitch'])('sprawdza rzeczywistą metrykę wyjścia renderera %s', (renderer) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [], metric: '20%' }];
      const cv = renderCvFromClaims(vault);
      const hud = renderHudFromClaims(vault);
      const pitch = renderPitchFromClaims(vault);
      if (renderer === 'cv') cv.sections[0].items[0].metric = '40%';
      if (renderer === 'hud') hud.verifiedMetrics[0].value = '40%';
      if (renderer === 'pitch') pitch.profileStatements[0].metric = '40%';
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(cv, hud, pitch, ['metric']),
      });
      expect(result.isConsistent).toBe(false);
      expect(result.alerts.some(item => item.type === 'METRIC_MISMATCH')).toBe(true);
    });

    it('nie ukrywa usuniętej metryki przez brak pozycji w HUD', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [], metric: '20%' }];
      const hud = renderHudFromClaims(vault);
      hud.verifiedMetrics = [];
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(renderCvFromClaims(vault), hud, renderPitchFromClaims(vault), ['metric']),
      });
      expect(result.sections.hud.isConsistent).toBe(false);
    });

    it.each(['cv', 'pitch'])('wykrywa usunięcie całego faktu bez metryki z %s', (renderer) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'plain', sourceProject: 'Projekt testowy', tags: [] }];
      const cv = renderCvFromClaims(vault);
      const pitch = renderPitchFromClaims(vault);
      if (renderer === 'cv') cv.sections = [];
      else pitch.profileStatements = [];
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(cv, renderHudFromClaims(vault), pitch, ['plain']),
      });
      expect(result.sections[renderer].isConsistent).toBe(false);
      expect(result.isConsistent).toBe(false);
    });

    it('wykrywa usunięcie daty CV zamiast traktować sentinel jako brak kontroli', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'dated', sourceProject: 'Projekt testowy', tags: [], dateRange: '2020-2022' }];
      const cv = renderCvFromClaims(vault);
      cv.sections[0].items[0].dateRangeDisplay = 'Daty niepodane w profilu';
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(cv, renderHudFromClaims(vault), renderPitchFromClaims(vault), ['dated']),
      });
      expect(result.sections.cv.isConsistent).toBe(false);
      expect(result.alerts.some(item => item.type === 'INVALID_DATE_RANGE')).toBe(true);
    });

    it.each([0, 2, NaN])('odrzuca niezgodny licznik HUD %s dla faktu bez metryki i tagów', (count) => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'plain', sourceProject: 'Projekt testowy', tags: [] }];
      const hud = renderHudFromClaims(vault);
      hud.activeClaimsCount = count;
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(renderCvFromClaims(vault), hud, renderPitchFromClaims(vault), ['plain']),
      });
      expect(result.sections.hud.isConsistent).toBe(false);
      expect(result.isConsistent).toBe(false);
    });

    it('odrzuca licznik HUD zmyślonych faktów przy pustym profilu', () => {
      const vault = createEmptyVault();
      const hud = renderHudFromClaims(vault);
      hud.activeClaimsCount = 1;
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(renderCvFromClaims(vault), hud, renderPitchFromClaims(vault), []),
      });
      expect(result.sections.hud.isConsistent).toBe(false);
    });

    it('akceptuje rzeczywiste wyjścia rendererów bez metryk i dat', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'plain', sourceProject: 'Projekt testowy', tags: [] }];
      const result = validateConsistency(vault, {
        projectedItems: projectRendererOutputs(renderCvFromClaims(vault), renderHudFromClaims(vault), renderPitchFromClaims(vault), ['plain']),
      });
      expect(result.isConsistent).toBe(true);
    });

    it('nie potwierdza metryki dopisanej do claimu bez wyniku źródłowego', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [] }];
      const result = validateConsistency(vault, { projectedItems: [{
        sectionId: 'cv', sectionName: 'CV', claimId: 'metric', claimedMetric: '40%',
      }] });
      expect(result.isConsistent).toBe(false);
    });

    it('akceptuje identyczny zapis metryki po normalizacji odstępów', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'metric', sourceProject: 'Projekt testowy', tags: [], metric: '20 sztuk dziennie' }];
      const result = validateConsistency(vault, { projectedItems: [{
        sectionId: 'cv', sectionName: 'CV', claimId: 'metric', claimedMetric: ' 20  sztuk\n dziennie ',
      }] });
      expect(result.isConsistent).toBe(true);
    });
    it('nie potwierdza dodanych w projekcji dat, gdy źródło nie podało okresu', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'undated', sourceProject: 'Projekt testowy', tags: [] }];
      const result = validateConsistency(vault, { skipTimelineAudit: true, projectedItems: [{
        sectionId: 'cv', sectionName: 'CV', claimId: 'undated', claimedDateRange: '2020 – 2022',
      }] });
      expect(result.isConsistent).toBe(false);
      expect(result.alerts[0].type).toBe('INVALID_DATE_RANGE');
    });
    it.each(['cv', 'hud', 'pitch'])('wykrywa przesunięte daty mimo identycznego czasu trwania w %s', (sectionId) => {
      const result = validateConsistency(createMockVault(), {
        skipTimelineAudit: true,
        projectedItems: [{ sectionId, sectionName: sectionId, claimId: 'claim_exp_exp_1',
          claimedDateRange: { start: '2018-01', end: '2020-01' } }],
      });
      expect(result.isConsistent).toBe(false);
      expect(result.sections[sectionId].isConsistent).toBe(false);
      expect(result.alerts.some(alert => alert.type === 'DATE_MISMATCH')).toBe(true);
    });

    it.each([
      { start: '2023-01', end: '2021-01' },
      { start: '2021-13', end: '2023-01' },
    ])('nie potwierdza zgodności niepoprawnego zakresu projekcji %j', (claimedDateRange) => {
      const result = validateConsistency(createMockVault(), {
        skipTimelineAudit: true,
        projectedItems: [{ sectionId: 'cv', sectionName: 'CV', claimId: 'claim_exp_exp_1', claimedDateRange }],
      });
      expect(result.isConsistent).toBe(false);
      expect(result.sections.cv.isConsistent).toBe(false);
      expect(result.alerts.some(alert => alert.type === 'INVALID_DATE_RANGE')).toBe(true);
    });
    it('zwraca isConsistent: true gdy wszystkie projekcje są zgodne z MasterVault', () => {
      const vault = createMockVault();
      const result = validateConsistency(vault, {
        projectedItems: [
          {
            sectionId: 'cv',
            sectionName: 'Doświadczenie CV',
            claimId: 'claim_exp_exp_1',
            claimedDateRange: { start: '2021-01', end: '2023-01' }, // 2.0 lata (zgodne z exp_1)
            claimedTags: ['TypeScript', 'Node.js'],
            claimedMetric: '+40% TPS',
          },
        ],
      });

      expect(result.isConsistent).toBe(true);
      expect(result.alerts).toHaveLength(0);
      expect(result.sections.cv.isConsistent).toBe(true);
    });

    it('generuje ALERT DATE_MISMATCH gdy różnica w latach przekracza 0.5 roku', () => {
      const vault = createMockVault();
      const result = validateConsistency(vault, {
        projectedItems: [
          {
            sectionId: 'cv',
            sectionName: 'Doświadczenie CV',
            claimId: 'claim_exp_exp_1',
            claimedDateRange: { start: '2020-01', end: '2023-01' }, // 3.0 lata vs 2.0 w Vault (różnica 1.0 > 0.5)
          },
        ],
      });

      expect(result.isConsistent).toBe(false);
      const dateAlert = result.alerts.find((a) => a.type === 'DATE_MISMATCH');
      expect(dateAlert).toBeDefined();
      expect(dateAlert?.severity).toBe('ALERT');
      expect(dateAlert?.details?.differenceYears).toBeGreaterThan(0.5);
    });

    it('generuje ALERT SKILL_CONTRADICTION w przypadku sprzecznych kompetencji', () => {
      const vault = createMockVault();
      const result = validateConsistency(vault, {
        projectedItems: [
          {
            sectionId: 'hud',
            sectionName: 'Wskaźniki HUD',
            claimId: 'claim_exp_exp_1',
            claimedTags: ['Brak znajomości SQL', 'PostgreSQL'],
          },
        ],
      });

      expect(result.isConsistent).toBe(false);
      const skillAlert = result.alerts.find((a) => a.type === 'SKILL_CONTRADICTION');
      expect(skillAlert).toBeDefined();
      expect(skillAlert?.severity).toBe('ALERT');
    });

    it('generuje ostrzeżenie gdy claimId nie istnieje w MasterVault', () => {
      const vault = createMockVault();
      const result = validateConsistency(vault, {
        claimIdsToCheck: ['claim_nieistniejacy_123'],
      });

      const missingAlert = result.alerts.find((a) => a.type === 'CLAIM_NOT_FOUND');
      expect(missingAlert).toBeDefined();
    });
  });

  describe('Renderery pobierające dane z MasterVault przez claimId', () => {
    it('każdy renderer wybiera fakt tylko raz także po aliasie, bez brakujących ID', () => {
      const vault = createMockVault();
      const ids = ['claim_exp_exp_1', 'exp_1', 'missing'];
      expect(renderCvFromClaims(vault, ids).sections.flatMap(section => section.items)).toHaveLength(1);
      expect(renderHudFromClaims(vault, ids).verifiedMetrics).toHaveLength(1);
      expect(renderPitchFromClaims(vault, ids).profileStatements).toHaveLength(1);
      expect(renderLinkedInFromClaims(vault, ids).experience).toHaveLength(1);
    });

    it('szkic LinkedIn nie wywodzi biegłości ani weryfikacji z obecności tagów', () => {
      const vault = createEmptyVault();
      vault.claims = [{ id: 'tag-only', sourceProject: 'Projekt testowy', tags: ['SEP', 'Java'] }];
      const output = renderLinkedInFromClaims(vault);
      expect(output.headline).toBe('Profil zawodowy');
      expect(output.about).not.toMatch(/zweryfikowan|kluczowych wdrożeniach/);
      expect(output.headline).not.toContain('Ekspert');
      expect(output.experience[0].description).toContain('W profilu');
    });
    it('HUD liczy wyłącznie unikalne odnalezione fakty i nie wytwarza procentu spójności', () => {
      const vault = createMockVault();
      const output = renderHudFromClaims(vault, ['claim_exp_exp_1', 'claim_exp_exp_1', 'missing']);
      expect(output.activeClaimsCount).toBe(1);
      expect(output).not.toHaveProperty('consistencyScore');
      expect(renderHudFromClaims(createEmptyVault(), ['missing']).activeClaimsCount).toBe(0);
    });
    it('renderCvFromClaims tworzy sekcje CV oparte na powiązaniach claimId', () => {
      const vault = createMockVault();
      const cvOutput = renderCvFromClaims(vault, ['claim_exp_exp_1', 'claim_proj_proj_1']);

      expect(cvOutput.candidateName).toBe('Jan Kowalski');
      expect(cvOutput.sections.length).toBeGreaterThan(0);
      const items = cvOutput.sections.flatMap((s) => s.items);
      expect(items.some((i) => i.claimId === 'claim_exp_exp_1')).toBe(true);
      expect(items.some((i) => i.project === 'Cloud Corp')).toBe(true);
    });

    it('renderHudFromClaims agreguje metryki i skille z claimów', () => {
      const vault = createMockVault();
      const hudOutput = renderHudFromClaims(vault, ['claim_exp_exp_1', 'claim_exp_exp_2']);

      expect(hudOutput.activeClaimsCount).toBe(2);
      expect(hudOutput.timelineCoverageYears).toBeGreaterThanOrEqual(3.0);
      expect(hudOutput.skillsRadar.some((s) => s.skill === 'TypeScript')).toBe(true);
      expect(hudOutput).not.toHaveProperty('consistencyScore');
    });

    it('renderPitchFromClaims generuje pitch z jawnie wskazanych wpisów profilu', () => {
      const vault = createMockVault();
      const pitchOutput = renderPitchFromClaims(vault, ['claim_exp_exp_1', 'claim_exp_exp_2']);

      expect(pitchOutput.hook).toContain('Jan Kowalski');
      expect(pitchOutput.profileStatements).toHaveLength(2);
      expect(pitchOutput.elevatorPitchText).toContain('Cloud Corp');
      expect(pitchOutput.callToAction).toBeTruthy();
    });

    it('renderLinkedInFromClaims generuje profil z pozycjami powiązanymi z claimId', () => {
      const vault = createMockVault();
      const linkedIn = renderLinkedInFromClaims(vault, ['claim_exp_exp_1', 'claim_exp_exp_2']);

      expect(linkedIn.headline).toContain('Full-Stack');
      expect(linkedIn.experience.length).toBe(2);
      expect(linkedIn.experience[0].company).toBe('Cloud Corp');
      expect(linkedIn.skills).toContain('TypeScript');
    });
  });
});

describe('Daty claimów z profilu', () => {
  it('nie tworzy dat zatrudnienia ani projektu, gdy profil ich nie zawiera', () => {
    const vault = createEmptyVault('Jan Testowy', 'jan@example.test');
    vault.history = [{
      id: 'exp_missing_dates',
      company: 'Firma Testowa',
      role: 'Tester',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      highlights: [{
        id: 'highlight_missing_dates',
        text: 'Obsługa systemu testowego.',
        action: 'Obsługa',
        target: 'system',
        tool: 'System testowy',
        metric: '',
        keywords: ['system testowy'],
      }],
    }];
    vault.projects = [{
      id: 'project_without_dates',
      name: 'Projekt bez dat',
      role: 'Autor',
      description: 'Opis projektu testowego.',
      techStack: ['TypeScript'],
    }];

    const claims = extractClaimsFromVault(vault);
    const experienceClaim = claims.find((claim) => claim.id === 'claim_exp_exp_missing_dates');
    const projectClaim = claims.find((claim) => claim.id === 'claim_proj_project_without_dates');

    expect(experienceClaim?.dateRange).toBeUndefined();
    expect(projectClaim?.dateRange).toBeUndefined();
    expect(renderCvFromClaims(vault).sections.flatMap((section) => section.items)
      .every((item) => item.dateRangeDisplay === 'Daty niepodane w profilu')).toBe(true);
    expect(renderLinkedInFromClaims(vault).experience
      .every((item) => item.dateRange === 'Daty niepodane w profilu')).toBe(true);
  });
});

describe('Treść pitcha z claimów profilu', () => {
  it('nie zamienia liczby claimów ani samych tagów w twierdzenia o biegłości i zweryfikowanym doświadczeniu', () => {
    const vault = createEmptyVault('Jan Testowy', 'jan@example.test');
    vault.projects = [{
      id: 'project-tags-only',
      name: 'Projekt testowy',
      role: 'Autor',
      description: 'Wpis projektowy bez opisu zadań.',
      techStack: ['TypeScript', 'React'],
    }];

    const riskyClaims = ['zweryfikowan', 'specjalizuj', 'doświadczenie', 'wdrożen', 'osiągnąłem', 'mierzaln', 'od lat', 'bezwzględn', 'natychmiast'];
    for (let variantIndex = 0; variantIndex < 6; variantIndex += 1) {
      const pitch = renderPitchFromClaims(vault, undefined, 'Tester', variantIndex);
      for (const phrase of riskyClaims) {
        expect(pitch.elevatorPitchText.toLocaleLowerCase('pl-PL')).not.toContain(phrase);
      }
      expect(pitch.profileStatements[0]?.statement).toContain('W profilu');
      expect(pitch.profileStatements[0]?.statement).toContain('TypeScript');
    }
  });
});
