import { describe, it, expect } from 'vitest';
import {
  getPitchHookVariations,
  getPitchCtaVariations,
  getCoverLetterSalutations,
  getCoverLetterHookVariations,
  getCoverLetterProofIntroductions,
  getCoverLetterSignOffs,
} from '../phrasingVariations';
import { generateElevatorPitch } from '../elevatorPitchEngine';
import { generateAntiTemplateCoverLetter } from '../coverLetterEngine';
import { renderPitchFromClaims } from '../consistencyGuard/consistencyEngine';
import { generateFollowUpEmail, createInterviewSession } from '../interviewLoopEngine';
import { MasterVault } from '../../types';

function createSampleVault(): MasterVault {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    profiler: {
      flags: ['OFFICE_IT'],
      experienceLevel: 'SENIOR',
      location: {
        city: 'Warszawa',
        radiusKm: 30,
        willingnessToTravel: false,
        hybridWork: true,
        remoteOnly: true,
      },
      languages: [{ id: 'l1', language: 'Angielski', level: 'C1', context: 'Praca' }],
    },
    personalInfo: {
      fullName: 'Aleksandra Nowicka',
      title: 'Senior Cloud DevOps Architect',
      email: 'a.nowicka@cloud.io',
      phone: '+48 500 600 700',
      location: 'Warszawa',
      summary: 'Architekt rozwiązań chmurowych z 8-letnim stażem.',
    },
    skillsMatrix: {
      hardSkills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD'],
      softSkills: ['Przywództwo', 'Komunikacja'],
      toolsAndTech: ['Docker', 'Prometheus', 'Helm', 'GitLab CI'],
      certifications: [],
    },
    history: [
      {
        id: 'exp_devops_1',
        company: 'CloudTech Systems',
        role: 'Lead Cloud Architect',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: 'Obecnie',
        isCurrent: true,
        description: 'Budowa infrastruktury.',
        highlights: [
          {
            id: 'hl_1',
            text: 'Skrócenie czasu deploymentu o 65% dzięki wdrożeniu GitOps i ArgoCD.',
            action: 'Skrócenie',
            target: 'czas deploymentu',
            tool: 'ArgoCD',
            metric: '65%',
            keywords: ['GitOps', 'Kubernetes'],
          },
        ],
      },
    ],
    education: [],
    projects: [],
  };
}

describe('Phrasing Variations & Anti-Repetition Engine', () => {
  it('1. Zapewnia minimum 5 unikalnych wariantów hooków i wstępów pitchu', () => {
    const ctx = {
      candidateName: 'Aleksandra Nowicka',
      roleTitle: 'Senior Cloud DevOps Architect',
      topSkills: 'Kubernetes, AWS, Terraform',
      topMetric: '65%',
    };

    const variations = getPitchHookVariations(ctx);
    expect(variations.length).toBeGreaterThanOrEqual(5);

    // Każdy wariant jest unikalny
    const uniqueSet = new Set(variations);
    expect(uniqueSet.size).toBe(variations.length);

    // Zawierają imię kandydatki
    for (const v of variations) {
      expect(v).toContain('Aleksandra Nowicka');
    }
  });

  it('2. Zapewnia minimum 4 zróżnicowane zakończenia / CTA pitchu', () => {
    const ctx = {
      candidateName: 'Aleksandra Nowicka',
      roleTitle: 'Senior Cloud DevOps Architect',
      companyName: 'FinTech Cloud Sp. z o.o.',
    };

    const ctaList = getPitchCtaVariations(ctx);
    expect(ctaList.length).toBeGreaterThanOrEqual(4);
    const uniqueSet = new Set(ctaList);
    expect(uniqueSet.size).toBe(ctaList.length);
  });

  it('3. Generator Elevator Pitch tworzy różne wstępy zależnie od wybranego variantIndex', () => {
    const vault = createSampleVault();

    const pitch0 = generateElevatorPitch(vault, 'Senior Cloud Architect', 0);
    const pitch1 = generateElevatorPitch(vault, 'Senior Cloud Architect', 1);
    const pitch2 = generateElevatorPitch(vault, 'Senior Cloud Architect', 2);
    const pitch3 = generateElevatorPitch(vault, 'Senior Cloud Architect', 3);

    // Wersje 30s różnią się między sobą
    expect(pitch0.thirtySeconds).not.toEqual(pitch1.thirtySeconds);
    expect(pitch1.thirtySeconds).not.toEqual(pitch2.thirtySeconds);
    expect(pitch2.thirtySeconds).not.toEqual(pitch3.thirtySeconds);

    // Wersje 90s różnią się między sobą
    expect(pitch0.ninetySeconds).not.toEqual(pitch1.ninetySeconds);
  });

  it('4. Generator Listu Motywacyjnego (Cover Letter) tworzy różne hooki i CTA przy różnych wariantach', () => {
    const vault = createSampleVault();
    const jd = 'Poszukujemy doświadczonego architekta Kubernetes i AWS do budowy platformy cloud.';

    const cl0 = generateAntiTemplateCoverLetter('Senior Cloud Architect', 'Enterprise Cloud S.A.', jd, vault, 0);
    const cl1 = generateAntiTemplateCoverLetter('Senior Cloud Architect', 'Enterprise Cloud S.A.', jd, vault, 1);
    const cl2 = generateAntiTemplateCoverLetter('Senior Cloud Architect', 'Enterprise Cloud S.A.', jd, vault, 2);

    expect(cl0.hook).not.toEqual(cl1.hook);
    expect(cl1.hook).not.toEqual(cl2.hook);
    expect(cl0.callToAction).toBeDefined();
  });

  it('4a. Hook listu nie pobiera metryki z pierwszej, starszej karty historii', () => {
    const vault = createSampleVault();
    vault.history = [
      { id: 'old', company: 'Starsza firma', role: 'Magazynier', location: '', startDate: '2018-01', endDate: '2020-12', isCurrent: false, highlights: [{ id: 'old-h', text: 'Starszy wynik', action: '', target: '', tool: '', metric: '8 starych sztuk', keywords: [] }] },
      { id: 'new', company: 'Nowsza firma', role: 'Technik', location: '', startDate: '2022-01', endDate: '2024-06', isCurrent: false, highlights: [{ id: 'new-h', text: 'Nowszy wynik', action: '', target: '', tool: '', metric: '120 aktualnych zgłoszeń', keywords: [] }] },
    ];

    const hooks = Array.from({ length: 24 }, (_, variantIndex) =>
      generateAntiTemplateCoverLetter('Technik', 'Firma docelowa', '', vault, variantIndex).hook
    );

    expect(hooks.some((hook) => hook.includes('120 aktualnych zgłoszeń'))).toBe(true);
    expect(hooks.every((hook) => !hook.includes('8 starych sztuk'))).toBe(true);
  });

  it('5. Renderer Pitch w ConsistencyGuard generuje dynamiczny hook i CTA', () => {
    const vault = createSampleVault();

    const render0 = renderPitchFromClaims(vault, undefined, 'Cloud Lead', 0);
    const render1 = renderPitchFromClaims(vault, undefined, 'Cloud Lead', 1);

    expect(render0.hook).not.toEqual(render1.hook);
    expect(render0.profileStatements.length).toBeGreaterThan(0);
  });

  it('6. Generator Follow-up Email generuje różne formuły podziękowań i otwarć', () => {
    const session = createInterviewSession('TechCorp', 'Senior Cloud DevOps');
    session.liveTracker.notes.push({
      id: 'n1',
      timestamp: new Date().toISOString(),
      stage: 'TECHNICAL',
      text: 'dyskusję o migracji klastrów Kubernetes do AWS EKS',
    });

    const email0 = generateFollowUpEmail(session, 'Aleksandra Nowicka', undefined, 0);
    const email1 = generateFollowUpEmail(session, 'Aleksandra Nowicka', undefined, 1);
    const email2 = generateFollowUpEmail(session, 'Aleksandra Nowicka', undefined, 2);

    expect(email0).not.toEqual(email1);
    expect(email1).not.toEqual(email2);
    expect(email0).toContain('Aleksandra Nowicka');
    expect(email0).toContain('Senior Cloud DevOps');
  });

  it('8. Zapewnia minimum 8 unikalnych wariantów hooków i nagłówków listu motywacyjnego', () => {
    const ctx = {
      candidateName: 'Aleksandra Nowicka',
      roleTitle: 'Senior Cloud DevOps Architect',
      companyName: 'FinTech Cloud Sp. z o.o.',
      topSkills: 'Kubernetes, AWS, Terraform',
      topMetric: '65%',
    };

    const hooks = getCoverLetterHookVariations(ctx);
    expect(hooks.length).toBeGreaterThanOrEqual(8);
    const uniqueHooks = new Set(hooks);
    expect(uniqueHooks.size).toBe(hooks.length);

    const salutations = getCoverLetterSalutations('FinTech Cloud');
    expect(salutations.length).toBeGreaterThanOrEqual(4);

    const proofIntros = getCoverLetterProofIntroductions();
    expect(proofIntros.length).toBeGreaterThanOrEqual(6);

    const signOffs = getCoverLetterSignOffs();
    expect(signOffs.length).toBeGreaterThanOrEqual(3);
  });

  it('9. Generator listu motywacyjnego generuje 8 kompletnych, unikalnych listów w 0 tokenach', () => {
    const vault = createSampleVault();
    const jd = 'Poszukujemy doświadczonego architekta Kubernetes i AWS do budowy platformy cloud.';

    const letters = Array.from({ length: 8 }, (_, i) =>
      generateAntiTemplateCoverLetter('Senior Cloud Architect', 'Enterprise Cloud S.A.', jd, vault, i)
    );

    // Wszystkie 8 wariantów pełnego tekstu są różne
    const uniqueFullTexts = new Set(letters.map((l) => l.fullText));
    expect(uniqueFullTexts.size).toBe(8);

    // Każdy list zawiera kluczowe sekcje
    for (const letter of letters) {
      expect(letter.fullText).toContain('Enterprise Cloud S.A.');
      expect(letter.fullText).toContain('Aleksandra Nowicka');
      expect(letter.proofPoints.length).toBeGreaterThan(0);
      expect(letter.callToAction.length).toBeGreaterThan(20);
    }
  });

  it('nie dopisuje doświadczenia ani podpisu zastępczego do listu z pustego profilu', () => {
    const vault = createSampleVault();
    vault.personalInfo.fullName = '';
    vault.personalInfo.email = '';
    vault.personalInfo.phone = '';
    vault.personalInfo.title = '';
    vault.personalInfo.summary = '';
    vault.skillsMatrix.hardSkills = [];
    vault.skillsMatrix.toolsAndTech = [];
    vault.history = [];
    vault.projects = [];
    const unsupportedClaims = /specjalista z praktyką|biegłość|udokumentowanym doświadczeniem|wdrożeniami|od lat|bezbłędnie|natychmiast|wymierne rezultaty|case studies/i;

    for (let variantIndex = 0; variantIndex < 8; variantIndex += 1) {
      const letter = generateAntiTemplateCoverLetter('Tester', 'Firma testowa', '', vault, variantIndex);
      expect(letter.fullText).not.toMatch(unsupportedClaims);
      expect(letter.fullText).not.toMatch(/\nKandydat(?:\n|$)/);
      expect(letter.proofPoints).toHaveLength(0);
    }
  });
});
