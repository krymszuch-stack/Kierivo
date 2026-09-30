import { describe, expect, it } from 'vitest';
import { getApplicationDisplayInfo, getApplicationSnapshotDisplayInfo } from '../applicationDisplay';

describe('Etykiety aplikacji w trackerze', () => {
  it.each(['Nieznana firma', '', '   ', null, undefined])(
    'ukrywa placeholder lub pustą nazwę firmy (%s) we wszystkich etykietach',
    (company) => {
      const display = getApplicationDisplayInfo({ company, position: 'Specjalistka wsparcia IT' });

      expect(display.company).toBe('');
      expect(display.companyLabel).toBe('Nie podano firmy');
      expect(display.applicationLabel).toBe('Specjalistka wsparcia IT');
      expect(display.contextLabel).toBe('Specjalistka wsparcia IT — nie podano firmy');
      expect(display.contextLabel).not.toContain('Nieznana firma');
    },
  );

  it('zachowuje rzeczywistą firmę i poprawia widok brakującego stanowiska', () => {
    expect(getApplicationDisplayInfo({ company: 'Testowa Firma', position: 'Stanowisko' })).toMatchObject({
      company: 'Testowa Firma',
      companyLabel: 'Testowa Firma',
      position: '',
      positionLabel: 'Nie podano stanowiska',
      applicationLabel: 'Testowa Firma',
      contextLabel: 'Testowa Firma — Nie podano stanowiska',
      initial: 'T',
    });
  });

  it('etykietuje dokument z niezmiennej oferty snapshotu po zmianie metadanych aplikacji', () => {
    const display = getApplicationSnapshotDisplayInfo({
      company: 'Testowa Firma — metadane edytowane',
      position: 'Support Analyst — metadane edytowane',
      documentSnapshot: {
        jobOfferSnapshot: {
          company: 'Testowa Firma — Lokalny Audyt',
          title: 'Audit Sample Support',
        },
      },
    });

    expect(display.companyLabel).toBe('Testowa Firma — Lokalny Audyt');
    expect(display.positionLabel).toBe('Audit Sample Support');
  });

  it('nie pobiera aktualnej firmy do etykiety migawki, jeśli w ofercie historycznej jej nie było', () => {
    const display = getApplicationSnapshotDisplayInfo({
      company: 'Firma dodana później',
      position: 'Stanowisko zmienione później',
      documentSnapshot: { jobOfferSnapshot: { company: '', title: 'Rola historyczna' } },
    });

    expect(display.companyLabel).toBe('Nie podano firmy');
    expect(display.positionLabel).toBe('Rola historyczna');
  });
});
