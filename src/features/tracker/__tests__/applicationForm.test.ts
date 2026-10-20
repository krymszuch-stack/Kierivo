import { describe, expect, it } from 'vitest';
import { resolveApplicationSalary } from '../applicationForm';

describe('wynagrodzenie w formularzu aplikacji', () => {
  it('zostawia nieznaną kwotę pustą przy imporcie receipt, chyba że użytkownik wpisze własną wartość', () => {
    expect(resolveApplicationSalary('', true)).toBe('');
    expect(resolveApplicationSalary('  8 500 PLN  ', true)).toBe('8 500 PLN');
  });

  it('zachowuje dotychczasową etykietę dla pustego ręcznego formularza', () => {
    expect(resolveApplicationSalary('', false)).toBe('Do negocjacji');
  });
});
