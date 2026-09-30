import { describe, expect, it } from 'vitest';
import type { ProfilerState } from '../../../types';
import { getProfileRecommendations } from '../profileRecommendations';

function profiler(overrides: Partial<ProfilerState> = {}): ProfilerState {
  return {
    flags: ['OFFICE_IT'],
    experienceLevel: 'MID',
    autoDetermineSeniority: true,
    location: {
      city: '',
      radiusKm: 30,
      remoteOnly: false,
      hybridWork: false,
      willingnessToTravel: false,
    },
    languages: [],
    licenses: [],
    ...overrides,
  };
}

describe('rekomendacje materiałów w Poradach', () => {
  it('nie nazywa rekomendacji personalizowanymi, gdy profil nie ma sygnału dopasowania', () => {
    expect(getProfileRecommendations(undefined)).toEqual([]);
    expect(getProfileRecommendations(profiler())).toEqual([]);
  });

  it('dobiera materiał do jawnego celu i nie dorzuca losowo SEP, UDT ani dofinansowania', () => {
    const result = getProfileRecommendations(profiler({ careerGoal: 'FIRST_JOB' }));

    expect(result.map(({ materialId }) => materialId)).toEqual([
      'praca-od-podstaw-bez-doswiadczenia',
    ]);
  });

  it('poleca ścieżkę UDT tylko dla wybranego zawodu operatora i tylko bez uprawnienia', () => {
    const role = profiler({ subRoleId: 'warehouse_forklift_operator' });
    expect(getProfileRecommendations(role).map(({ materialId }) => materialId)).toContain(
      'sciezka-operator-wozka-widlowego',
    );
    expect(
      getProfileRecommendations({ ...role, licenses: ['udt_forklift'] }).map(
        ({ materialId }) => materialId,
      ),
    ).not.toContain('sciezka-operator-wozka-widlowego');
  });

  it.each(['sep_g3_e', 'sep_g3_d'])('uwzględnia dokładny nowy wybór SEP %s', (licenseId) => {
    const role = profiler({ subRoleId: 'gas_heating_technician' });
    expect(getProfileRecommendations(role).map(({ materialId }) => materialId)).toContain(
      'uprawnienia-sep-g1-g2-g3',
    );
    expect(
      getProfileRecommendations({ ...role, licenses: [licenseId] }).map(
        ({ materialId }) => materialId,
      ),
    ).not.toContain('uprawnienia-sep-g1-g2-g3');
  });

  it('zachowuje osobny materiał dla jawnie wybranego celu zmiany zawodu', () => {
    expect(
      getProfileRecommendations(profiler({ careerGoal: 'CAREER_CHANGE' })).map(
        ({ materialId }) => materialId,
      ),
    ).toContain('umiejetnosci-przenosne-most-kompetencji');
  });
});
