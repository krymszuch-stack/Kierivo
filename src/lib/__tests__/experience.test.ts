import { describe, it, expect } from 'vitest';
import { unionExperienceYears } from '../experience';

describe('experience — unia przedziałów (F5)', () => {
  it('rozłączne okresy sumują się w całości', () => {
    expect(unionExperienceYears([
      { id: '1', startDate: '2020-01', endDate: '2022-01', isCurrent: false },
      { id: '2', startDate: '2022-01', endDate: '2024-01', isCurrent: false },
    ])).toBeCloseTo(4, 1);
  });

  it('nakładka liczy się raz (4 naiwnie → 3 unią)', () => {
    expect(unionExperienceYears([
      { id: '1', startDate: '2020-01', endDate: '2022-01', isCurrent: false },
      { id: '2', startDate: '2021-01', endDate: '2023-01', isCurrent: false },
    ])).toBeCloseTo(3, 1);
  });

  it('identyczny okres dwa razy to nadal jeden okres', () => {
    expect(unionExperienceYears([
      { id: '1', startDate: '2020-01', endDate: '2022-01', isCurrent: false },
      { id: '2', startDate: '2020-01', endDate: '2022-01', isCurrent: false },
    ])).toBeCloseTo(2, 1);
  });

  it('bieżące zatrudnienie kończy się dziś (dodatnio)', () => {
    const years = unionExperienceYears([
      { id: '1', startDate: '2020-01', endDate: '', isCurrent: true },
    ]);
    expect(years).toBeGreaterThan(2);
  });

  it('śmieci nie liczą się: brak daty, odwrócenie, przyszłość', () => {
    expect(unionExperienceYears([
      { id: '1', startDate: '', endDate: '2022-01', isCurrent: false },
      { id: '2', startDate: '2023-01', endDate: '2020-01', isCurrent: false },
      { id: '3', startDate: '2099-01', endDate: '2100-01', isCurrent: false },
    ])).toBe(0);
  });
});
