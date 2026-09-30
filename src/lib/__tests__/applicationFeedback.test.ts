import { describe, expect, it } from 'vitest';
import {
  buildApplicationFromPending,
  buildExistingApplicationFeedbackPatch,
  buildFeedbackPayload,
  findExistingApplicationForPending,
  guessChannel,
  noteForFailure,
  PendingApplication,
} from '../applicationFeedback';

const pending: PendingApplication = {
  jobId: 'job-1',
  company: 'Zakład Montażowy Nowak',
  title: 'Monter instalacji sanitarnych',
  sourceUrl: 'https://www.pracuj.pl/praca/monter,oferta,1',
  salary: '7 000 – 9 000 zł',
  atsScore: 87,
};

describe('guessChannel', () => {
  it('rozpoznaje portal po domenie', () => {
    expect(guessChannel('https://www.pracuj.pl/praca/x')).toBe('Pracuj.pl');
    expect(guessChannel('https://linkedin.com/jobs/view/1')).toBe('LinkedIn');
  });

  it('nie zgaduje przy stronie firmowej ani przy śmieciu', () => {
    expect(guessChannel('https://kariera.example.com/oferta')).toBeNull();
    expect(guessChannel('nie-adres')).toBeNull();
    expect(guessChannel(undefined)).toBeNull();
  });
});

describe('buildFeedbackPayload', () => {
  it('przy sukcesie wysyła kanał i widełki, nie powód porażki', () => {
    const payload = buildFeedbackPayload(pending, {
      appliedSuccessfully: true,
      channel: 'LinkedIn',
      salaryTransparency: 'jawne',
      failureReason: 'formularz',
    });

    expect(payload).toEqual({
      companyName: pending.company,
      jobTitle: pending.title,
      appliedSuccessfully: true,
      applicationChannel: 'LinkedIn',
      salaryTransparency: 'jawne',
      failureReason: null,
    });
  });

  it('przy problemie wysyła wyłącznie powód', () => {
    const payload = buildFeedbackPayload(pending, {
      appliedSuccessfully: false,
      channel: 'LinkedIn',
      failureReason: 'format-pliku',
    });

    expect(payload?.applicationChannel).toBeNull();
    expect(payload?.failureReason).toBe('format-pliku');
  });

  it('nie buduje wiersza bez firmy albo bez stanowiska', () => {
    expect(buildFeedbackPayload({ ...pending, company: '' }, { appliedSuccessfully: true })).toBeNull();
    expect(buildFeedbackPayload({ ...pending, title: 'x' }, { appliedSuccessfully: true })).toBeNull();
  });

  it('nie przemyca niczego poza metadanymi oferty', () => {
    const payload = buildFeedbackPayload(pending, { appliedSuccessfully: true });
    expect(Object.keys(payload ?? {}).sort()).toEqual([
      'applicationChannel',
      'appliedSuccessfully',
      'companyName',
      'failureReason',
      'jobTitle',
      'salaryTransparency',
    ]);
  });
});

describe('buildApplicationFromPending', () => {
  it('przepisuje metadane oferty i zadaną datę', () => {
    const app = buildApplicationFromPending(pending, 'Wysłana', { today: '2026-08-26' });
    expect(app).toMatchObject({
      id: 'job-1',
      company: pending.company,
      position: pending.title,
      status: 'Wysłana',
      date: '2026-08-26',
      jobUrl: pending.sourceUrl,
      atsScore: 87,
    });
  });

  it('nie wymyśla wyniku ATS, gdy nikt go nie mierzył', () => {
    const app = buildApplicationFromPending({ ...pending, atsScore: undefined }, 'Do wysłania');
    expect(app.atsScore).toBeUndefined();
    expect(app.status).toBe('Do wysłania');
  });

  it('zachowuje wybrany wariant tylko jako metadane eksportu dokumentu', () => {
    const app = buildApplicationFromPending(
      {
        ...pending,
        documentSnapshot: {
          schemaVersion: 1,
          createdAt: '2026-09-13T10:00:00.000Z',
          tailoredResume: {} as never,
          vaultSnapshot: {} as never,
          jobOfferSnapshot: { title: pending.title, company: pending.company },
          exportedCv: {
            templateId: 'cv-07',
            templateName: 'Minimal 07',
            fit: 'ats-friendly',
            exportedAt: '2026-09-13T10:00:00.000Z',
          },
        },
      },
      'Wysłana'
    );

    expect(app.documentSnapshot?.exportedCv).toEqual({
      templateId: 'cv-07',
      templateName: 'Minimal 07',
      fit: 'ats-friendly',
      exportedAt: '2026-09-13T10:00:00.000Z',
    });
  });
});

describe('findExistingApplicationForPending', () => {
  const oldOpening = {
    ...buildApplicationFromPending(pending, 'Do wysłania'),
    id: 'old-opening',
    jobUrl: 'https://jobs.example/old',
  };
  const exactOpening = {
    ...buildApplicationFromPending(pending, 'Do wysłania'),
    id: pending.jobId,
    jobUrl: 'https://jobs.example/current',
  };
  const currentPending = {
    ...pending,
    sourceUrl: 'https://jobs.example/current',
  };

  it('priorytetyzuje dokładne ID nad wcześniejszym wpisem tej samej firmy i stanowiska', () => {
    expect(findExistingApplicationForPending([oldOpening, exactOpening], currentPending))
      .toBe(exactOpening);
  });

  it('dopasowuje wpis ręczny tylko po firmie, stanowisku i tym samym URL', () => {
    const manual = { ...oldOpening, id: 'manual-1', jobUrl: currentPending.sourceUrl };
    expect(findExistingApplicationForPending([manual], currentPending)).toBe(manual);
  });

  it('nie scala różnych ogłoszeń o tej samej nazwie ani wpisów bez URL', () => {
    expect(findExistingApplicationForPending([oldOpening], currentPending)).toBeUndefined();
    expect(findExistingApplicationForPending([{
      ...oldOpening,
      jobUrl: undefined,
    }], { ...currentPending, sourceUrl: undefined })).toBeUndefined();
  });
});

describe('buildExistingApplicationFeedbackPatch', () => {
  const snapshotA = { schemaVersion: 1, createdAt: '2026-01-01T00:00:00.000Z' } as never;
  const snapshotB = { schemaVersion: 1, createdAt: '2026-02-01T00:00:00.000Z' } as never;
  const candidate = buildApplicationFromPending({ ...pending, documentSnapshot: snapshotB }, 'Wysłana');

  it('zachowuje postęp i historyczną migawkę przy ponownym eksporcie', () => {
    const existing = {
      ...buildApplicationFromPending(pending, 'Rozmowa'),
      notes: 'Rekruter oddzwonił w czwartek.',
      documentSnapshot: snapshotA,
    };

    expect(buildExistingApplicationFeedbackPatch(existing, candidate, 'Wysłana')).toEqual({
      status: 'Rozmowa',
      notes: 'Rekruter oddzwonił w czwartek.',
      documentSnapshot: snapshotA,
    });
  });

  it('awansuje wpis roboczy i dołącza snapshot tylko wtedy, gdy brakowało go', () => {
    const existing = buildApplicationFromPending(pending, 'Do wysłania');
    expect(buildExistingApplicationFeedbackPatch(existing, candidate, 'Wysłana')).toMatchObject({
      status: 'Wysłana',
      documentSnapshot: snapshotB,
    });
  });

  it('dopina powód niepowodzenia do notatek zamiast je usuwać i nie dubluje tej samej linii', () => {
    const existing = { ...buildApplicationFromPending(pending, 'Wysłana'), notes: 'II etap: rozmowa techniczna.' };
    const note = 'Nie wysłano: oferta wygasła / błąd linku.';
    const first = buildExistingApplicationFeedbackPatch(existing, candidate, 'Do wysłania', note);
    const second = buildExistingApplicationFeedbackPatch({ ...existing, ...first }, candidate, 'Do wysłania', note);

    expect(first.notes).toBe(`II etap: rozmowa techniczna.\n${note}`);
    expect(second.notes).toBe(first.notes);
    expect(first.status).toBe('Wysłana');
  });
});

describe('noteForFailure', () => {
  it('zapisuje powód w notatce', () => {
    expect(noteForFailure('wygasla')).toContain('oferta wygasła');
  });

  it('bez powodu zostawia neutralną notatkę', () => {
    expect(noteForFailure(null)).toContain('czeka na dokończenie');
  });
});
