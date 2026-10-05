import { describe, expect, it } from 'vitest';
import { getCanonicalScoreMetricLabel, getMatchInterpretation, shouldDisplayMappedEvidence } from '../matchInterpretation';

describe('interpretacja wyniku dopasowania', () => {
  it('nie pokazuje zastępczego wyniku, gdy kanon nie ma oceny', () => {
    expect(getMatchInterpretation({
      score: null,
      reason: 'Brak podstaw do oceny.',
      activeSuggestionCount: 0,
    })).toBe('Brak podstaw do oceny.');
  });

  it('odsyła do sugestii tylko wtedy, gdy widok ma aktywne sugestie', () => {
    const withSuggestions = getMatchInterpretation({ score: 73, activeSuggestionCount: 2 });
    const withoutSuggestions = getMatchInterpretation({ score: 73, activeSuggestionCount: 0 });

    expect(withSuggestions).toContain('Sprawdź poniższe sugestie');
    expect(withoutSuggestions).not.toContain('poniższe sugestie');
    expect(withoutSuggestions).toContain('ani aktywnych sugestii');
  });

  it('zachowuje priorytet konkretnej luki nad ogólnym komunikatem o sugestiach', () => {
    const message = getMatchInterpretation({
      score: 73,
      mainGap: 'PowerShell',
      activeSuggestionCount: 1,
    });

    expect(message).toContain('PowerShell');
    expect(message).not.toContain('poniższe sugestie');
  });

  it('nie nazywa wysokiego wyniku dobrym dopasowaniem, gdy profil jest uzupełniony w mniej niż połowie', () => {
    const message = getMatchInterpretation({
      score: 77,
      activeSuggestionCount: 0,
      profileCompleteness: 18,
      matchedRequirementCount: 1,
      totalRequirementCount: 1,
    });

    expect(message).toContain('profil jest uzupełniony w 18%');
    expect(message).toContain('rozpoznano tylko 1 wymaganie');
    expect(message).toContain('Potwierdzono 1 z 1 rozpoznanych wymagań');
    expect(message).not.toContain('Świetne dopasowanie');
  });

  it('ogranicza etykietę wyniku, gdy kompletność profilu jest wysoka, ale oferta dała tylko jedno wymaganie', () => {
    const message = getMatchInterpretation({
      score: 92,
      activeSuggestionCount: 0,
      profileCompleteness: 86,
      matchedRequirementCount: 1,
      totalRequirementCount: 1,
    });

    expect(message).toContain('Wynik wstępny');
    expect(message).toContain('rozpoznano tylko 1 wymaganie');
    expect(message).toContain('Potwierdzono 1 z 1 rozpoznanych wymagań');
    expect(message).not.toContain('Świetne dopasowanie');
  });

  it('nie ogranicza wyniku z powodu małej próbki, gdy rozpoznano co najmniej trzy wymagania', () => {
    const message = getMatchInterpretation({
      score: 92,
      activeSuggestionCount: 0,
      profileCompleteness: 86,
      matchedRequirementCount: 3,
      totalRequirementCount: 3,
    });

    expect(message).toContain('Świetne dopasowanie');
  });

  it('oznacza wynik jako wstępny, gdy brak dowodów do oceny dopasowania kariery', () => {
    const message = getMatchInterpretation({
      score: 69,
      activeSuggestionCount: 0,
      profileCompleteness: 86,
      matchedRequirementCount: 3,
      totalRequirementCount: 5,
      fitEvidenceAvailable: false,
    });

    expect(message).toContain('Wynik wstępny');
    expect(message).toContain('brakuje podstaw do rzetelnej oceny dopasowania zawodowego');
    expect(message).not.toContain('Świetne dopasowanie');
  });

  it('rozdziela ograniczenia przecinkami zamiast sklejać wiele przyczyn jednym spójnikiem', () => {
    const message = getMatchInterpretation({
      score: 15,
      activeSuggestionCount: 0,
      profileCompleteness: 0,
      matchedRequirementCount: 0,
      totalRequirementCount: 2,
      fitEvidenceAvailable: false,
    });

    expect(message).toContain('Wynik wstępny. Ograniczenia: profil jest uzupełniony w 0%; rozpoznano tylko 2 wymagania; brakuje podstaw do rzetelnej oceny dopasowania zawodowego.');
    expect(message).toContain('Potwierdzono 0 z 2 rozpoznanych wymagań.');
  });

  it('nie poleca dopasowania przy niepotwierdzonym wymogu blokujacym', () => {
    const message = getMatchInterpretation({
      score: 85,
      activeSuggestionCount: 0,
      profileCompleteness: 100,
      totalRequirementCount: 5,
      fitEvidenceAvailable: true,
      blockingRequirements: ['Uprawnienia spawalnicze TIG'],
    });

    expect(message).toContain('Uprawnienia spawalnicze TIG');
    expect(message).not.toContain('Swietne dopasowanie');
  });

  it('opisuje niepotwierdzony staż jako wymóg nierozstrzygnięty, a nie problem aktualności', () => {
    const message = getMatchInterpretation({
      score: 94,
      activeSuggestionCount: 0,
      totalRequirementCount: 4,
      matchedRequirementCount: 3,
      unconfirmedRequirements: ['Min. 5 lat doświadczenia'],
    });

    expect(message).toContain('Nie można potwierdzić: Min. 5 lat doświadczenia');
    expect(message).toContain('wiarygodnych danych potrzebnych do ich oceny');
    expect(message).toContain('te wymogi nie obniżają wyniku jako braki');
    expect(message).not.toContain('aktualności');
  });
  it('ukrywa przypuszczalne braki z mapera, gdy analiza kanoniczna nie uznała oferty za możliwą do oceny', () => {
    expect(shouldDisplayMappedEvidence('NO_REQUIREMENTS_DETECTED')).toBe(false);
    expect(shouldDisplayMappedEvidence('INSUFFICIENT_CV')).toBe(false);
    expect(shouldDisplayMappedEvidence('SCORABLE')).toBe(true);
    expect(shouldDisplayMappedEvidence(undefined)).toBe(true);
  });
  it('nazywa wynik wstepny zgodnie z ograniczona podstawa', () => {
    expect(getCanonicalScoreMetricLabel(true, 'Dopasowanie profilu')).toBe('Wstępny wynik');
    expect(getCanonicalScoreMetricLabel(false, 'Dopasowanie profilu')).toBe('Dopasowanie profilu');
  });

});
