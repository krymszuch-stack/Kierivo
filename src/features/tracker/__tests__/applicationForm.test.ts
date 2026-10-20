import { describe, expect, it } from 'vitest';
import { hasUnknownReceiptSalary, resolveApplicationSalary } from '../applicationForm';

describe('wynagrodzenie w formularzu aplikacji', () => {
  it('zostawia nieznaną kwotę pustą przy imporcie receipt, chyba że użytkownik wpisze własną wartość', () => {
    expect(resolveApplicationSalary('', true)).toBe('');
    expect(resolveApplicationSalary('  8 500 PLN  ', true)).toBe('8 500 PLN');
  });

  it('zachowuje dotychczasową etykietę dla pustego ręcznego formularza', () => {
    expect(resolveApplicationSalary('', false)).toBe('Do negocjacji');
  });

  it('rozpoznaje brak wynagrodzenia z potwierdzenia Huntera przy późniejszej edycji', () => {
    const receiptEvents = [{ kind: 'application_sent', source: 'extension' }];
    const manualEvents = [{ kind: 'application_sent', source: 'user' }];

    expect(hasUnknownReceiptSalary('', receiptEvents)).toBe(true);
    expect(resolveApplicationSalary('', hasUnknownReceiptSalary('', receiptEvents))).toBe('');
    expect(hasUnknownReceiptSalary('', manualEvents)).toBe(false);
    expect(hasUnknownReceiptSalary('7 000 PLN', receiptEvents)).toBe(false);
  });
});
