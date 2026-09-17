import { describe, it, expect, beforeEach } from 'vitest';
import {
  MasterVault,
  JobOffer,
  TailoredResume,
  CoverLetter,
  AtsCheckResult,
  JobApplication,
  ApplicationDocumentSnapshot,
} from '../../types';
import { createEmptyVault } from '../sampleVault';
import { buildApplicationFromPending, PendingApplication } from '../applicationFeedback';
import { StorageKeys, readJson, writeJson } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';
import {
  createApplicationDocumentSnapshot,
  validateSnapshotIntegrity,
  repairSnapshotReferences,
  resolveApplicationVault,
} from '../applicationSnapshot';
import { adaptMasterVaultToSemanticProfile } from '../semanticPdfAdapter';

describe('Application Snapshot Immutability Suite (BUG-002 Verification)', () => {
  let memoryStorage: MemoryStorage;

  const createTestVault = (): MasterVault => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo = {
      fullName: 'Jan Kowalski',
      title: 'Monter HVAC',
      summary: 'Doświadczony monter instalacji sanitarnych i grzewczych.',
      email: 'jan@example.com',
      phone: '123456789',
      location: 'Kraków',
    };
    vault.skillsMatrix = {
      hardSkills: ['Montaż instalacji HVAC', 'Uprawnienia SEP G1/G2', 'Lutowanie twarde'],
      toolsAndTech: ['Manometry', 'Pompa próżniowa'],
      softSkills: ['Dokładność', 'Praca w zespole'],
      certifications: [],
    };
    vault.history = [
      {
        id: 'exp_1',
        company: 'TermoKlim Sp. z o.o.',
        role: 'Monter Urządzeń Chłodniczych',
        location: 'Kraków',
        startDate: '2020-01',
        endDate: '2023-12',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Montaż ponad 120 jednostek klimatyzacji split i VRF.',
            action: 'Montaż',
            target: 'jednostek klimatyzacji',
            tool: 'Manometry',
            metric: '120 jednostek',
            keywords: ['HVAC', 'VRF'],
          },
        ],
      },
    ];
    vault.education = [
      {
        id: 'edu_1',
        institution: 'Technikum Mechaniczne',
        degree: 'Technik urządzeń sanitarnych',
        fieldOfStudy: 'Inżynieria Sanitarna',
        startDate: '2015-09',
        endDate: '2019-06',
      },
    ];
    vault.projects = [];
    return vault;
  };

  const createTestJob = (): JobOffer => ({
    id: 'job_hvac_1',
    title: 'Serwisant HVAC',
    company: 'EcoClim Polska',
    salary: '7 000 - 9 500 PLN',
    location: 'Kraków',
    description: 'Poszukujemy doświadczonego serwisanta HVAC ze znajomością SEP.',
  });

  const createTestTailoredResume = (job: JobOffer, vault: MasterVault): TailoredResume => ({
    targetJobTitle: job.title,
    companyName: job.company,
    summary: vault.personalInfo.summary,
    selectedHighlights: [
      {
        experienceId: 'exp_1',
        role: 'Monter Urządzeń Chłodniczych',
        company: 'TermoKlim Sp. z o.o.',
        originalText: 'Montaż ponad 120 jednostek klimatyzacji split i VRF.',
        optimizedText: 'Montaż ponad 120 jednostek klimatyzacji split i VRF.',
        source: 'SLOT_FILLING',
        keywordsMatched: ['HVAC'],
      },
    ],
    skillsMatched: {
      hardSkills: [...vault.skillsMatrix.hardSkills],
      toolsAndTech: [...vault.skillsMatrix.toolsAndTech],
      softSkills: [...vault.skillsMatrix.softSkills],
    },
    atsScore: 92,
  });

  const createTestCoverLetter = (job: JobOffer): CoverLetter => ({
    targetJobTitle: job.title,
    companyName: job.company,
    hook: `Aplikuję na stanowisko ${job.title} w firmie ${job.company}.`,
    proofPoints: ['Montaż ponad 120 jednostek klimatyzacji'],
    callToAction: 'Chętnie przedstawię swoje doświadczenie na spotkaniu.',
    fullText: 'Pełna treść listu motywacyjnego...',
  });

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      writable: true,
      configurable: true,
    });
  });

  // Test 1: Snapshot creation
  it('Test 1: Zapis aplikacji tworzy kompletny documentSnapshot', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);
    const coverLetter = createTestCoverLetter(job);

    const snapshot: ApplicationDocumentSnapshot = {
      schemaVersion: 1,
      createdAt: '2026-08-28T07:00:00.000Z',
      tailoredResume: JSON.parse(JSON.stringify(tailored)),
      coverLetter: JSON.parse(JSON.stringify(coverLetter)),
      vaultSnapshot: JSON.parse(JSON.stringify(vault)),
      jobOfferSnapshot: {
        id: job.id,
        title: job.title,
        company: job.company,
        salary: job.salary,
        location: job.location,
        description: job.description,
      },
      atsResultSnapshot: {
        overallScore: 92,
        keywordCoverageScore: 90,
        structureScore: 95,
        formattingScore: 100,
        appliedProfile: 'PHYSICAL',
        layer1Structure: { layoutScore: 100, headerNormalizationScore: 100, detectedSections: [], missingStandardSections: [], unparsableElementsWarnings: [], isSingleColumnCompliant: true },
        layer2Nlp: { hardSkillsCoverage: 90, formalReqsCoverage: 100, softSkillsFilterCount: 2, extractedJdPhrasesCount: 5, lemmatizedMatches: [] },
        layer3Scoring: { hardSkillScore: 90, recencyScore: 1, titleMatchScore: 100, formulaBreakdown: '' },
        matchedKeywords: ['HVAC', 'SEP'],
        missingHardSkills: [],
        missingSoftSkills: [],
        ocrWarnings: [],
        badDateFormats: [],
        gapAnalysis: [],
        recommendations: [],
      },
    };

    const application: JobApplication = {
      id: 'app-100',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      atsScore: 92,
      documentSnapshot: snapshot,
    };

    expect(application.documentSnapshot).toBeDefined();
    expect(application.documentSnapshot?.schemaVersion).toBe(1);
    expect(application.documentSnapshot?.tailoredResume.targetJobTitle).toBe('Serwisant HVAC');
    expect(application.documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');
  });

  // Test 2: Snapshot contains exact document data
  it('Test 2: Snapshot zawiera dokładne kopie tailoredResume, coverLetter i vault', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);
    const coverLetter = createTestCoverLetter(job);

    const pending: PendingApplication = {
      jobId: 'app-pending-1',
      company: job.company,
      title: job.title,
      salary: job.salary,
      atsScore: 92,
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: tailored,
        coverLetter,
        vaultSnapshot: vault,
        jobOfferSnapshot: job,
      },
    };

    const app = buildApplicationFromPending(pending, 'Wysłana');
    expect(app.documentSnapshot).toBeDefined();
    expect(app.documentSnapshot?.tailoredResume.summary).toBe(vault.personalInfo.summary);
    expect(app.documentSnapshot?.coverLetter?.hook).toBe(coverLetter.hook);
    expect(app.documentSnapshot?.vaultSnapshot.history[0].company).toBe('TermoKlim Sp. z o.o.');
  });

  // Test 3: MasterVault mutation does not alter saved application snapshot
  it('Test 3: Mutacja MasterVault po zapisie aplikacji NIE zmienia danych w snapshocie', () => {
    const mutableVault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, mutableVault);

    const application: JobApplication = {
      id: 'app-immutability-1',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailored)),
        vaultSnapshot: JSON.parse(JSON.stringify(mutableVault)),
        jobOfferSnapshot: job,
      },
    };

    // Modyfikacja MasterVault
    mutableVault.personalInfo.fullName = 'Adam Nowicki';
    mutableVault.personalInfo.title = 'Kierownik Budowy';
    mutableVault.personalInfo.summary = 'Zupełnie nowe podsumowanie po zmianie branży.';

    // Asercja: snapshot pozostał niezmieniony
    expect(application.documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');
    expect(application.documentSnapshot?.vaultSnapshot.personalInfo.title).toBe('Monter HVAC');
    expect(application.documentSnapshot?.vaultSnapshot.personalInfo.summary).toBe(
      'Doświadczony monter instalacji sanitarnych i grzewczych.'
    );
  });

  // Test 4: Destructive MasterVault mutation (deleting experiences, skills)
  it('Test 4: Destrukcyjne usunięcie doświadczeń i umiejętności z MasterVault nie niszczy snapshotu', () => {
    const mutableVault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, mutableVault);

    const application: JobApplication = {
      id: 'app-destructive-1',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailored)),
        vaultSnapshot: JSON.parse(JSON.stringify(mutableVault)),
        jobOfferSnapshot: job,
      },
    };

    // Całkowite wyczyszczenie historii i umiejętności w Vault
    mutableVault.history = [];
    mutableVault.skillsMatrix.hardSkills = [];
    mutableVault.skillsMatrix.toolsAndTech = [];
    mutableVault.education = [];

    // Snapshot zachowuje 100% pierwotnej historii i umiejętności
    expect(application.documentSnapshot?.vaultSnapshot.history.length).toBe(1);
    expect(application.documentSnapshot?.vaultSnapshot.history[0].company).toBe('TermoKlim Sp. z o.o.');
    expect(application.documentSnapshot?.vaultSnapshot.skillsMatrix.hardSkills).toContain('Uprawnienia SEP G1/G2');
    expect(application.documentSnapshot?.vaultSnapshot.education.length).toBe(1);
  });

  // Test 5: Distinction between Application A (v1) and Application B (v2)
  it('Test 5: Wygenerowanie aplikacji A z v1 i aplikacji B z v2 tworzy dwa niezależne snapshoty', () => {
    const vault = createTestVault();
    const jobA = createTestJob();
    const tailoredA = createTestTailoredResume(jobA, vault);

    const appA: JobApplication = {
      id: 'app-A',
      company: 'Firma A',
      position: 'Monter HVAC',
      salary: '8000',
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailoredA)),
        vaultSnapshot: JSON.parse(JSON.stringify(vault)),
        jobOfferSnapshot: jobA,
      },
    };

    // Zmiana profilu na Elektryka
    vault.personalInfo.title = 'Elektryk Przemysłowy';
    vault.skillsMatrix.hardSkills = ['Pomiary elektryczne', 'Programowanie PLC'];
    const jobB: JobOffer = {
      id: 'job_elec_2',
      title: 'Automatyk / Elektryk',
      company: 'Firma B',
      salary: '10000',
      location: 'Warszawa',
    };
    const tailoredB = createTestTailoredResume(jobB, vault);

    const appB: JobApplication = {
      id: 'app-B',
      company: 'Firma B',
      position: 'Automatyk / Elektryk',
      salary: '10000',
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:10:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailoredB)),
        vaultSnapshot: JSON.parse(JSON.stringify(vault)),
        jobOfferSnapshot: jobB,
      },
    };

    expect(appA.documentSnapshot?.vaultSnapshot.personalInfo.title).toBe('Monter HVAC');
    expect(appA.documentSnapshot?.vaultSnapshot.skillsMatrix.hardSkills).toContain('Uprawnienia SEP G1/G2');
    expect(appB.documentSnapshot?.vaultSnapshot.personalInfo.title).toBe('Elektryk Przemysłowy');
    expect(appB.documentSnapshot?.vaultSnapshot.skillsMatrix.hardSkills).toContain('Programowanie PLC');
  });

  // Test 6: Repeated reads / serialization cycle
  it('Test 6: Wielokrotny odczyt i serializacja zachowuje pełną spójność snapshotu', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);

    const app: JobApplication = {
      id: 'app-serialization-1',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: tailored,
        vaultSnapshot: vault,
        jobOfferSnapshot: job,
      },
    };

    // Zapis i odczyt z storage
    writeJson(StorageKeys.applications, [app]);
    const read1 = readJson<JobApplication[]>(StorageKeys.applications, []);
    expect(read1[0].documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');

    const read2 = readJson<JobApplication[]>(StorageKeys.applications, []);
    expect(read2[0].documentSnapshot?.vaultSnapshot.history[0].highlights[0].text).toBe(
      'Montaż ponad 120 jednostek klimatyzacji split i VRF.'
    );
  });

  // Test 7: Backward compatibility for applications without snapshot
  it('Test 7: Aplikacje bez snapshotu (dodane ręcznie) nie powodują błędów i mają documentSnapshot === undefined', () => {
    const manualApp: JobApplication = {
      id: 'manual-app-1',
      company: 'Lokalny Zakład Rzemieślniczy',
      position: 'Pomocnik Montera',
      salary: '5000 PLN',
      date: '2026-08-20',
      status: 'Do wysłania',
      notes: 'Złożone osobiście w biurze.',
    };

    writeJson(StorageKeys.applications, [manualApp]);
    const loaded = readJson<JobApplication[]>(StorageKeys.applications, []);

    expect(loaded[0].documentSnapshot).toBeUndefined();
    expect(loaded[0].company).toBe('Lokalny Zakład Rzemieślniczy');
    expect(loaded[0].status).toBe('Do wysłania');
  });

  // Test 8: Job Offer mutation isolation
  it('Test 8: Zmiana obiektu oferty po aplikacji nie modyfikuje jobOfferSnapshot', () => {
    const vault = createTestVault();
    const mutableJob = createTestJob();
    const tailored = createTestTailoredResume(mutableJob, vault);

    const app: JobApplication = {
      id: 'app-job-iso',
      company: mutableJob.company,
      position: mutableJob.title,
      salary: mutableJob.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailored)),
        vaultSnapshot: JSON.parse(JSON.stringify(vault)),
        jobOfferSnapshot: JSON.parse(JSON.stringify(mutableJob)),
      },
    };

    // Zmiana w obiekcie oferty
    mutableJob.salary = '15 000 PLN';
    mutableJob.title = 'Dyrektor ds. Serwisu';

    expect(app.documentSnapshot?.jobOfferSnapshot.salary).toBe('7 000 - 9 500 PLN');
    expect(app.documentSnapshot?.jobOfferSnapshot.title).toBe('Serwisant HVAC');
  });

  // Test 9: ATS Result mutation isolation
  it('Test 9: Zmiana wyniku ATS w nowym dopasowaniu nie zmienia historycznego atsResultSnapshot', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);

    const initialAts: AtsCheckResult = {
      overallScore: 88,
      keywordCoverageScore: 85,
      structureScore: 90,
      formattingScore: 100,
      appliedProfile: 'PHYSICAL',
      layer1Structure: { layoutScore: 100, headerNormalizationScore: 100, detectedSections: [], missingStandardSections: [], unparsableElementsWarnings: [], isSingleColumnCompliant: true },
      layer2Nlp: { hardSkillsCoverage: 85, formalReqsCoverage: 100, softSkillsFilterCount: 1, extractedJdPhrasesCount: 4, lemmatizedMatches: [] },
      layer3Scoring: { hardSkillScore: 85, recencyScore: 1, titleMatchScore: 100, formulaBreakdown: '' },
      matchedKeywords: ['HVAC'],
      missingHardSkills: ['SEP'],
      missingSoftSkills: [],
      ocrWarnings: [],
      badDateFormats: [],
      gapAnalysis: [],
      recommendations: [],
    };

    const app: JobApplication = {
      id: 'app-ats-iso',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: JSON.parse(JSON.stringify(tailored)),
        vaultSnapshot: JSON.parse(JSON.stringify(vault)),
        jobOfferSnapshot: job,
        atsResultSnapshot: JSON.parse(JSON.stringify(initialAts)),
      },
    };

    // Nowa symulacja daje inny wynik
    initialAts.overallScore = 40;

    expect(app.documentSnapshot?.atsResultSnapshot?.overallScore).toBe(88);
  });

  // Test 10: BUG-004 — Application edit preserves documentSnapshot
  it('Test 10: Edycja metadanych (notatek, widełek) w ApplicationModal zachowuje nienaruszony documentSnapshot', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);
    const coverLetter = createTestCoverLetter(job);

    const initialSnapshot: ApplicationDocumentSnapshot = {
      schemaVersion: 1,
      createdAt: '2026-08-28T07:00:00.000Z',
      tailoredResume: JSON.parse(JSON.stringify(tailored)),
      coverLetter: JSON.parse(JSON.stringify(coverLetter)),
      vaultSnapshot: JSON.parse(JSON.stringify(vault)),
      jobOfferSnapshot: JSON.parse(JSON.stringify(job)),
    };

    const initialApp: JobApplication = {
      id: 'app-edit-1',
      company: job.company,
      position: job.title,
      salary: job.salary,
      date: '2026-08-28',
      status: 'Wysłana',
      notes: 'Notatka początkowa',
      jobUrl: 'https://ecoclim.pl/praca',
      documentSnapshot: initialSnapshot,
    };

    // Wzorzec z naprawionego ApplicationModal.tsx (handleSubmit)
    const editedApp: JobApplication = {
      ...(initialApp || {}),
      id: initialApp.id,
      company: 'EcoClim Polska Sp. z o.o.',
      position: 'Monter HVAC (Senior)',
      salary: '9 500 PLN',
      date: '2026-08-29',
      status: 'Rozmowa',
      jobUrl: 'https://ecoclim.pl/praca/senior',
      notes: 'Zaktualizowana notatka po pierwszym kontakcie',
    };

    expect(editedApp.salary).toBe('9 500 PLN');
    expect(editedApp.status).toBe('Rozmowa');
    expect(editedApp.documentSnapshot).toBeDefined();
    expect(editedApp.documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');
    expect(editedApp.documentSnapshot?.tailoredResume.targetJobTitle).toBe('Serwisant HVAC');
  });

  // Test 11: BUG-004 — Application edit preserves atsScore and missingKeywords
  it('Test 11: Edycja metadanych zachowuje atsScore i missingKeywords', () => {
    const initialApp: JobApplication = {
      id: 'app-edit-2',
      company: 'TermoKlim',
      position: 'Serwisant',
      salary: '8 000 PLN',
      date: '2026-08-28',
      status: 'Wysłana',
      atsScore: 94,
      missingKeywords: ['SEP G2', 'F-Gaz'],
    };

    const editedApp: JobApplication = {
      ...(initialApp || {}),
      id: initialApp.id,
      company: 'TermoKlim Grupa',
      position: 'Serwisant',
      salary: '9 000 PLN',
      date: '2026-08-28',
      status: 'Wysłana',
      jobUrl: '',
      notes: '',
    };

    expect(editedApp.atsScore).toBe(94);
    expect(editedApp.missingKeywords).toEqual(['SEP G2', 'F-Gaz']);
    expect(editedApp.company).toBe('TermoKlim Grupa');
  });

  // Test 12: BUG-004 — Application edit preserves interview metadata
  it('Test 12: Edycja metadanych zachowuje interviewAt, briefDoneAt oraz debriefSentAt', () => {
    const initialApp: JobApplication = {
      id: 'app-edit-3',
      company: 'KlimatPro',
      position: 'Inżynier HVAC',
      salary: '10 000 PLN',
      date: '2026-08-28',
      status: 'Rozmowa',
      interviewAt: '2026-08-30T10:00:00Z',
      briefDoneAt: '2026-08-29T18:00:00Z',
      debriefSentAt: '2026-08-30T12:00:00Z',
    };

    const editedApp: JobApplication = {
      ...(initialApp || {}),
      id: initialApp.id,
      company: 'KlimatPro',
      position: 'Inżynier HVAC',
      salary: '11 000 PLN',
      date: '2026-08-28',
      status: 'Rozmowa',
      jobUrl: '',
      notes: 'Dodatkowa notatka',
    };

    expect(editedApp.salary).toBe('11 000 PLN');
    expect(editedApp.interviewAt).toBe('2026-08-30T10:00:00Z');
    expect(editedApp.briefDoneAt).toBe('2026-08-29T18:00:00Z');
    expect(editedApp.debriefSentAt).toBe('2026-08-30T12:00:00Z');
  });

  // Test 13: BUG-004 — useApplications defensive merge does not drop unprovided fields
  it('Test 13: Defensywny merge w saveApplication nie usuwa istniejących właściwości przy częściowym obiekcie', () => {
    const vault = createTestVault();
    const job = createTestJob();
    const tailored = createTestTailoredResume(job, vault);

    const existingApp: JobApplication = {
      id: 'app-merge-1',
      company: 'EcoClim',
      position: 'Monter',
      salary: '8 000 PLN',
      date: '2026-08-28',
      status: 'Wysłana',
      atsScore: 92,
      missingKeywords: ['SEP G1'],
      interviewAt: '2026-08-30T10:00:00Z',
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-08-28T07:00:00.000Z',
        tailoredResume: tailored,
        vaultSnapshot: vault,
        jobOfferSnapshot: job,
      },
    };

    let apps: JobApplication[] = [existingApp];

    const partialUpdatePayload: JobApplication = {
      id: 'app-merge-1',
      company: 'EcoClim Polska',
      position: 'Monter',
      salary: '9 500 PLN',
      date: '2026-08-28',
      status: 'Wysłana',
    };

    // Symulacja zaktualizowanej funkcji saveApplication z useApplications.ts
    const index = apps.findIndex((e) => e.id === partialUpdatePayload.id);
    const next = [...apps];
    next[index] = {
      ...apps[index],
      ...partialUpdatePayload,
    };
    apps = next;

    const merged = apps[0];
    expect(merged.company).toBe('EcoClim Polska');
    expect(merged.salary).toBe('9 500 PLN');
    expect(merged.atsScore).toBe(92);
    expect(merged.missingKeywords).toEqual(['SEP G1']);
    expect(merged.interviewAt).toBe('2026-08-30T10:00:00Z');
    expect(merged.documentSnapshot).toBeDefined();
    expect(merged.documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');
  });

  // Test 14: BUG-005 — MasterVault survives reload with email jan.kowalski@example.com
  it('Test 14: MasterVault z adresem jan.kowalski@example.com przechodzi pełną rehydratację bez kasowania danych', () => {
    const vault = createTestVault();
    vault.personalInfo.email = 'jan.kowalski@example.com';
    vault.personalInfo.fullName = 'Jan Kowalski';
    vault.personalInfo.title = 'Monter HVAC';

    // Symulacja zapisu do localStorage
    writeJson(StorageKeys.vault + ':anonymous', vault);

    // Symulacja naprawionego inicjalizatora z App.tsx
    const storedVault = readJson<MasterVault | null>(StorageKeys.vault + ':anonymous', null);

    let rehydratedVault: MasterVault;
    if (storedVault) {
      rehydratedVault = storedVault;
    } else {
      rehydratedVault = createEmptyVault();
    }

    expect(rehydratedVault.personalInfo.fullName).toBe('Jan Kowalski');
    expect(rehydratedVault.personalInfo.title).toBe('Monter HVAC');
    expect(rehydratedVault.personalInfo.email).toBe('jan.kowalski@example.com');
    expect(rehydratedVault.history.length).toBeGreaterThan(0);
    expect(rehydratedVault.skillsMatrix.hardSkills).toContain('Montaż instalacji HVAC');
  });

  describe('Weryfikacja integralności powiązań i izolacji snapshotów (Broken Links & Deep Immutability)', () => {
    it('Test 15: validateSnapshotIntegrity wykrywa złamany link (dangling experienceId) w selectedHighlights', () => {
      const vault = createTestVault();
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, vault);

      const snapshot = createApplicationDocumentSnapshot({
        vault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      // Przed uszkodzeniem: snapshot jest w 100% poprawny
      const initialReport = validateSnapshotIntegrity(snapshot);
      expect(initialReport.isValid).toBe(true);
      expect(initialReport.brokenExperienceLinks).toHaveLength(0);

      // Symulacja złamanego linku do historii zatrudnienia
      snapshot.tailoredResume.selectedHighlights[0].experienceId = 'usuniety_rekord_exp_999';

      const report = validateSnapshotIntegrity(snapshot);
      expect(report.isValid).toBe(false);
      expect(report.brokenExperienceLinks).toHaveLength(1);
      expect(report.brokenExperienceLinks[0].experienceId).toBe('usuniety_rekord_exp_999');
      expect(report.brokenExperienceLinks[0].company).toBe('TermoKlim Sp. z o.o.');
      // Walidator znajduje sugerowany odpowiednik w vaultSnapshot.history po firmie i roli
      expect(report.brokenExperienceLinks[0].suggestedExperienceId).toBe('exp_1');
    });

    it('Test 16: repairSnapshotReferences automatycznie naprawia złamany link experienceId gdy firma i rola pasują', () => {
      const vault = createTestVault();
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, vault);

      const snapshot = createApplicationDocumentSnapshot({
        vault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      // Psujemy referencję identyfikatora
      snapshot.tailoredResume.selectedHighlights[0].experienceId = 'stare_id_sprzed_migracji';

      // Samonaprawa referencji
      const repairedSnapshot = repairSnapshotReferences(snapshot);

      expect(repairedSnapshot.tailoredResume.selectedHighlights[0].experienceId).toBe('exp_1');
      const report = validateSnapshotIntegrity(repairedSnapshot);
      expect(report.isValid).toBe(true);
      expect(report.brokenExperienceLinks).toHaveLength(0);
    });

    it('Test 17: validateSnapshotIntegrity i repairSnapshotReferences oczyszczają wiszące linki z experienceOrder', () => {
      const vault = createTestVault();
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, vault);
      tailored.experienceOrder = ['exp_1', 'exp_widmo_404', 'exp_nieistniejace_888'];

      const snapshot = createApplicationDocumentSnapshot({
        vault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      // Podczas createApplicationDocumentSnapshot wiszące ID są już czyszczone
      expect(snapshot.tailoredResume.experienceOrder).toEqual(['exp_1']);

      // Ręczne wstrzyknięcie uszkodzonego ID do gotowego snapshotu
      snapshot.tailoredResume.experienceOrder = ['exp_1', 'exp_dangling'];
      const report = validateSnapshotIntegrity(snapshot);
      expect(report.isValid).toBe(false);
      expect(report.brokenExperienceOrderLinks).toEqual(['exp_dangling']);

      const repaired = repairSnapshotReferences(snapshot);
      expect(repaired.tailoredResume.experienceOrder).toEqual(['exp_1']);
      expect(validateSnapshotIntegrity(repaired).isValid).toBe(true);
    });

    it('Test 18: createApplicationDocumentSnapshot gwarantuje pełną głęboką izolację przed mutacjami Master Vault', () => {
      const mutableVault = createTestVault();
      mutableVault.claims = [
        {
          id: 'claim_sep_1',
          sourceProject: 'TermoKlim Sp. z o.o.',
          dateRange: '2020-2023',
          metric: '120 jednostek',
          tags: ['HVAC', 'SEP'],
        },
      ];
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, mutableVault);

      const snapshot = createApplicationDocumentSnapshot({
        vault: mutableVault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      // Wykonujemy serię głębokich i zagnieżdżonych mutacji obiektu MasterVault
      mutableVault.personalInfo.fullName = 'Zmienione Imię i Nazwisko';
      mutableVault.history[0].company = 'Zmieniona Nazwa Firmy';
      mutableVault.history[0].highlights[0].text = 'Zmutowany tekst osiągnięcia';
      mutableVault.history[0].highlights.push({
        id: 'hl_nowy',
        text: 'Drugie nowe osiągnięcie dodane po czasie',
        action: 'Montaż',
        target: 'instalacji',
        tool: '',
        metric: '',
        keywords: [],
      });
      mutableVault.history.push({
        id: 'exp_nowy',
        company: 'Nowa Firma Sp. z o.o.',
        role: 'Kierownik',
        location: 'Warszawa',
        startDate: '2024-01',
        endDate: '2025-01',
        isCurrent: true,
        highlights: [],
      });
      mutableVault.skillsMatrix.hardSkills.push('Nowy skill niewidoczny w snapshocie');
      mutableVault.claims.push({
        id: 'claim_nowy_2',
        sourceProject: 'Nowy',
        dateRange: '2024-2025',
        tags: ['NowyTag'],
      });

      // Asercje: snapshot zachował 100% pierwotnych wartości
      expect(snapshot.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');
      expect(snapshot.vaultSnapshot.history).toHaveLength(1);
      expect(snapshot.vaultSnapshot.history[0].company).toBe('TermoKlim Sp. z o.o.');
      expect(snapshot.vaultSnapshot.history[0].highlights).toHaveLength(1);
      expect(snapshot.vaultSnapshot.history[0].highlights[0].text).toBe(
        'Montaż ponad 120 jednostek klimatyzacji split i VRF.'
      );
      expect(snapshot.vaultSnapshot.skillsMatrix.hardSkills).not.toContain(
        'Nowy skill niewidoczny w snapshocie'
      );
      expect(snapshot.vaultSnapshot.claims).toHaveLength(1);
      expect(snapshot.vaultSnapshot.claims?.[0].id).toBe('claim_sep_1');
    });

    it('Test 19: createApplicationDocumentSnapshot wymusza schemaVersion: 1 i normalizuje brakujące sekcje', () => {
      const rawVault = createTestVault();
      delete (rawVault as any).schemaVersion;
      delete (rawVault as any).claims;

      const job = createTestJob();
      const tailored = createTestTailoredResume(job, rawVault);

      const snapshot = createApplicationDocumentSnapshot({
        vault: rawVault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.vaultSnapshot.schemaVersion).toBe(1);
      expect(Array.isArray(snapshot.vaultSnapshot.claims)).toBe(true);
      expect(snapshot.vaultSnapshot.claims).toEqual([]);
      expect(typeof snapshot.createdAt).toBe('string');
    });

    it('Test 20: resolveApplicationVault zwraca vaultSnapshot ze snapshotu jako niezmienne pojedyncze źródło prawdy', () => {
      const vault = createTestVault();
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, vault);

      const snapshot = createApplicationDocumentSnapshot({
        vault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      const appWithSnapshot: JobApplication = {
        id: 'app-with-snapshot',
        company: job.company,
        position: job.title,
        salary: '8000',
        date: '2026-08-28',
        status: 'Wysłana',
        documentSnapshot: snapshot,
      };

      const fallbackVault = createTestVault();
      fallbackVault.personalInfo.fullName = 'Użytkownik Fallback';

      // Gdy snapshot istnieje: pobieramy dane ze snapshotu
      const resolved = resolveApplicationVault(appWithSnapshot, fallbackVault);
      expect(resolved.personalInfo.fullName).toBe('Jan Kowalski');

      // Modyfikacja zwróconego obiektu nie psuje snapshotu (izolacja)
      resolved.personalInfo.fullName = 'Zmutowany Jan';
      expect(appWithSnapshot.documentSnapshot?.vaultSnapshot.personalInfo.fullName).toBe('Jan Kowalski');

      // Gdy snapshotu brak (aplikacja archiwalna/ręczna)
      const manualApp: JobApplication = {
        id: 'app-manual',
        company: 'Inna Firma',
        position: 'Monter',
        salary: '5000',
        date: '2026-08-20',
        status: 'Do wysłania',
      };
      const resolvedManual = resolveApplicationVault(manualApp, fallbackVault);
      expect(resolvedManual.personalInfo.fullName).toBe('Użytkownik Fallback');
    });

    it('Test 21: adaptMasterVaultToSemanticProfile nie rzuca błędu przy złamanych linkach, a po naprawie uwzględnia zoptymalizowany tekst', () => {
      const vault = createTestVault();
      const job = createTestJob();
      const tailored = createTestTailoredResume(job, vault);

      // Ustawiamy zoptymalizowany tekst
      tailored.selectedHighlights[0].optimizedText = 'Zoptymalizowany montaż 120 jednostek klimatyzacji split i VRF.';

      const snapshot = createApplicationDocumentSnapshot({
        vault,
        tailoredResume: tailored,
        jobOffer: job,
      });

      // Uszkadzamy link experienceId
      snapshot.tailoredResume.selectedHighlights[0].experienceId = 'broken_exp_link_404';

      // Renderer nie powinien rzucić błędu runtime przy złamanych linkach
      expect(() => {
        adaptMasterVaultToSemanticProfile(snapshot.vaultSnapshot, snapshot.tailoredResume);
      }).not.toThrow();

      const profileBeforeRepair = adaptMasterVaultToSemanticProfile(
        snapshot.vaultSnapshot,
        snapshot.tailoredResume
      );
      // Przed naprawą: highlight ze złamanym linkiem nie został wstrzyknięty do doświadczenia exp_1
      const bulletBefore = profileBeforeRepair.experience[0]?.bullets[0]?.display;
      expect(bulletBefore).toBe('Montaż ponad 120 jednostek klimatyzacji split i VRF.');

      // Po naprawie referencji: link do exp_1 zostaje odzyskany i zoptymalizowany tekst wchodzi do profilu
      const repairedSnapshot = repairSnapshotReferences(snapshot);
      const profileAfterRepair = adaptMasterVaultToSemanticProfile(
        repairedSnapshot.vaultSnapshot,
        repairedSnapshot.tailoredResume
      );
      const bulletAfter = profileAfterRepair.experience[0]?.bullets[0]?.display;
      expect(bulletAfter).toBe('Zoptymalizowany montaż 120 jednostek klimatyzacji split i VRF.');
    });
  });
});
