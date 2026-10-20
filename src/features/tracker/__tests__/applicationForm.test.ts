import { describe, expect, it } from 'vitest';
import { resolveApplicationSalary } from '../applicationForm';

describe('wynagrodzenie w formularzu aplikacji', () => {
  it('zachowuje brak danych i zapisuje wyłącznie jawną wartość użytkownika', () => {
    expect(resolveApplicationSalary('')).toBe('');
    expect(resolveApplicationSalary('   ')).toBe('');
    expect(resolveApplicationSalary('  8 500 PLN  ')).toBe('8 500 PLN');
    expect(resolveApplicationSalary('Do negocjacji')).toBe('Do negocjacji');
  });
});
