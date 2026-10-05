import { describe, it, expect } from 'vitest';
import {
  resolveRoleKnowledgeNode,
  getAllRoleKnowledgeNodes,
  generateExperienceVariants,
  formatActionWord,
  validateExperienceFact,
  ExperienceFact,
  POLISH_VERB_FORMS,
} from '../experienceEngine';
import { getPolishStem, stripDiacriticsLower } from '../skillEvidence';

describe('Silnik Mikro-Wywiadu Doświadczenia (ExperienceEngine)', () => {
  it('udostępnia co najmniej 16 bogatych węzłów profesji w grafie wiedzy', () => {
    const all = getAllRoleKnowledgeNodes();
    expect(all.length).toBeGreaterThanOrEqual(16);
    expect(all.map((r) => r.roleId)).toContain('trades_technician');
    expect(all.map((r) => r.roleId)).toContain('electrician_automation');
    expect(all.map((r) => r.roleId)).toContain('welder_fitter');
    expect(all.map((r) => r.roleId)).toContain('warehouse_logistics');
    expect(all.map((r) => r.roleId)).toContain('driver_transport');
    expect(all.map((r) => r.roleId)).toContain('automotive_mechanic');
    expect(all.map((r) => r.roleId)).toContain('construction_finishing');
    expect(all.map((r) => r.roleId)).toContain('cnc_production');
    expect(all.map((r) => r.roleId)).toContain('finance_accounting');
    expect(all.map((r) => r.roleId)).toContain('sales_b2b');
    expect(all.map((r) => r.roleId)).toContain('customer_service');
    expect(all.map((r) => r.roleId)).toContain('medical_healthcare');
    expect(all.map((r) => r.roleId)).toContain('software_engineer');
    expect(all.map((r) => r.roleId)).toContain('devops_sysadmin');
    expect(all.map((r) => r.roleId)).toContain('project_management');
    expect(all.map((r) => r.roleId)).toContain('general_role');
  });

  it('poprawnie rozpoznaje węzeł grafu dla roli Software Engineer', () => {
    const node = resolveRoleKnowledgeNode('Senior Fullstack Engineer');
    expect(node.roleId).toBe('software_engineer');
    expect(node.areas.map((a) => a.id)).toContain('backend');
    expect(node.actions.backend).toContain('projektowałem architekturę');
  });

  it('poprawnie rozpoznaje węzeł grafu dla montera HVAC i instalatora', () => {
    const node = resolveRoleKnowledgeNode('Monter Instalacji HVAC i Pomp Ciepła');
    expect(node.roleId).toBe('trades_technician');
    expect(node.areas.map((a) => a.id)).toContain('hvac_installation');
    expect(node.actions.hvac_installation).toContain('montowałem');
  });

  it('poprawnie rozpoznaje węzeł grafu dla spawacza TIG / MAG (Reguła 8)', () => {
    const node = resolveRoleKnowledgeNode('Spawacz TIG 141 Rurociągów');
    expect(node.roleId).toBe('welder_fitter');
    expect(node.areas.map((a) => a.id)).toContain('tig_welding');
    expect(node.defaultTech.tig_welding).toContain('Gaz osłonowy Argon');
  });

  it('poprawnie rozpoznaje węzeł grafu dla magazyniera i operatora wózka UDT (Reguła 8)', () => {
    const node = resolveRoleKnowledgeNode('Magazynier - Operator Wózka Widłowego UDT');
    expect(node.roleId).toBe('warehouse_logistics');
    expect(node.areas.map((a) => a.id)).toContain('forklift_high_rack');
    expect(node.defaultTech.forklift_high_rack).toContain('Wózki UDT (I WJO / II WJO)');
  });

  it('poprawnie rozpoznaje węzeł grafu dla elektryka z uprawnieniami SEP', () => {
    const node = resolveRoleKnowledgeNode('Elektryk Pomiarowiec SEP G1');
    expect(node.roleId).toBe('electrician_automation');
    expect(node.areas.map((a) => a.id)).toContain('electrical_testing');
    expect(node.defaultTech.electrical_testing).toContain('Miernik Sonel MPI-530');
  });

  it('poprawnie rozpoznaje węzeł grafu dla księgowej', () => {
    const node = resolveRoleKnowledgeNode('Samodzielna Księgowa');
    expect(node.roleId).toBe('finance_accounting');
    expect(node.areas.map((a) => a.id)).toContain('full_accounting');
    expect(node.defaultTech.full_accounting).toContain('Comarch ERP Optima');
  });

  it('podpowiedzi rezultatów nie zawierają zmyślonych metryk ani gwarancji', () => {
    const outcomeSuggestions = getAllRoleKnowledgeNodes()
      .flatMap((node) => Object.values(node.outcomes).flat());

    expect(outcomeSuggestions.length).toBeGreaterThan(0);
    expect(outcomeSuggestions.join('\n')).not.toMatch(/\d+(?:[.,]\d+)?\s*(?:%|ms|h|zł)|\bzero[-\s]downtime\b|\bgwarant\w*|\bidealn\w*|\bbezawaryjn\w*|\bbezbłędn\w*|\bpełn\w* zgodnoś\w*/i);
  });

  it('odmienia czasowniki, ale nie dopisuje niepodanych obiektów ani technologii', () => {
    expect(formatActionWord('projektowałem architekturę', 'impersonal')).toBe('Projektowałem architekturę');
    expect(formatActionWord('projektowałem architekturę', 'first_person_m')).toBe('Projektowałem architekturę');
    expect(formatActionWord('projektowałem architekturę', 'first_person_f')).toBe('Projektowałam architekturę');

    expect(formatActionWord('montowałem', 'impersonal')).toBe('Montaż');
    expect(formatActionWord('montowałem', 'first_person_m')).toBe('Montowałem');
    expect(formatActionWord('montowałem', 'first_person_f')).toBe('Montowałam');

    expect(formatActionWord('kompletowałem', 'impersonal')).toBe('Kompletacja');
    expect(formatActionWord('księgowałem', 'impersonal')).toBe('Księgowanie');
    expect(formatActionWord('optymalizowałem zapytania', 'impersonal')).toBe('Optymalizowałem zapytania');
    expect(formatActionWord('integrowałem API', 'impersonal')).toBe('Integrowałem API');
  });

  it('żadna forma w słowniku odmiany nie dodaje rzeczownika spoza czynności źródłowej', () => {
    const connectors = new Set(['i', 'oraz', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'po', 'za', 'o', 'przy', 'dla', 'nad']
      .map((word) => getPolishStem(stripDiacriticsLower(word))));
    const styles = ['impersonal', 'first_person_m', 'first_person_f'] as const;

    for (const action of Object.keys(POLISH_VERB_FORMS)) {
      const sourceTokens = new Set(
        stripDiacriticsLower(action).split(/[^\p{L}\p{N}+#.]+/u).filter(Boolean).map(getPolishStem),
      );
      for (const style of styles) {
        const result = formatActionWord(action, style);
        const resultTokens = stripDiacriticsLower(result)
          .split(/[^\p{L}\p{N}+#.]+/u)
          .filter(Boolean)
          .map(getPolishStem);
        const ungrounded = resultTokens.slice(1).filter((token) => !sourceTokens.has(token) && !connectors.has(token));
        expect(ungrounded, `${action} → ${style}: ${result}`).toEqual([]);
      }
    }
  });

  it('generuje kompletne, niepuste warianty opisu doświadczenia na podstawie faktów', () => {
    const sampleFact: ExperienceFact = {
      role: 'Monter HVAC',
      area: 'Montaż Kotłów, Pomp Ciepła & HVAC',
      action: 'montowałem',
      objects: ['kotły gazowe kondensacyjne', 'pompy ciepła powietrze-woda'],
      technologies: ['SEP G3', 'F-Gaz', 'Analizator Testo'],
      outcome: 'zapewniając 100% szczelności i pełną zgodność z normami',
      metric: 'ponad 300 wykonanych instalacji',
      narrativeStyle: 'impersonal',
      verifiedByUser: true,
    };

    const validation = validateExperienceFact(sampleFact);
    expect(validation.isValid).toBe(true);

    const variants = generateExperienceVariants(sampleFact);
    expect(variants.length).toBe(3);

    const formal = variants[0];
    expect(formal.styleName).toBe('Formalny (Bezosobowy)');
    expect(formal.fullParagraph).toContain('Montaż:');
    expect(formal.fullParagraph).toContain('kotły gazowe kondensacyjne oraz pompy ciepła powietrze-woda');
    expect(formal.fullParagraph).toContain('SEP G3, F-Gaz oraz Analizator Testo');
    expect(formal.fullParagraph).toContain('ponad 300 wykonanych instalacji');
    expect(formal.bulletPoints).toHaveLength(1);
    for (const variant of variants) {
      expect(variant.fullParagraph).not.toMatch(/najwyższe standardy|dbałości o wysoką jakość|terminowości|bezpieczeństwie realizowanych prac|współpracowałem|współpracowałam/i);
    }
  });

  it('nie generuje zastępczego obiektu pracy ani twierdzeń o jakości, bezpieczeństwie lub współpracy', () => {
    const fact: ExperienceFact = {
      role: 'Pracownik obsługi klienta',
      area: 'Obsługa zgłoszeń',
      action: 'obsługiwałem',
      objects: [],
      technologies: [],
      narrativeStyle: 'first_person_m',
      verifiedByUser: true,
    };

    expect(generateExperienceVariants(fact)).toEqual([]);
  });

  it('nie uznaje kompletnego, ale niepotwierdzonego zestawu danych za gotowy do użycia', () => {
    const validation = validateExperienceFact({
      role: 'Magazynier',
      area: 'Kompletacja',
      action: 'kompletowałem',
      objects: ['zamówienia'],
      technologies: [],
      narrativeStyle: 'first_person_m',
      verifiedByUser: false,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain('potwierdź');
  });

  it('odrzuca niekompletny fakt bez wymaganej akcji lub obiektów', () => {
    const badFact: ExperienceFact = {
      role: 'Tester',
      area: 'QA',
      action: '',
      objects: [],
      technologies: [],
      narrativeStyle: 'impersonal',
      verifiedByUser: false,
    };

    const validation = validateExperienceFact(badFact);
    expect(validation.isValid).toBe(false);
  });
});
