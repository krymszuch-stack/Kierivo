import { describe, expect, it } from 'vitest';
import { getApplicationDisplayInfo, getApplicationSnapshotDisplayInfo, getAtsScoreDisplayInfo } from '../applicationDisplay';

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

  it('nie przedstawia starego wyniku bez kontekstu jako potwierdzonej pełnej oceny', () => {
    const display = getAtsScoreDisplayInfo(84);

    expect(display.state).toBe('unknown');
    expect(display.label).toBe('Wynik historyczny: 84%');
    expect(display.note).toContain('zakres tej oceny jest nieznany');
  });

  it('zachowuje ostrzeżenie dla historycznego wyniku z jednym wymaganiem', () => {
    const display = getAtsScoreDisplayInfo(84, {
      detectedRequirementCount: 1,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2,
    });

    expect(display.state).toBe('limited');
    expect(display.label).toBe('Wynik wstępny: 84%');
    expect(display.note).toContain('rozpoznano tylko 1 wymaganie');
  });

  it('pokazuje jednocześnie niespełniony i niepotwierdzony wymóg formalny w zapisanym wyniku', () => {
    const display = getAtsScoreDisplayInfo(62, {
      detectedRequirementCount: 5,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 1,
      unconfirmedBlockingRequirementCount: 1, unconfirmedRequirementCount: 1,
      scoreContextVersion: 5,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2,
    });

    expect(display.state).toBe('limited');
    expect(display.note).toContain('1 wymogu, który oferta oznacza jako obowiązkowy');
    expect(display.note).toContain('1 wymóg formalny wymaga potwierdzenia');
    expect(display.note).toContain('brak danych nie oznacza ich spełnienia ani niespełnienia');
  });

  it('podaje kontekst historycznego wyniku, gdy zakres danych nie był ograniczony', () => {
    const display = getAtsScoreDisplayInfo(84, {
      detectedRequirementCount: 5,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5,
      careerEvidenceAvailable: true,
      careerEvidenceVersion: 2,
    });

    expect(display.state).toBe('full');
    expect(display.label).toBe('Wynik Kierivo: 84%');
    expect(display.note).toContain('5 rozpoznanych wymaganiach');
  });

  it('nie uznaje historycznego kontekstu bez danych o karierze za pelny wynik', () => {
    const display = getAtsScoreDisplayInfo(84, {
      detectedRequirementCount: 5,
      profileCompleteness: 100,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5,
    });

    expect(display.state).toBe('unknown');
    expect(display.label).toBe('Wynik historyczny: 84%');
  });

  it('oznacza wynik jako wstepny, gdy profil nie ma historii ani projektu', () => {
    const display = getAtsScoreDisplayInfo(69, {
      detectedRequirementCount: 5,
      profileCompleteness: 86,
      unmetBlockingRequirementCount: 0,
      unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0,
      scoreContextVersion: 5,
      careerEvidenceAvailable: false,
      careerEvidenceVersion: 2,
    });

    expect(display.state).toBe('limited');
    expect(display.label).toBe('Wynik wst\u0119pny: 69%');
    expect(display.note).toContain('nie potwierdza dopasowania zawodowego');
  });
});
