import { describe, expect, it } from 'vitest';
import { getRuleBasedReply } from './advisorRules';

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
});
