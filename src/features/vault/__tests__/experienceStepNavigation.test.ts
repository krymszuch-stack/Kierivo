import { describe, it, expect } from 'vitest';
import { createEmptyVault } from '../../../lib/sampleVault';
import {
  validateExperienceStep,
  canNavigateToNextStep,
} from '../experienceValidation';
import type { WorkExperience } from '../../../types';

describe('Krok Doświadczenie — progresywna walidacja i nawigacja do kroku 3', () => {
  it('świeży profil: brak doświadczenia blokuje przejście do kroku 3', () => {
    const emptyVault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    expect(emptyVault.history).toEqual([]);

    const validation = validateExperienceStep(emptyVault.history);
    expect(validation.isValid).toBe(false);
    expect(validation.message).toContain('Dodaj co najmniej jedno stanowisko pracy');

    const nav = canNavigateToNextStep(1, emptyVault.history);
    expect(nav.allowed).toBe(false);
    expect(nav.nextStep).toBe(1); // pozostaje w kroku 2 (indeks 1)
  });

  it('dodanie wpisu bez wymaganych pól generuje błędy inline pod konkretnym polem', () => {
    const incompleteItem: WorkExperience = {
      id: 'exp-test-1',
      company: '   ',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      highlights: [],
    };

    const validation = validateExperienceStep([incompleteItem]);
    expect(validation.isValid).toBe(false);
    expect(validation.errors['exp-test-1']).toBeDefined();
    expect(validation.errors['exp-test-1']?.company).toBe('Nazwa firmy jest wymagana');
    expect(validation.errors['exp-test-1']?.role).toBe('Nazwa stanowiska jest wymagana');

    const nav = canNavigateToNextStep(1, [incompleteItem]);
    expect(nav.allowed).toBe(false);
    expect(nav.nextStep).toBe(1);
  });

  it('E2E Flow: świeży profil → dodanie firmy i stanowiska → klik Dalej bez opisu i osiągnięć → przejście do kroku 3', () => {
    // Krok 1: Inicjalizacja pustego profilu
    const vault = createEmptyVault('Piotr Nowak', 'piotr.nowak@example.com');
    expect(vault.history).toHaveLength(0);

    let activeStep = 1; // Krok 2 z 6 (indeks 1: Doświadczenie)

    // Krok 2: Użytkownik próbuje przejść dalej bez wpisania czegokolwiek
    let navResult = canNavigateToNextStep(activeStep, vault.history);
    expect(navResult.allowed).toBe(false);
    if (navResult.allowed) activeStep = navResult.nextStep;
    expect(activeStep).toBe(1); // nadal krok 2

    // Krok 3: Użytkownik dodaje firmę i stanowisko (bez opisu, dat, ani osiągnięć STAR)
    const newExperience: WorkExperience = {
      id: 'exp-minimal-1',
      company: 'Termo-Instal Serwis',
      role: 'Monter Urządzeń Grzewczych',
      location: 'Kraków',
      startDate: '',
      endDate: '',
      isCurrent: true,
      description: '',
      highlights: [],
    };
    vault.history = [newExperience];

    // Krok 4: Kliknięcie "Dalej"
    const validation = validateExperienceStep(vault.history);
    expect(validation.isValid).toBe(true);
    expect(Object.keys(validation.errors)).toHaveLength(0);

    navResult = canNavigateToNextStep(activeStep, vault.history);
    expect(navResult.allowed).toBe(true);
    expect(navResult.nextStep).toBe(2); // przejście do indeksu 2 (Krok 3 z 6: Projekty)

    activeStep = navResult.nextStep;
    expect(activeStep).toBe(2); // potwierdzenie przejścia do kroku 3
  });

  it('gdy dodano 2 wpisy i jeden nie ma nazwy firmy, wskazuje błąd tylko przy wybrakowanym wpisie', () => {
    const validExp: WorkExperience = {
      id: 'exp-valid',
      company: 'Elektro-Bud',
      role: 'Elektryk',
      location: 'Warszawa',
      startDate: '2021-01',
      endDate: '2023-05',
      isCurrent: false,
      description: '',
      highlights: [],
    };

    const incompleteExp: WorkExperience = {
      id: 'exp-missing-company',
      company: '',
      role: 'Pomocnik Elektryka',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      highlights: [],
    };

    const validation = validateExperienceStep([validExp, incompleteExp]);
    expect(validation.isValid).toBe(false);
    expect(validation.errors['exp-valid']).toBeUndefined();
    expect(validation.errors['exp-missing-company']?.company).toBe('Nazwa firmy jest wymagana');
    expect(validation.errors['exp-missing-company']?.role).toBeUndefined();
  });
});
