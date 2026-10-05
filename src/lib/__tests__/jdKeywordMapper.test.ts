import { describe, it, expect } from 'vitest';
import { applyKeywordSuggestionToResume, mapJdKeywords } from '../jdKeywordMapper';
import { MasterVault, TailoredResume } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('JDKeywordMapper Engine', () => {
  const createMockVault = (): MasterVault => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.skillsMatrix = {
      hardSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      toolsAndTech: ['Docker', 'Git', 'Kafka', 'AWS'],
      softSkills: ['Komunikatywność', 'Praca zespołowa'],
      certifications: [],
    };
    vault.projects = [
      {
        id: 'proj_kafka',
        name: 'System Płatności',
        role: 'Senior Backend Engineer',
        description: 'System przetwarzania zdarzeń w oparciu o Kafka i Node.js.',
        techStack: ['Kafka', 'Node.js', 'PostgreSQL'],
      },
    ];
    vault.history = [
      {
        id: 'exp_1',
        company: 'Cloud Corp',
        role: 'Full-Stack Developer',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2023-01',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Wdrożenie mikroserwisów w TypeScript i React.',
            action: 'Wdrożenie',
            target: 'Frontend',
            tool: 'React',
            metric: '+30% TPS',
            keywords: ['TypeScript', 'React'],
          },
        ],
      },
    ];
    return vault;
  };

  const createMockTailoredResume = (): TailoredResume => {
    return {
      targetJobTitle: 'Senior Full-Stack Engineer',
      companyName: 'TechScale Dynamics',
      summary: 'Doświadczony programista TypeScript i React.',
      atsScore: 80,
      skillsMatched: {
        hardSkills: ['TypeScript', 'React'],
        toolsAndTech: ['Git', 'Docker'],
        softSkills: ['Komunikatywność'],
      },
      selectedHighlights: [
        {
          experienceId: 'exp_1',
          role: 'Full-Stack Developer',
          company: 'Cloud Corp',
          originalText: 'Wdrożenie mikroserwisów w TypeScript i React.',
          optimizedText: 'Wdrożenie mikroserwisów w TypeScript i React.',
          source: 'SLOT_FILLING',
          keywordsMatched: ['TypeScript', 'React'],
        },
      ],
    };
  };

  it('ekstrahuje słowa kluczowe (hard skills, tools, soft skills) z opisu stanowiska', () => {
    const vault = createMockVault();
    const tailored = createMockTailoredResume();
    const jdText = `
      Poszukujemy Senior Developera.
      Wymagania:
      - Bardzo dobra znajomość TypeScript, React oraz Node.js
      - Doświadczenie w pracy z Kafka, Docker i Kubernetes
      - Komunikatywność i praca zespołowa
    `;

    const result = mapJdKeywords(jdText, vault, tailored);

    expect(result.keywords.length).toBeGreaterThan(0);
    const terms = result.keywords.map((k) => k.term);
    expect(terms).toContain('TypeScript');
    expect(terms).toContain('React');
    expect(terms).toContain('Node.js');
    expect(terms).toContain('Kafka');
    expect(terms).toContain('Docker');
    expect(terms).toContain('Kubernetes');
    expect(terms).toContain('Komunikatywność');
  });

  it('nie pokazuje zaprzeczonych kryteriów jako braków profilu', () => {
    const result = mapJdKeywords(`Specjalista terenowy
Wymagania
Prawo jazdy kat. B nie jest wymagane.
Angielski nie jest wymagany.
Minimum 3 lata doświadczenia nie jest wymagane.
ServiceNow jest wymagany.`, createMockVault(), createMockTailoredResume());
    const terms = result.keywords.map((keyword) => keyword.term.toLocaleLowerCase('pl-PL'));

    expect(terms).toContain('servicenow');
    expect(terms).not.toEqual(expect.arrayContaining(['angielski', 'english', 'prawo jazdy kat. b']));
  });

  it('poprawnie klasyfikuje statusy słów (W CV, W Vault poza CV, Brak w profilu)', () => {
    const vault = createMockVault();
    const tailored = createMockTailoredResume();
    const jdText = `
      Wymagania:
      - React (jest w CV)
      - Kafka (jest w Vault w projekcie 'System Płatności', ale nie w CV)
      - Kubernetes (brak w Vault)
    `;

    const result = mapJdKeywords(jdText, vault, tailored);

    const reactKw = result.keywords.find((k) => k.term === 'React');
    expect(reactKw?.status).toBe('MATCHED_IN_CV');

    const kafkaKw = result.keywords.find((k) => k.term === 'Kafka');
    expect(kafkaKw?.status).toBe('IN_VAULT_NOT_IN_CV');
    expect(kafkaKw?.foundInVaultLocations.some((loc) => loc.includes('System Płatności'))).toBe(true);

    expect(kafkaKw?.foundInVaultEvidence?.some((excerpt) => /Kafka/.test(excerpt))).toBe(true);
    expect(kafkaKw?.jobRequirementEvidence).toMatch(/Kafka/);

    const k8sKw = result.keywords.find((k) => k.term === 'Kubernetes');
    expect(k8sKw?.status).toBe('MISSING_IN_VAULT');
  });

  it('odkrywa dowód w opisie stanowiska pominięty w wybranych punktach CV', () => {
    const vault = createMockVault();
    vault.history[0].description = 'Obsługa zgłoszeń w ServiceNow: kategoryzowanie, ustalanie priorytetu i przekazywanie incydentów do L2.';
    const tailored = createMockTailoredResume();
    const jdText = 'Requirements: incident triage and escalation to L2.';

    const result = mapJdKeywords(jdText, vault, tailored);
    const triage = result.keywords.find((keyword) => keyword.term.toLowerCase() === 'incident triage');
    const suggestion = result.suggestions.find((item) => item.keyword.toLowerCase() === 'incident triage');

    expect(triage?.status).toBe('IN_VAULT_NOT_IN_CV');
    expect(triage?.foundInVaultEvidence?.join(' ')).toMatch(/kategoryz|priorytet|incydent/i);
    expect(triage?.foundInVaultLocations.join(' ')).toContain('Cloud Corp');
    expect(suggestion?.sourceExperienceId).toBe('exp_1');
    expect(suggestion?.sourceCompany).toBe('Cloud Corp');
    expect(suggestion?.sourceEvidence).toMatch(/priorytet|incydent/i);

    const proposedText = suggestion?.sourceEvidence?.replace('przekazywanie incydentów do L2', 'triage i eskalacja incydentów do L2');
    const applied = applyKeywordSuggestionToResume(tailored, { ...suggestion!, proposedText }, true);
    expect(applied.selectedHighlights.at(-1)?.originalText).toBe(suggestion?.sourceEvidence);
    expect(applied.selectedHighlights.at(-1)?.optimizedText).toBe(proposedText);
    expect(tailored.selectedHighlights).toHaveLength(1);

    const undone = applyKeywordSuggestionToResume(applied, { ...suggestion!, proposedText }, false);
    expect(undone.selectedHighlights).toEqual(tailored.selectedHighlights);
  });

  it('generuje trafną sugestię: "Dodaj Kafka do opisu projektu System Płatności — masz to w vault, ale nie w CV"', () => {
    const vault = createMockVault();
    const tailored = createMockTailoredResume();
    const jdText = `
      Wymagamy znajomości Apache Kafka oraz architektury opartej na zdarzeniach.
    `;

    const result = mapJdKeywords(jdText, vault, tailored);

    const kafkaSug = result.suggestions.find((s) => s.keyword === 'Kafka');
    expect(kafkaSug).toBeDefined();
    expect(kafkaSug?.message).toContain('Kafka');
    expect(kafkaSug?.message).toContain('System Płatności');
    expect(kafkaSug?.message).toContain('masz to w Vault, ale nie w wybranym CV');
  });

  it('nie klasyfikuje braku w profilu jako ukrytej kompetencji i respektuje alternatywę ServiceNow lub Jira', () => {
    const vault = createMockVault();
    vault.skillsMatrix?.toolsAndTech.push('ServiceNow');
    const tailored = createMockTailoredResume();
    tailored.skillsMatched.toolsAndTech.push('ServiceNow');
    const jdText = 'Required: ServiceNow or Jira Service Management. Kafka and Kubernetes are also required.';

    const result = mapJdKeywords(jdText, vault, tailored);

    expect(result.keywords.find((keyword) => keyword.term === 'ServiceNow')?.status).toBe('MATCHED_IN_CV');
    expect(result.keywords.some((keyword) => /jira/i.test(keyword.term))).toBe(false);
    expect(result.keywords.find((keyword) => keyword.term === 'Kubernetes')?.status).toBe('MISSING_IN_VAULT');
    expect(result.suggestions.some((suggestion) => suggestion.keyword === 'Kubernetes')).toBe(false);
    expect(result.suggestions.some((suggestion) => suggestion.keyword === 'Kafka')).toBe(true);
  });

  it('nie traktuje nazwy stanowiska „IT Support Specialist” jako brakującej kompetencji', () => {
    const vault = createMockVault();
    const tailored = createMockTailoredResume();

    const result = mapJdKeywords(
      'IT Support Specialist. Requirements: customer-facing support.',
      vault,
      tailored
    );

    expect(result.keywords.some((keyword) => /^specialists?$/i.test(keyword.term))).toBe(false);
    expect(result.suggestions.some((suggestion) => /^specialists?$/i.test(suggestion.keyword))).toBe(false);
  });

  it('nie pokazuje opcjonalnych uprawnień ani duplikatów NLP jako brakujących wymagań', () => {
    const result = mapJdKeywords(
      'Technik serwisu. Wymagania: wymagane prawo jazdy kat. B, mile widziane uprawnienia SEP G1, wymagane prawo jazdy kat. C. Obowiązki: serwis urządzeń i obsługa zgłoszeń.',
      createMockVault(),
      createMockTailoredResume(),
    );

    const missingLicenses = result.keywords
      .filter((keyword) => keyword.category === 'LICENSE' && keyword.status === 'MISSING_IN_VAULT')
      .map((keyword) => keyword.term);
    expect(missingLicenses.some((term) => /prawo jazdy kat\.?\s*b/i.test(term))).toBe(true);
    expect(missingLicenses.some((term) => /prawo jazdy kat\.?\s*c/i.test(term))).toBe(true);
    expect(missingLicenses.some((term) => /SEP G1/i.test(term))).toBe(false);
    expect(result.keywords.some((keyword) => keyword.term === 'SEP G1')).toBe(false);
    expect(result.keywords.some((keyword) => /^(?:C|prawo jazdy)$/i.test(keyword.term))).toBe(false);
  });

  it('mapuje braki wyłącznie z wymagań, a nie z sekcji obowiązków', () => {
    const result = mapJdKeywords(`
      IT Support Technician
      Wymagania: ServiceNow, Windows 11.
      Twój zakres obowiązków:
      Konfiguracja Jira Service Management i Docker.
      Wymagania obowiązkowe: Zendesk, Microsoft 365.
    `, createEmptyVault('Jan Testowy', 'jan@example.test'));

    const terms = result.keywords.map((keyword) => keyword.term);
    expect(terms).toEqual(expect.arrayContaining(['ServiceNow', 'Windows', 'Zendesk', 'Microsoft 365']));
    expect(terms).toHaveLength(4);
    expect(terms.some((term) => /^(?:Jira|Docker|Windows 11)$/i.test(term))).toBe(false);
  });

  it('rozpoznaje Zendesk z taksonomii jako kompetencję ukrytą w projekcie i pomija „technician” z tytułu', () => {
    const vault = createMockVault();
    vault.projects = [{
      id: 'project-zendesk',
      name: 'Synthetic ticket triage lab',
      role: 'Synthetic test role',
      description: 'Fikcyjne ćwiczenie testowe Zendesk, bez doświadczenia komercyjnego.',
      techStack: ['Zendesk'],
    }];
    const tailored = createMockTailoredResume();
    tailored.skillsMatched.toolsAndTech = [];

    const result = mapJdKeywords(
      'IT Support Technician. Mandatory requirement: Zendesk ticketing system.',
      vault,
      tailored
    );

    expect(result.keywords.find((keyword) => keyword.term === 'Zendesk')?.status).toBe('IN_VAULT_NOT_IN_CV');
    expect(result.suggestions.some((suggestion) => suggestion.keyword === 'Zendesk')).toBe(true);
    expect(result.keywords.some((keyword) => /^technicians?$/i.test(keyword.term))).toBe(false);
    expect(result.suggestions.some((suggestion) => /^technicians?$/i.test(suggestion.keyword))).toBe(false);
  });

  it('oblicza pokrycie wykrytych terminów w CV i pokrycie kategorii bez prognozy potencjału', () => {
    const vault = createMockVault();
    const tailored = createMockTailoredResume();
    const jdText = `
      Stack: TypeScript, React, Docker, Kafka, Kubernetes.
    `;

    const result = mapJdKeywords(jdText, vault, tailored);

    expect(result.overallCvScore).toBeGreaterThan(0);
    expect(result.counts.inVaultNotCv).toBeGreaterThan(0);
    expect('overallVaultScore' in result).toBe(false);
    expect(result.suggestions.every((suggestion) => !('impactScore' in suggestion))).toBe(true);
    expect(result.categoryCoverage.HARD_SKILL).toBeDefined();
    expect(result.categoryCoverage.TOOL).toBeDefined();
    expect(result.counts.total).toBeGreaterThanOrEqual(4);
  });

  it('zmienia tylko robocze CV, nie profil, a cofnięcie usuwa dodany termin', () => {
    const original = createMockTailoredResume();
    const suggestion = {
      id: 'sug_kafka',
      keyword: 'Kafka',
      category: 'TOOL' as const,
      type: 'PROMOTE_FROM_VAULT_TO_PROJECT' as const,
      message: 'Dowód pochodzi z projektu.',
      targetType: 'project' as const,
    };

    const updated = applyKeywordSuggestionToResume(original, suggestion, true);
    expect(updated.skillsMatched.toolsAndTech).toContain('Kafka');
    expect(original.skillsMatched.toolsAndTech).not.toContain('Kafka');

    const undone = applyKeywordSuggestionToResume(updated, suggestion, false);
    expect(undone.skillsMatched.toolsAndTech).not.toContain('Kafka');
    expect(updated.skillsMatched.toolsAndTech).toContain('Kafka');
  });

  it('zwraca pusty wynik dla pustego tekstu ogłoszenia', () => {
    const vault = createMockVault();
    const result = mapJdKeywords('', vault, null);

    expect(result.keywords).toHaveLength(0);
    expect(result.overallCvScore).toBe(0);
    expect(result.suggestions).toHaveLength(0);
  });
});
