import { describe, expect, it } from 'vitest';
import { getLatestExperience, inferLatestExperienceRole } from '../experienceChronology';

describe('experienceChronology', () => {
  const older = { role: 'Magazynier', company: 'Starsza firma', startDate: '2018-01', endDate: '2020-12', isCurrent: false };
  const newer = { role: 'Technik wsparcia IT', company: 'Nowsza firma', startDate: '2022-01', endDate: '2024-06', isCurrent: false };

  it('wybiera najnowszą rolę i wpis według dat, niezależnie od kolejności tablicy', () => {
    expect(inferLatestExperienceRole([older, newer])).toBe('Technik wsparcia IT');
    expect(inferLatestExperienceRole([newer, older])).toBe('Technik wsparcia IT');
    expect(getLatestExperience([older, newer])).toEqual(newer);
    expect(getLatestExperience([newer, older])).toEqual(newer);
  });

  it('nie wybiera firmy ani metryki, gdy wpisy mogą być równie najnowsze', () => {
    const overlapping = { ...newer, role: 'Administrator', endDate: '2024' };
    expect(inferLatestExperienceRole([newer, overlapping])).toBe('');
    expect(getLatestExperience([newer, overlapping])).toBeNull();
  });

  it('pozwala podać wspólną rolę dla niejednoznacznych zakresów, ale nie przypisuje wpisu', () => {
    const sameRole = { ...newer, company: 'Inna firma', endDate: '2024' };
    expect(inferLatestExperienceRole([newer, sameRole])).toBe('Technik wsparcia IT');
    expect(getLatestExperience([newer, sameRole])).toBeNull();
  });

  it('przy wielu aktywnych rolach nie zgaduje, która firma lub metryka jest główna', () => {
    const secondCurrent = { ...newer, role: 'Koordynator', company: 'Druga firma', isCurrent: true };
    const firstCurrent = { ...older, isCurrent: true };
    expect(inferLatestExperienceRole([firstCurrent, secondCurrent])).toBe('');
    expect(getLatestExperience([firstCurrent, secondCurrent])).toBeNull();
  });

  it('dla pojedynczego wpisu nie wymaga dat, bo nie ma konkurencyjnej pozycji', () => {
    const one = { role: 'Monter', company: 'Jedna firma', startDate: '', endDate: '', isCurrent: false };
    expect(inferLatestExperienceRole([one])).toBe('Monter');
    expect(getLatestExperience([one])).toEqual(one);
  });
});
