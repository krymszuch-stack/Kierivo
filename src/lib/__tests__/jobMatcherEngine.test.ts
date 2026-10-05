import { describe, it, expect } from 'vitest';
import {
  extractJdText,
  calculateJobMatch,
  buildJobOfferFromScraped,
  buildJobOfferFromManual,
  isSyntheticJobOffer,
  SYNTHETIC_JOB_OFFER_PORTAL,
} from '../jobMatcherEngine';
import { createEmptyVault } from '../sampleVault';
import { hasLimitedMatchEvidence } from '../matchInterpretation';
import { measureVaultCompleteness } from '../vaultCompleteness';
import type { JobOffer, MasterVault } from '../../types';
import type { FetchJdUrlResponse, ParsedJobDescription } from '../../types/api';
import { parseJobDescriptionLocal } from '../jdParser';

describe('jobMatcherEngine - czysta warstwa domenowa dopasowania', () => {
  function getTestVault(): MasterVault {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo.title = 'Senior Frontend Developer';
    vault.personalInfo.summary = 'Doświadczony inżynier oprogramowania zorientowany na wydajność.';
    vault.skillsMatrix.hardSkills = ['TypeScript', 'React', 'HTML', 'CSS'];
    vault.skillsMatrix.toolsAndTech = ['Vite', 'Git', 'Docker'];
    vault.history = [
      {
        id: 'exp-1',
        company: 'Tech Solutions',
        role: 'Frontend Developer',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2024-01',
        isCurrent: false,
        highlights: [
          {
            id: 'hl-1',
            text: 'Budowa architektury SPA w TypeScript i React dla 500k użytkowników.',
            action: 'Budowa',
            target: 'architektury SPA',
            tool: 'TypeScript i React',
            metric: '500k użytkowników',
            keywords: ['TypeScript', 'React'],
          },
        ],
      },
    ];
    return vault;
  }

  const sampleOffer: JobOffer = {
    id: 'job-1',
    title: 'Senior Frontend Engineer',
    company: 'InnovateX',
    salary: '25 000 - 30 000 PLN',
    location: 'Warszawa (hybrydowo)',
    description: 'Szukamy Senior Frontend Engineera do rozwoju platformy webowej. Wymagania: TypeScript, React, Docker.',
    requirements: ['TypeScript', 'React', 'Docker'],
    remote: false,
    portal: 'Pracuj.pl',
    techStack: ['TypeScript', 'React', 'Docker'],
  };

  it('extractJdText - poprawnie ustala źródło tekstu ogłoszenia z zachowaniem priorytetów', () => {
    expect(extractJdText({ description: 'Opis', requirements: ['Wymóg'], title: 'Tytuł' })).toBe('Opis');
    expect(extractJdText({ description: '', requirements: ['Wymóg 1', 'Wymóg 2'], title: 'Tytuł' })).toBe('Wymóg 1 Wymóg 2');
    expect(extractJdText({ description: '', requirements: [], title: 'Tytuł' })).toBe('Tytuł');
  });

  it('calculateJobMatch - wylicza deterministyczne dopasowanie bez zależności od Reacta', () => {
    const vault = getTestVault();
    const result = calculateJobMatch(vault, sampleOffer);

    expect(result.tailoredResume).toBeDefined();
    expect(result.tailoredResume.targetJobTitle).toBe(sampleOffer.title);
    expect(result.tailoredResume.companyName).toBe(sampleOffer.company);
    expect(result.tailoredResume.summary).toBe(vault.personalInfo.summary);
    expect(result.tailoredResume.selectedHighlights).toHaveLength(1);
    expect(result.tailoredResume.selectedHighlights[0].source).toBe('SLOT_FILLING');

    // Kanoniczny wynik ATS i symulacja ATS
    expect(result.canonicalResult).toBeDefined();
    expect(result.canonicalResult.score).toBeGreaterThan(0);
    expect(result.tailoredResume.atsScore).toBe(result.canonicalResult.score);
    expect(result.atsResult).toBeDefined();

    // List motywacyjny i kontekst doradcy
    expect(result.coverLetter).toBeDefined();
    expect(result.coverLetter.fullText.length).toBeGreaterThan(50);
    expect(result.advisorContext).toBeDefined();
    expect(result.advisorContext.offerTitle).toBe(sampleOffer.title);
    expect(result.advisorContext.score).toBe(result.canonicalResult.score);
    expect(result.advisorContext.scoreEvidence?.scope).toBe('sufficient');
    expect(result.advisorContext.missingRequirements).toEqual(result.canonicalResult.missingRequirements.slice(0, 8));

    // Flaga confetti
    expect(result.shouldCelebrate).toBe(
      result.canonicalResult.score !== null && result.canonicalResult.score >= 90 &&
      !hasLimitedMatchEvidence({
        profileCompleteness: measureVaultCompleteness(vault).percent,
        totalRequirementCount: result.canonicalResult.matchedRequirements.length + result.canonicalResult.missingRequirements.length,
      })
    );
  });

  it('nie uruchamia konfetti przy wysokim wyniku opartym na jednym wymaganiu', () => {
    const result = calculateJobMatch(getTestVault(), {
      ...sampleOffer,
      description: 'Wymagania: TypeScript.',
      requirements: ['TypeScript'],
      techStack: ['TypeScript'],
    });

    expect(result.canonicalResult.score).not.toBeNull();
    expect(result.canonicalResult.matchedRequirements.length + result.canonicalResult.missingRequirements.length).toBe(1);
    expect(result.shouldCelebrate).toBe(false);
    expect(result.advisorContext.score).toBeNull();
    expect(result.advisorContext.scoreEvidence).toMatchObject({ detectedRequirementCount: 1, scope: 'limited' });
  });

  it('nie uruchamia konfetti i ogranicza zakres Doradcy przy niepotwierdzonym wymogu formalnym', () => {
    const vault = getTestVault();
    vault.profiler.licenses = ['fgas'];
    const result = calculateJobMatch(vault, {
      ...sampleOffer,
      description: 'Wymagania: TypeScript, React, Docker. Wymagany aktualny certyfikat F-Gaz.',
      requirements: ['TypeScript', 'React', 'Docker'],
    });

    expect(result.canonicalResult.state).toBe('SCORABLE');
    expect(result.canonicalResult.unconfirmedRequirements.some((item) => item.includes('F-Gaz'))).toBe(true);
    expect(result.shouldCelebrate).toBe(false);
    expect(result.advisorContext.score).toBeNull();
    expect(result.advisorContext.scoreEvidence).toMatchObject({ scope: 'limited', unconfirmedRequirementCount: 1 });
  });

  it('nie tworzy podsumowania zawodowego, gdy nie ma go w profilu źródłowym', () => {
    const vault = getTestVault();
    vault.personalInfo.summary = '';
    const result = calculateJobMatch(vault, sampleOffer);

    expect(result.tailoredResume.summary).toBe('');
    expect(result.tailoredResume.summary).not.toMatch(/dopasowany profil|praca w firmie/i);
  });

  it('Nie dopisuje podsumowania, gdy CV go nie zawiera', () => {
    const vault = getTestVault();
    vault.personalInfo.summary = '';
    expect(calculateJobMatch(vault, sampleOffer).tailoredResume.summary).toBe('');
  });

  it('buildJobOfferFromScraped - respektuje pierwszeństwo metadanych strukturalnych portalu', () => {
    const fetchedStructured: FetchJdUrlResponse & { success: true } = {
      success: true,
      title: 'Portal Title (schema.org)',
      company: 'Portal Company Sp. z o.o.',
      descriptionRaw: 'Pełny opis ogłoszenia ze strony.',
      sourceUrl: 'https://example.com/job/123',
      location: 'Kraków',
      remote: true,
      salary: '20 000 PLN',
      skills: ['Python', 'Django'],
      extraction: {
        tier: 'json-ld',
        structured: true,
      },
    };

    const parsedAi: ParsedJobDescription = {
      jobTitle: 'AI Inferred Title',
      companyName: 'AI Inferred Company',
      salaryRange: '18 000 PLN',
      workModel: 'HYBRID',
      seniorityLevel: 'MID',
      requiredHardSkills: ['Python'],
      requiredSoftSkills: [],
      toolsAndTech: ['Git'],
      languagesRequired: [],
      coreResponsibilities: [],
      keyKeywords: ['Python', 'Git'],
    };

    const job = buildJobOfferFromScraped({
      url: 'https://example.com/job/123',
      fetched: fetchedStructured,
      parsed: parsedAi,
    });

    // Dane z portalu mają pierwszeństwo przed odczytem z modelu AI
    expect(job.title).toBe('Portal Title (schema.org)');
    expect(job.company).toBe('Portal Company Sp. z o.o.');
    expect(job.remote).toBe(true);
    expect(job.salary).toBe('20 000 PLN');
    expect(job.requirements).toEqual(['Python']);
    expect(job.portal).toBe('URL');

    const descriptionRaw = 'Technik serwisu\nRequirements\nMiejsce pracy: Warszawa\nWymagania\nSEP G1';
    const unstructuredJob = buildJobOfferFromScraped({
      url: 'https://example.com/job/technik-serwisu',
      fetched: {
        ...fetchedStructured,
        title: 'Technik serwisu',
        company: '',
        descriptionRaw,
        location: '',
        extraction: { tier: 'main-content', structured: false },
      },
      parsed: parseJobDescriptionLocal(descriptionRaw),
    });
    expect(unstructuredJob.company).toBe('');
    expect(unstructuredJob.location).toBe('Warszawa');
  });

  it('buildJobOfferFromManual - poprawnie normalizuje ręczną ofertę i przetwarza opis', () => {
    const manualOffer: Partial<JobOffer> = {
      title: 'Monter instalacji sanitarnych',
      company: 'Instal-Bud',
      description: 'Zatrudnimy montera instalacji sanitarnych i grzewczych. Wymagane uprawnienia SEP, spawanie gazowe.',
    };

    const { job, parsed } = buildJobOfferFromManual(manualOffer);

    expect(job.title).toBe('Monter instalacji sanitarnych');
    expect(job.company).toBe('Instal-Bud');
    expect(job.portal).toBe('Manual');
    expect(job.id).toMatch(/^manual-/);
    expect(parsed).toBeDefined();
    expect(parsed.jobTitle).toBe('Monter instalacji sanitarnych');
  });

  it('nie przenosi zaprzeczonych kryteriów z wklejonej oferty do wyniku dopasowania', () => {
    const { job, parsed } = buildJobOfferFromManual({
      description: `Specjalista terenowy
Wymagania
Prawo jazdy kat. B nie jest wymagane.
Angielski nie jest wymagany.
Minimum 3 lata doświadczenia nie jest wymagane.
ServiceNow jest wymagany.`,
    });
    const result = calculateJobMatch(getTestVault(), job);

    expect(parsed.mandatoryRequirements).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/prawo jazdy|angielski|3 lata/i),
    ]));
    expect(result.canonicalResult.missingRequirements.map((item) => item.toLocaleLowerCase('pl-PL'))).not.toEqual(expect.arrayContaining([
      'angielski', 'english', 'prawo jazdy', 'prawo jazdy kat. b', 'min. 3 lata doświadczenia',
    ]));
    expect(job.description).toContain('Prawo jazdy kat. B nie jest wymagane.');
  });

  it('zachowuje znacznik syntetycznej oferty, aby próba nie wyglądała jak prawdziwa aplikacja', () => {
    const { job } = buildJobOfferFromManual({
      title: 'Monter testowy',
      company: 'Firma fikcyjna',
      description: 'Wymagania: prawo jazdy kat. B, uprawnienia SEP G3.',
      portal: SYNTHETIC_JOB_OFFER_PORTAL,
    });

    expect(job.portal).toBe(SYNTHETIC_JOB_OFFER_PORTAL);
    expect(isSyntheticJobOffer(job)).toBe(true);
    expect(isSyntheticJobOffer({ portal: 'Manual' })).toBe(false);
  });

  it('keeps an unspecified work model distinct from remote=false', () => {
    const { job, parsed } = buildJobOfferFromManual({
      title: 'Support Engineer',
      description: 'Requirements: Linux and ticketing system experience.',
    });

    expect(parsed.workModel).toBe('UNKNOWN');
    expect(job.remote).toBeUndefined();
  });
});
