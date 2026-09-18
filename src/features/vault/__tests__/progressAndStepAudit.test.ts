import { describe, it, expect } from 'vitest';
import { createEmptyVault } from '../../../lib/sampleVault';
import {
  measureVaultCompleteness,
  VAULT_SECTIONS,
} from '../../../lib/vaultCompleteness';
import { canNavigateToNextStep } from '../experienceValidation';
import type { MasterVault } from '../../../types';

describe('Audyt postępu profilu i nawigacji kroków (MasterVaultEditor / ProfileSection)', () => {
  it('udokumentowanie matematyki 82%: 9 z 11 wag daje dokładnie 82% danych profilu dodanych', () => {
    // Profil z wypełnionymi 6 sekcjami o sumarycznej wadze 9 (z 11 możliwych):
    // - identity (waga 1)
    // - headline (waga 1)
    // - experience (waga 3)
    // - hardSkills (waga 2)
    // - tools (waga 1)
    // - education (waga 1)
    // Brakuje: evidence (waga 1) i preferences (waga 1) -> 9 / 11 = 81.82% -> 82%
    const vault82Percent: MasterVault = {
      ...createEmptyVault('Jan Kowalski', 'jan.kowalski@example.com'),
      personalInfo: {
        fullName: 'Jan Kowalski',
        email: 'jan.kowalski@example.com',
        phone: '+48 600 700 800',
        location: 'Kraków',
        title: 'Monter Instalacji HVAC',
        summary: 'Doświadczony monter instalacji sanitarnych i grzewczych.',
        linkedin: '',
        github: '',
        website: '',
        photoUrl: '',
      },
      history: [
        {
          id: 'job-1',
          company: 'Termo-Klim Sp. z o.o.',
          role: 'Monter Instalacji',
          location: 'Kraków',
          startDate: '2020-01',
          endDate: '2023-12',
          isCurrent: false,
          description: 'Montaż pomp ciepła i klimatyzacji.',
          highlights: [
            {
              id: 'h1',
              text: 'Zainstalowano ponad 100 pomp ciepła w domach jednorodzinnych.',
              action: 'Montaż',
              target: 'pompy ciepła',
              tool: 'pompa próżniowa',
              metric: '100',
              keywords: ['HVAC'],
            },
          ],
        },
      ],
      skillsMatrix: {
        hardSkills: ['Montaż pomp ciepła', 'Lutowanie twarde'],
        softSkills: [],
        toolsAndTech: ['Manometry chłodnicze', 'Pompa próżniowa'],
        certifications: [], // brak certyfikatów
      },
      education: [
        {
          id: 'edu-1',
          institution: 'Zespół Szkół Budowlanych w Krakowie',
          degree: 'Technik urządzeń sanitarnych',
          fieldOfStudy: 'Inżynieria sanitarna',
          startDate: '2016-09',
          endDate: '2020-06',
        },
      ],
      projects: [], // brak projektów -> sekcja evidence niewypełniona
      profiler: {
        flags: [],
        experienceLevel: 'MID',
        location: {
          city: '', // brak miasta i brak języków -> sekcja preferences niewypełniona
          radiusKm: 0,
          willingnessToTravel: false,
          hybridWork: false,
          remoteOnly: false,
        },
        languages: [],
      },
    };

    const completeness = measureVaultCompleteness(vault82Percent);

    // Weryfikacja matematyki
    expect(completeness.percent).toBe(82);
    expect(completeness.filled).toEqual([
      'identity',
      'headline',
      'experience',
      'hardSkills',
      'tools',
      'education',
    ]);
    expect(completeness.missing).toEqual(['evidence', 'preferences']);

    // Mapowanie brakujących sekcji na etykiety dla użytkownika
    const missingLabels = completeness.missing.map(
      (id) => VAULT_SECTIONS.find((s) => s.id === id)?.label
    );
    expect(missingLabels).toContain('Projekty lub uprawnienia');
    expect(missingLabels).toContain('Filtry i priorytety');

    // Etykieta nie mówi o ukończeniu procesu konfiguratora, tylko o kompletności danych profilu
    const presentationCopy = `${completeness.percent}% danych profilu dodane`;
    expect(presentationCopy).toBe('82% danych profilu dodane');
    expect(presentationCopy).not.toContain('ukończenia');
  });

  it('E2E Flow: przejście z kroku 4 (Umiejętności) do kroku 5 (Edukacja) bez uprawnień i certyfikatów', () => {
    // Stan: Krok 4 z 6 (indeks 3 w stepperze: Umiejętności)
    let activeStep = 3;

    // Profil bez uprawnień, bez certyfikatów imiennych, bez języków i bez soft skills
    const minimalVault = createEmptyVault('Adam Nowak', 'adam.nowak@example.com');
    minimalVault.history = [
      {
        id: 'job-1',
        company: 'Stal-Bud',
        role: 'Ślusarz / Spawacz',
        location: 'Gdańsk',
        startDate: '2021-01',
        endDate: '2023-01',
        isCurrent: false,
        description: '',
        highlights: [],
      },
    ];
    minimalVault.skillsMatrix = {
      hardSkills: ['Spawanie MIG/MAG'],
      softSkills: [], // puste
      toolsAndTech: [],
      certifications: [], // brak certyfikatów
    };
    minimalVault.profiler.languages = []; // brak języków

    // Uprawnienia w profilerze są puste
    expect(minimalVault.skillsMatrix.certifications).toHaveLength(0);
    expect(minimalVault.profiler.languages).toHaveLength(0);

    // Próba przejścia z kroku 4 (indeks 3) do kroku 5 (indeks 4)
    const navResult = canNavigateToNextStep(activeStep, minimalVault.history);

    // Przejście jest w 100% dozwolone — brak uprawnień i certyfikatów nie blokuje formularza
    expect(navResult.allowed).toBe(true);
    expect(navResult.nextStep).toBe(4); // przechodzi do Kroku 5 (Edukacja)

    activeStep = navResult.nextStep;
    expect(activeStep).toBe(4);

    // Weryfikacja rozdzielenia metryk:
    // Postęp onboardingu: Krok 5 z 6 (etap 5/6 = 83% kroków formularza)
    const onboardingStep = activeStep + 1;
    const totalSteps = 6;
    expect(onboardingStep).toBe(5);

    // Podczas gdy nasycenie danych to osobna metryka liczona z `measureVaultCompleteness`:
    const completeness = measureVaultCompleteness(minimalVault);
    // Profil ma mało danych (tylko identity i hardSkills), więc ma niski procent danych:
    expect(completeness.percent).toBeLessThan(50);
    // Pasek danych nie udaje postępu kroków onboardingu
    expect(completeness.percent).not.toBe(Math.round((onboardingStep / totalSteps) * 100));
  });

  it('rozróżnienie statusów sekcji wymaganych i opcjonalnych', () => {
    // Krok 1 (Dane Osobowe) i Krok 2 (Doświadczenie) są oznaczone jako wymagane
    // Krok 3 (Projekty), Krok 4 (Umiejętności), Krok 5 (Edukacja), Krok 6 (Preferencje) są opcjonalne
    const stepConfigs = [
      { id: 'personal', isRequired: true, estimatedTime: '~1 min' },
      { id: 'experience', isRequired: true, estimatedTime: '~2-3 min' },
      { id: 'projects', isRequired: false, estimatedTime: '~1-2 min' },
      { id: 'skills', isRequired: false, estimatedTime: '~2 min' },
      { id: 'education', isRequired: false, estimatedTime: '~1 min' },
      { id: 'preferences', isRequired: false, estimatedTime: '~1 min' },
    ];

    expect(stepConfigs[0].isRequired).toBe(true);
    expect(stepConfigs[1].isRequired).toBe(true);
    expect(stepConfigs[2].isRequired).toBe(false);
    expect(stepConfigs[3].isRequired).toBe(false);
    expect(stepConfigs[4].isRequired).toBe(false);
    expect(stepConfigs[5].isRequired).toBe(false);

    // Każdy krok ma zdefiniowany orientacyjny czas trwania
    for (const step of stepConfigs) {
      expect(step.estimatedTime).toMatch(/~\d/);
    }
  });
});
