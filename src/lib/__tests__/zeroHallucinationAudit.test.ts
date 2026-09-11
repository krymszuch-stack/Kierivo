import { describe, it, expect } from 'vitest';
import { MasterVault } from '../../types';
import { generateAntiTemplateCoverLetter } from '../coverLetterEngine';
import { generateElevatorPitch } from '../elevatorPitchEngine';
import { getPitchHookVariations, getCoverLetterHookVariations, getCoverLetterCtaVariations } from '../phrasingVariations';
import { findSkillBridgeForGap, generateSkillBridges } from '../skillBridgeEngine';
import { extractProfileFromVault } from '../summaryEngine/extractor';
import { generateSummaries } from '../summaryEngine/generator';
import { extractSlotsFromHighlight, fillSlotSentence } from '../slotFillingEngine';
import { createInterviewSession, generateFollowUpEmail } from '../interviewLoopEngine';
import { createEmptyVault } from '../sampleVault';

describe('Zero-Hallucination Contract Suite (BUG-001 Verification)', () => {
  const createBlankVault = (title = 'Monter', name = 'Jan Kowalski'): MasterVault => {
    const vault = createEmptyVault(name, 'jan@example.com');
    vault.personalInfo = {
      fullName: name,
      title,
      summary: '',
      email: 'jan@example.com',
      phone: '123456789',
      location: 'Kraków',
    };
    vault.skillsMatrix = {
      hardSkills: [],
      toolsAndTech: [],
      softSkills: [],
      certifications: [],
    };
    vault.history = [];
    vault.education = [];
    vault.projects = [];
    return vault;
  };

  // Test 1: Pusty MasterVault nie generuje wymyślonych metryk
  it('Test 1: Pusty MasterVault nie generuje żadnych wymyślonych metryk ani stałych procentowych', () => {
    const emptyVault = createBlankVault('Magazynier');
    const letter = generateAntiTemplateCoverLetter('Magazynier WMS', 'LogiTrans', 'Opis oferty', emptyVault);

    expect(letter.fullText).not.toMatch(/35%/);
    expect(letter.fullText).not.toMatch(/wydajność operacyjną o ponad/i);
    expect(letter.proofPoints).toEqual([]);

    const pitch = generateElevatorPitch(emptyVault, 'Magazynier');
    expect(pitch.oneLiner).not.toMatch(/z wynikiem/i);
    expect(pitch.thirtySeconds).not.toMatch(/udokumentowan/i);
    expect(pitch.ninetySeconds).not.toMatch(/udokumentowane/i);
    expect(pitch.metricsUsed).toEqual([]);
  });

  // Test 2: Pusty MasterVault nie generuje fikcyjnych projektów/wdrożeń
  it('Test 2: Pusty MasterVault nie generuje fikcyjnych projektów produkcyjnych ani wdrożeń', () => {
    const emptyVault = createBlankVault('Spawacz');
    const letter = generateAntiTemplateCoverLetter('Spawacz TIG', 'Stocznia SA', 'Opis', emptyVault);

    expect(letter.fullText).not.toMatch(/wdrożyłem projekty produkcyjne/i);
    expect(letter.fullText).not.toMatch(/zoptymalizowałem kluczowe procesy/i);

    const pitch = generateElevatorPitch(emptyVault, 'Spawacz');
    expect(pitch.ninetySeconds).not.toMatch(/zidentyfikowałem wąskie gardła/i);
  });

  // Test 3: Brak RabbitMQ nie może skutkować deklaracją znajomości RabbitMQ
  it('Test 3: Brak RabbitMQ w MasterVault nie generuje deklaracji pracy z RabbitMQ', () => {
    const vaultWithoutRabbit = createBlankVault('Backend Developer');
    vaultWithoutRabbit.skillsMatrix.hardSkills = ['Node.js', 'PostgreSQL'];

    const bridge = findSkillBridgeForGap('Kafka', vaultWithoutRabbit);

    // Most nie może twierdzić, że kandydat pracował z RabbitMQ
    expect(bridge?.talkingPoint).not.toMatch(/pracowałem głównie z RabbitMQ/i);
    expect(bridge?.bridgeExplanation).not.toMatch(/znajomość RabbitMQ/i);
    expect(bridge?.adjacentSkill).not.toBe('RabbitMQ');
  });

  // Test 4: Brak Kafka + brak technologii pokrewnej nie tworzy syntetycznego bridge
  it('Test 4: Pusty profil (brak technologii) nie tworzy syntetycznego bridge z nieistniejącymi narzędziami', () => {
    const emptyVault = createBlankVault('Kandydat');
    const bridge = findSkillBridgeForGap('Kafka', emptyVault);

    expect(bridge).toBeUndefined();

    const bridges = generateSkillBridges(['Kafka', 'AWS', 'Kubernetes'], emptyVault);
    expect(bridges).toEqual([]);
  });

  // Test 5: Zero lat doświadczenia nie generuje „bogatego doświadczenia”
  it('Test 5: Zero lat doświadczenia nie generuje sformułowania "bogate doświadczenie"', () => {
    const zeroExpVault = createBlankVault('Junior Frontend Developer');
    zeroExpVault.skillsMatrix.hardSkills = ['HTML', 'CSS', 'JavaScript'];

    const profile = extractProfileFromVault(zeroExpVault);
    expect(profile.yearsOfExperience).toBe(0);

    const summaries = generateSummaries(profile, 5);
    expect(summaries.length).toBeGreaterThan(0);

    summaries.forEach((s) => {
      expect(s.text).not.toMatch(/bogatym doświadczeniem/i);
      expect(s.text).not.toMatch(/bogatym stażem/i);
    });
  });

  // Test 6: Brak danych nie generuje „3 zweryfikowanych filarów”
  it('Test 6: Brak zweryfikowanych twierdzeń nie generuje "3 zweryfikowanych filarów"', () => {
    const hooks = getPitchHookVariations({
      candidateName: 'Adam Nowak',
      roleTitle: 'Monter',
      verifiedClaimsCount: 0,
    });

    hooks.forEach((hook) => {
      expect(hook).not.toMatch(/3 zweryfikowanych/i);
      expect(hook).not.toMatch(/3 filarach/i);
    });
  });

  // Test 7: Brak Kubernetes nie generuje Kubernetes
  it('Test 7: Przetwarzanie fraz (Slot Filling) nie dopisuje Kubernetes bez dowodu w MasterVault', () => {
    const slot = extractSlotsFromHighlight('Praca z kontenerami i środowiskiem Docker');
    const filled = fillSlotSentence(slot, ['Docker', 'Kubernetes'], 'ACTION_FIRST');

    expect(filled).not.toMatch(/Kubernetes/i);
    expect(filled).not.toMatch(/\(Docker\/Kubernetes\)/i);
  });

  // Test 8: Brak interview notes nie generuje fikcyjnego tematu rozmowy
  it('Test 8: Brak notatek z rozmowy kwalifikacyjnej nie generuje wyzwań architektonicznych w mailu follow-up', () => {
    const session = createInterviewSession('Restauracja Smak', 'Kucharz');
    const email = generateFollowUpEmail(session, 'Jan Kowalski');

    expect(email).not.toMatch(/wyzwań architektonicznych/i);
    expect(email).not.toMatch(/planów rozwojowych zespołu/i);
  });

  // Test 9: Zawody rzemieślnicze/fizyczne nie generują automatycznie języka inżynierskiego
  it('Test 9: Zawody fizyczne (Spawacz, Kucharz, Magazynier) nie otrzymują sztywnych fraz inżynierskich', () => {
    const letterHooks = getCoverLetterHookVariations({
      candidateName: 'Piotr Wiśniewski',
      roleTitle: 'Spawacz MAG',
      companyName: 'Stal-Bud',
      topSkills: 'Spawanie metodą 135, Rysunek techniczny',
    });

    letterHooks.forEach((h) => {
      expect(h).not.toMatch(/wiedzę inżynierską/i);
      expect(h).not.toMatch(/solidność inżynierska/i);
    });

    const letterCtas = getCoverLetterCtaVariations('Stal-Bud');
    letterCtas.forEach((cta) => {
      expect(cta).not.toMatch(/warsztat inżynierski/i);
    });
  });

  // Test 10: Istniejące prawdziwe dane są poprawnie i w 100% wykorzystywane (Zero-Hallucination != Zero-Content)
  it('Test 10: Prawdziwe dane z MasterVault (metryki, narzędzia, projekty) są w pełni zachowane i wykorzystywane', () => {
    const richVault = createBlankVault('Senior DevOps Engineer', 'Michał Anioł');
    richVault.skillsMatrix.hardSkills = ['Kubernetes', 'Terraform', 'AWS'];
    richVault.skillsMatrix.toolsAndTech = ['GitLab CI', 'Prometheus'];
    richVault.history = [
      {
        id: 'exp_1',
        company: 'FinTech Cloud',
        role: 'Senior DevOps',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2023-12',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Zmniejszenie czasu wdrożeń o 45% dzięki automatyzacji pipeline CI/CD.',
            action: 'Zmniejszenie',
            target: 'czas wdrożeń',
            tool: 'GitLab CI',
            metric: '-45% czasu deploymentu',
            keywords: ['GitLab CI', 'CI/CD'],
          },
        ],
      },
    ];
    richVault.projects = [
      {
        id: 'proj_1',
        name: 'Chmura Hybrydowa',
        role: 'Lead Architect',
        description: 'Migracja 20 mikrousług do AWS.',
        techStack: ['AWS', 'Terraform'],
        metrics: '99.99% uptime',
        link: 'https://example.com',
      },
    ];

    // 1. Cover letter wykorzystuje realne proof points
    const letter = generateAntiTemplateCoverLetter('DevOps Engineer', 'TechCorp', 'Wymagamy AWS i Kubernetes', richVault);
    expect(letter.proofPoints.length).toBeGreaterThanOrEqual(1);
    expect(letter.proofPoints.some((p) => p.includes('FinTech Cloud'))).toBe(true);
    expect(letter.proofPoints.some((p) => p.includes('Zmniejszenie czasu wdrożeń o 45%'))).toBe(true);

    // 2. Elevator Pitch wykorzystuje realną metrykę
    const pitch = generateElevatorPitch(richVault, 'DevOps Engineer');
    expect(pitch.metricsUsed).toContain('-45% czasu deploymentu');
    expect(pitch.thirtySeconds).toContain('-45% czasu deploymentu');
    expect(pitch.ninetySeconds).toContain('-45% czasu deploymentu');

    // 3. SkillBridge dla AWS wykorzystuje istniejący Kubernetes z dowodem.
    // (Kafka ← Kubernetes nie ma definicji — taki most byłby fabrykacją F12.)
    const bridge = findSkillBridgeForGap('AWS', richVault);
    expect(bridge).toBeDefined();
    expect(bridge?.adjacentSkill).toBe('Kubernetes'); // z realnych hardSkills kandydata
  });
});
