import { describe, expect, it } from 'vitest';
import { getRuleBasedReply } from './advisorRules';
import type { AdvisorContext } from './advisorContext';

describe('lokalne reguły Doradcy', () => {
  it.each([
    ['Jak poprawić CV pod ATS?', 'czytelność dla parserów'],
    ['Jak wpisać lukę w CV po zmianie branży?', 'zmiana branży lub luka'],
    ['Czy dodawać zdjęcie do CV?', 'zdjęcie i wygląd'],
    ['Jak opisać osiągnięcia bez wymyślania liczb?', 'osiągnięcia'],
    ['Co powiedzieć na rozmowie metodą STAR?', 'metoda STAR'],
  ])('rozpoznaje temat: %s', (question, topic) => {
    expect(getRuleBasedReply(question).topic).toBe(topic);
  });

  it('nie zwraca tej samej ogólnej odpowiedzi dla nieobsłużonego pytania', () => {
    const reply = getRuleBasedReply('Czy mogę pracować hybrydowo w Gdańsku?');
    expect(reply.topic).toBe('brak reguły dla pytania');
    expect(reply.text).toContain('nie będę udawać odpowiedzi AI');
    expect(reply.text).toContain('Gdańsku');
  });

  it('wyjaśnia słaby wynik przez fakty z ostatniej analizy', () => {
    const context: AdvisorContext = {
      offerTitle: 'Specjalista wsparcia IT',
      score: 50,
      missingHardSkills: ['Active Directory', 'Jira'],
      matchedKeywords: [],
      structuralWarnings: ['Brak standardowej sekcji: Umiejętności.'],
      formattingWarnings: [],
      missingProfileSections: ['Umiejętności twarde'],
      hasLanguages: false,
      lexicon: [{ term: 'Active Directory', source: 'luka' }],
    };
    const reply = getRuleBasedReply('Czy mam dobre CV pod ATS?', context);
    expect(reply.topic).toBe('aktualna analiza CV');
    expect(reply.text).toContain('50/100');
    expect(reply.text).toContain('Active Directory');
    expect(reply.text).toContain('Umiejętności twarde');
    expect(reply.text).toContain('zewnętrznego ATS');
  });
});
