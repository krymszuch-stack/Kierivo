import { describe, expect, it } from 'vitest';
import {
  buildApplicationFromPending,
  buildFeedbackPayload,
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

describe('noteForFailure', () => {
  it('zapisuje powód w notatce', () => {
    expect(noteForFailure('wygasla')).toContain('oferta wygasła');
  });

  it('bez powodu zostawia neutralną notatkę', () => {
    expect(noteForFailure(null)).toContain('czeka na dokończenie');
  });
});
