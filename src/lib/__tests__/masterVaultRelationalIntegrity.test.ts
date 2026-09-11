import { describe, it, expect } from 'vitest';
import { MasterVault, LayeredFactItem } from '../../types';
import { handleFactEditPromotion, generatePreFlightChecklist } from '../layeredVaultEngine';
import { buildLocalInterviewCheatSheet } from '../interviewCheatSheetEngine';
import { generateSkillBridges } from '../skillBridgeEngine';
import { generateElevatorPitch } from '../elevatorPitchEngine';
import {
  extractClaimsFromVault,
  validateConsistency,
  renderCvFromClaims,
  renderHudFromClaims,
  renderPitchFromClaims,
  renderLinkedInFromClaims,
} from '../consistencyGuard/consistencyEngine';
import { mergeImportedVault } from '../vaultImportMerge';
import { parseTextToMasterVault } from '../cvUniversalParser';
import { getRelevanceOrderedExperienceIds } from '../relevanceRanking';
import { ParsedJobDescription } from '../jdParser';

function createFullRelationalVault(): MasterVault {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    profiler: {
      flags: ['PHYSICAL'],
      experienceLevel: 'SENIOR',
      location: {
        city: 'Kraków',
        radiusKm: 50,
        willingnessToTravel: true,
        hybridWork: true,
        remoteOnly: false,
      },
      languages: [
        { id: 'lang_1', language: 'Angielski', level: 'C1', context: 'Dokumentacja techniczna i rozmowy z klientami' },
        { id: 'lang_2', language: 'Niemiecki', level: 'B2', context: 'Komunikacja codzienna' },
      ],
    },
    personalInfo: {
      fullName: 'Janusz Inżynierski',
      title: 'Główny Inżynier Automatyki i HVAC',
      email: 'janusz.inz@przemysl.pl',
      phone: '+48 600 700 800',
      location: 'Kraków, Małopolskie',
      summary: 'Ekspert automatyki przemysłowej i instalacji HVAC z 10-letnim doświadczeniem.',
    },
    skillsMatrix: {
      hardSkills: [
        'Programowanie PLC',
        'Automatyka przemysłowa',
        'Montaż instalacji sanitarnych',
        'Pompy ciepła',
        'Diagnostyka HVAC',
      ],
      softSkills: ['Zarządzanie zespołem', 'Rozwiązywanie problemów', 'Komunikacja'],
      toolsAndTech: ['Siemens TIA Portal', 'SCADA', 'AutoCAD', 'Analizator spalin', 'F-Gazy'],
      certifications: [
        {
          id: 'cert_sep_1',
          name: 'Świadectwo Kwalifikacyjne SEP E+D do 1kV',
          issuer: 'Stowarzyszenie Elektryków Polskich',
          date: '2021',
        },
        {
          id: 'cert_fgaz_1',
          name: 'Certyfikat F-Gazy kategoria I',
          issuer: 'UDT',
          date: '2022',
        },
      ],
    },
    history: [
      {
        id: 'exp_hvac_1',
        company: 'Termo-Przemysł Sp. z o.o.',
        role: 'Kierownik Serwisu Automatyki i HVAC',
        location: 'Kraków',
        startDate: '2020-03',
        endDate: 'Obecnie',
        isCurrent: true,
        description: 'Zarządzanie serwisem instalacji przemysłowych.',
        highlights: [
          {
            id: 'hl_hvac_101',
            text: 'Wdrożenie 24 instalacji pomp ciepła o łącznej mocy 1.2 MW.',
            action: 'Wdrożenie',
            target: 'instalacje pomp ciepła',
            tool: 'Siemens TIA Portal',
            metric: '1.2 MW',
            keywords: ['Pompy ciepła', 'Siemens TIA Portal', 'Automatyka'],
          },
          {
            id: 'hl_hvac_102',
            text: 'Redukcja czasu przestojów awaryjnych o 35% dzięki predykcyjnej diagnostyce SCADA.',
            action: 'Redukcja',
            target: 'przestoje awaryjne',
            tool: 'SCADA',
            metric: '35%',
            keywords: ['SCADA', 'Diagnostyka HVAC'],
          },
        ],
      },
      {
        id: 'exp_hvac_2',
        company: 'Instal-Kraków S.A.',
        role: 'Inżynier Automatyk',
        location: 'Kraków',
        startDate: '2016-06',
        endDate: '2020-02',
        isCurrent: false,
        description: 'Programowanie sterowników PLC i montaż szaf.',
        highlights: [
          {
            id: 'hl_hvac_201',
            text: 'Zaprogramowanie sterowników PLC Siemens S7-1500 dla 8 linii technologicznych.',
            action: 'Programowanie',
            target: 'sterowniki PLC',
            tool: 'Siemens S7-1500',
            metric: '8 linii',
            keywords: ['Programowanie PLC', 'Siemens S7-1500'],
          },
        ],
      },
    ],
    education: [
      {
        id: 'edu_agh_1',
        institution: 'Akademia Górniczo-Hutniczej w Krakowie',
        degree: 'Magister Inżynier',
        fieldOfStudy: 'Automatyka i Robotyka',
        startDate: '2011',
        endDate: '2016',
        description: 'Specjalność: Automatyzacja Procesów Przemysłowych',
      },
    ],
    projects: [
      {
        id: 'proj_solarterm_1',
        name: 'Autonomiczna Ciepłownia Hybrydowa',
        role: 'Główny Projektant Automatyki',
        description: 'Projekt hybrydowego węzła cieplnego łączącego pompy ciepła i kolektory słoneczne.',
        techStack: ['Siemens TIA Portal', 'SCADA', 'Modbus TCP'],
        metrics: 'Oszczędność 40% energii cieplnej',
      },
    ],
    claims: [
      {
        id: 'claim_custom_1',
        sourceProject: 'Autonomiczna Ciepłownia Hybrydowa',
        dateRange: { start: '2021-01', end: '2022-06' },
        metric: '40%',
        tags: ['Pompy ciepła', 'Siemens TIA Portal', 'Oszczędność energii'],
      },
    ],
  };
}

describe('MasterVault Relational Data Integrity & Multi-Module Interoperability', () => {
  // Test 1: Relacje z silnikiem Layered Vault (edycja faktów i awans do MasterVault)
  it('1. LayeredVaultEngine: powiązanie LayeredFactItem z experienceId i highlight.id oraz awans edycji do MasterVault', () => {
    const vault = createFullRelationalVault();
    const targetExp = vault.history[0];
    const targetHl = targetExp.highlights[0];

    const factItem: LayeredFactItem = {
      id: 'fact_hvac_1',
      experienceId: targetExp.id,
      sourceFactId: targetHl.id,
      baseText: targetHl.text,
      jobReframedText: 'Kierowanie wdrożeniem 24 przemysłowych pomp ciepła o łącznej mocy 1.2 MW.',
      isUserEdited: false,
      sourceType: 'VAULT_BASE',
      keywordsMatched: ['Pompy ciepła'],
    };

    // Edycja faktu z promocją do MasterVault
    const newText = 'Wdrożenie 30 przemysłowych pomp ciepła o łącznej mocy 1.5 MW (zmodernizowany opis).';
    const { updatedVault, updatedFact } = handleFactEditPromotion(vault, factItem, newText, true);

    expect(updatedFact.userOverrideText).toBe(newText);
    expect(updatedFact.isUserEdited).toBe(true);
    expect(updatedFact.sourceType).toBe('USER_EDITED');

    // Weryfikacja czy w zaktualizowanym MasterVault odpowiedni highlight zmienił tekst
    const updatedExp = updatedVault.history.find((h) => h.id === targetExp.id);
    expect(updatedExp).toBeDefined();
    const updatedHl = updatedExp?.highlights.find((hl) => hl.id === targetHl.id);
    expect(updatedHl?.text).toBe(newText);

    // Weryfikacja pre-flight checklist
    const checklist = generatePreFlightChecklist(updatedVault, [updatedFact], [], 'Kierownik HVAC');
    expect(checklist.length).toBeGreaterThanOrEqual(4);
    expect(checklist.find((c) => c.id === 'chk_accuracy')?.status).toBe('PASSED');
    expect(checklist.find((c) => c.id === 'chk_metrics')?.status).toBe('PASSED');
  });

  // Test 2: Relacje z silnikiem Interview Cockpit & Cheat Sheet
  it('2. InterviewCheatSheetEngine: poprawne generowanie TalkingPoints z powiązaniem sourceExperienceId z MasterVault', () => {
    const vault = createFullRelationalVault();
    const mockJd: ParsedJobDescription = {
      jobTitle: 'Inżynier Automatyk HVAC',
      companyName: 'EcoEnergy Systems',
      seniorityLevel: 'SENIOR',
      requiredHardSkills: ['Programowanie PLC', 'Pompy ciepła', 'Uprawnienia SEP'],
      toolsAndTech: ['Siemens TIA Portal', 'SCADA'],
      languagesRequired: ['Angielski B2'],
      mandatoryRequirements: ['Uprawnienia SEP'],
      coreResponsibilities: ['Nadzór nad serwisem pomp ciepła'],
      requiredSoftSkills: ['Komunikacja'],
      workModel: 'HYBRID',
      salaryRange: '12 000 - 16 000 PLN',
      keyKeywords: ['Programowanie PLC', 'Pompy ciepła', 'Uprawnienia SEP', 'SCADA'],
    };

    const cheatSheet = buildLocalInterviewCheatSheet(mockJd, vault, 'Inżynier Automatyk HVAC', 'EcoEnergy Systems');

    expect(cheatSheet.companyName).toBe('EcoEnergy Systems');
    expect(cheatSheet.targetJobTitle).toBe('Inżynier Automatyk HVAC');
    expect(cheatSheet.glossary.length).toBeGreaterThan(0);

    // Weryfikacja Talking Points
    expect(cheatSheet.starTalkingPoints.length).toBeGreaterThan(0);
    const tpWithExp = cheatSheet.starTalkingPoints.find((tp) => tp.sourceExperienceId);
    if (tpWithExp && tpWithExp.sourceExperienceId) {
      const expExistsInVault = vault.history.some((h) => h.id === tpWithExp.sourceExperienceId);
      expect(expExistsInVault).toBe(true);
    }
  });

  // Test 3: Relacje z silnikiem Skill Bridge Matrix
  it('3. SkillBridgeEngine: most tylko z jawnej definicji i dowodu (brak fabrykacji)', () => {
    const vault = createFullRelationalVault();
    // Luki bez definicji w `BRIDGE_DEFINITIONS` nie dostają mostu-generyka
    // (`Excel → Kafka 75%`): brak mostu to poprawna odpowiedź, nie luka (F12).
    expect(generateSkillBridges(['Schneider EcoStruxure', 'BMS Desigo'], vault)).toEqual([]);

    // Kontrola pozytywna: luka z definicją i dowodem (Kubernetes ← Docker).
    const dockerVault = createFullRelationalVault();
    dockerVault.skillsMatrix.hardSkills = [...dockerVault.skillsMatrix.hardSkills, 'Docker'];
    dockerVault.history[0].highlights[0].keywords = [
      ...(dockerVault.history[0].highlights[0].keywords ?? []), 'Docker',
    ];
    const bridges = generateSkillBridges(['Kubernetes'], dockerVault);
    expect(bridges.length).toBeGreaterThan(0);

    for (const bridge of bridges) {
      expect(bridge.missingSkill).toBeDefined();
      expect(bridge.adjacentSkill).toBeDefined();
      expect(bridge.bridgeExplanation).toBeDefined();
      expect(bridge.confidenceScore).toBeGreaterThan(0);
      // Dowód z MasterVault powinien odwoływać się do rzeczywistego projektu/firmy lub certyfikatu
      if (bridge.evidenceFromVault) {
        const containsVaultFact =
          vault.history.some((h) => bridge.evidenceFromVault?.includes(h.company)) ||
          vault.projects.some((p) => bridge.evidenceFromVault?.includes(p.name)) ||
          vault.skillsMatrix.toolsAndTech.some((t) => bridge.evidenceFromVault?.includes(t)) ||
          vault.skillsMatrix.hardSkills.some((s) => bridge.evidenceFromVault?.includes(s));
        expect(containsVaultFact).toBe(true);
      }
    }
  });

  // Test 4: Relacje z silnikiem Elevator Pitch Generator
  it('4. ElevatorPitchEngine: 3 wersje pitchu z wykorzystaniem rzeczywistych metryk z MasterVault', () => {
    const vault = createFullRelationalVault();
    const pitch = generateElevatorPitch(vault, 'Senior Automatyk HVAC');

    expect(pitch.oneLiner.length).toBeGreaterThan(10);
    expect(pitch.thirtySeconds.length).toBeGreaterThan(50);
    expect(pitch.ninetySeconds.length).toBeGreaterThan(100);

    // Metryki użyte w pitchu powinny pochodzić z highlights lub projektów
    expect(pitch.metricsUsed.length).toBeGreaterThan(0);
    for (const m of pitch.metricsUsed) {
      const isMetricInVault =
        vault.history.some((h) => h.highlights.some((hl) => hl.metric === m || hl.text.includes(m))) ||
        vault.projects.some((p) => p.metrics?.includes(m)) ||
        vault.claims?.some((c) => c.metric === m);
      expect(isMetricInVault).toBe(true);
    }
  });

  // Test 5: Relacje z ClaimConsistencyGuard (spójność claimId i renderery)
  it('5. ClaimConsistencyGuard: ekstrakcja claimów i renderowanie CV, HUD, Pitch, LinkedIn bez sprzeczności', () => {
    const vault = createFullRelationalVault();

    // 1. Ekstrakcja claimów
    const claims = extractClaimsFromVault(vault);
    expect(claims.length).toBeGreaterThanOrEqual(4); // 1 z claims + 2 z history[0].hl + 1 z history[1].hl + 1 z proj

    // 2. Walidacja spójności (powinna przejść na czystym vaulcie)
    const validation = validateConsistency(vault);
    expect(validation.isConsistent).toBe(true);
    expect(validation.totalClaimsChecked).toBeGreaterThan(0);

    // 3. Renderery
    const cvRender = renderCvFromClaims(vault);
    expect(cvRender.sections.length).toBeGreaterThan(0);
    expect(cvRender.candidateName).toBe(vault.personalInfo.fullName);

    const hudRender = renderHudFromClaims(vault);
    expect(hudRender.verifiedMetrics.length).toBeGreaterThan(0);
    expect(hudRender.consistencyScore).toBeGreaterThanOrEqual(90);

    const pitchRender = renderPitchFromClaims(vault);
    expect(pitchRender.coreStrengths.length).toBeGreaterThan(0);
    expect(pitchRender.elevatorPitchText.length).toBeGreaterThan(30);

    const linkedInRender = renderLinkedInFromClaims(vault);
    expect(linkedInRender.experience.length).toBeGreaterThan(0);
    expect(linkedInRender.skills.length).toBeGreaterThan(0);
  });

  // Test 6: Relacje z relevance ranking (re-ranking pozycji historycznych wg relevance)
  it('6. RelevanceRanking: zachowanie 1:1 relacji identyfikatorów historii z MasterVault po re-rankingu', () => {
    const vault = createFullRelationalVault();
    const jdKeywords = ['Siemens S7-1500', 'Programowanie PLC', 'Sterowniki'];

    const rankedOrder = getRelevanceOrderedExperienceIds(vault.history, jdKeywords);
    expect(rankedOrder.length).toBe(vault.history.length);

    // Sprawdzamy czy każda pozycja w rankedOrder to poprawny ID z vault.history
    const vaultExpIds = new Set(vault.history.map((h) => h.id));
    for (const expId of rankedOrder) {
      expect(vaultExpIds.has(expId)).toBe(true);
    }

    // Druga pozycja (Instal-Kraków ze sterownikami S7-1500) powinna awansować na 1. miejsce pod ofertę PLC
    expect(rankedOrder[0]).toBe('exp_hvac_2');
  });

  // Test 7: Scalanie zaimportowanego CV z zachowaniem integralności relacyjnej MasterVault
  it('7. VaultImportMerge: scalenie nowego CV z MasterVault bez niszczenia istniejących referencji i ID', () => {
    const vault = createFullRelationalVault();
    const rawCvToImport = `
    Janusz Inżynierski
    janusz.inz@przemysl.pl | +48 600 700 800 | Kraków

    DOŚWIADCZENIE ZAWODOWE:
    Nowa Firma Automatyki Sp. z o.o. | Senior Automation Engineer
    01.2023 - obecnie
    - Projektowanie instalacji automatyki budynkowej BMS

    UMIEJĘTNOŚCI:
    BMS Desigo, Modbus RTU, BACnet

    CERTYFIKATY:
    Certyfikat Siemens Desigo CC - 2023
    `;

    const parsed = parseTextToMasterVault(rawCvToImport, 'TXT');
    const merged = mergeImportedVault(vault, {
      personalInfo: parsed.personalInfo,
      skillsMatrix: {
        hardSkills: parsed.hardSkills,
        softSkills: parsed.softSkills,
        toolsAndTech: parsed.toolsAndTech,
        certifications: parsed.certifications,
      },
      history: parsed.history,
      education: parsed.education,
    });

    // Istniejące pozycje nie zostały zniszczone
    expect(merged.history.length).toBe(3); // 2 stare + 1 nowa
    expect(merged.history.find((h) => h.id === 'exp_hvac_1')).toBeDefined();
    expect(merged.history.find((h) => h.id === 'exp_hvac_2')).toBeDefined();

    // Nowe umiejętności zostały dopisane bez duplikatów
    expect(merged.skillsMatrix.hardSkills).toContain('BMS Desigo');
    expect(merged.skillsMatrix.hardSkills).toContain('Programowanie PLC');

    // Nowy certyfikat został dopisany z unikalnym ID
    expect(merged.skillsMatrix.certifications.length).toBe(3); // 2 stare + 1 nowy
    const newCert = merged.skillsMatrix.certifications.find((c) => c.name.includes('Desigo CC'));
    expect(newCert).toBeDefined();
    expect(newCert?.id).toBeDefined();
  });
});
