import { describe, it, expect } from 'vitest';
import {
  detectIndustryFromRole,
  getStarContextConfig,
} from '../starContextHelper';

describe('starContextHelper — Dynamiczne dopasowanie kontekstu STAR do stanowiska', () => {
  it('rozpoznaje zawody medyczne (lekarz, pielęgniarka, ratownik)', () => {
    expect(detectIndustryFromRole('Lekarz / Pielęgniarka / Ratownik Medyczny')).toBe('medical');
    expect(detectIndustryFromRole('Lekarz rezydent SOR')).toBe('medical');
    expect(detectIndustryFromRole('Pielęgniarka anestezjologiczna')).toBe('medical');

    const config = getStarContextConfig('Lekarz / Pielęgniarka');
    expect(config.domain).toBe('medical');
    expect(config.domainLabel).toContain('Medycyna');
    expect(config.placeholder).toContain('pacjentów');
    expect(config.defaultVerbs.some((v) => v.includes('triage') || v.includes('procedury'))).toBe(true);
  });

  it('rozpoznaje zawody techniczne i produkcyjne (monter, spawacz, serwisant)', () => {
    expect(detectIndustryFromRole('Monter instalacji gazowych i CO')).toBe('tech');
    expect(detectIndustryFromRole('Spawacz TIG / MAG (UDT)')).toBe('tech');
    expect(detectIndustryFromRole('Technik serwisu')).toBe('tech');

    const config = getStarContextConfig('Monter instalacji');
    expect(config.domain).toBe('tech');
    expect(config.placeholder).toContain('awarii');
  });

  it('rozpoznaje logistykę i magazyn (magazynier, wózkowy, kierowca)', () => {
    expect(detectIndustryFromRole('Operator wózka widłowego (UDT)')).toBe('logistics');
    expect(detectIndustryFromRole('Magazynier - kompletacja zamówień')).toBe('logistics');

    const config = getStarContextConfig('Magazynier');
    expect(config.domain).toBe('logistics');
    expect(config.placeholder).toContain('WMS');
  });

  it('rozpoznaje sprzedaż i obsługę klienta', () => {
    expect(detectIndustryFromRole('Doradca Klienta B2B')).toBe('sales');
    expect(detectIndustryFromRole('Przedstawiciel handlowy')).toBe('sales');

    const config = getStarContextConfig('Specjalista ds. sprzedaży');
    expect(config.domain).toBe('sales');
    expect(config.placeholder).toContain('kontrahentami');
  });

  it('rozpoznaje zarządzanie i administrację', () => {
    expect(detectIndustryFromRole('Kierownik Zespołu')).toBe('mgmt');
    expect(detectIndustryFromRole('Dyrektor operacyjny')).toBe('mgmt');

    const config = getStarContextConfig('Menedżer projektu');
    expect(config.domain).toBe('mgmt');
    expect(config.placeholder).toContain('zespole');
  });

  it('rozpoznaje IT & Software', () => {
    expect(detectIndustryFromRole('Senior React Developer')).toBe('it');
    expect(detectIndustryFromRole('Inżynier oprogramowania')).toBe('it');
    expect(detectIndustryFromRole('Tester oprogramowania')).toBe('it');
    expect(detectIndustryFromRole('Tester fikcyjnego procesu')).toBe('general');
    expect(detectIndustryFromRole('Tester jakości produkcji')).toBe('general');

    const config = getStarContextConfig('Fullstack Developer');
    expect(config.domain).toBe('it');
    expect(config.placeholder).toContain('mikroserwisów');
  });

  it('dla pustego lub nietypowego stanowiska zwraca uniwersalny szablon dla każdego zawodu', () => {
    expect(detectIndustryFromRole('')).toBe('general');
    expect(detectIndustryFromRole(undefined)).toBe('general');
    expect(detectIndustryFromRole('Nietypowa Rola')).toBe('general');

    const config = getStarContextConfig('Nietypowa Rola');
    expect(config.domain).toBe('general');
    expect(config.placeholder).toContain('[zadanie/projekt]');
    expect(config.domainLabel).toContain('Uniwersalne');
  });
});
