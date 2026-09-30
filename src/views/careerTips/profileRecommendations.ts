import type { ProfilerState } from '../../types';
import { ALL_LICENSES } from '../../data/licenses';

export interface ProfileRecommendation {
  title: string;
  hint: string;
  materialId: string;
}

const SEP_IDS = new Set(
  ALL_LICENSES.filter(({ id }) => id.startsWith('sep_')).map(({ id }) => id),
);

function hasSep(profiler: ProfilerState): boolean {
  return (profiler.licenses ?? []).some((id) => SEP_IDS.has(id));
}

function hasSepGroup(profiler: ProfilerState, group: 1 | 2 | 3): boolean {
  const groupPrefix = `sep_g${group}`;
  return (profiler.licenses ?? []).some(
    (id) => id === groupPrefix || id.startsWith(`${groupPrefix}_`) ||
      (group === 1 && id === 'sep_1kv'),
  );
}

/**
 * Zwraca tylko materiały, których związek z profilem wynika z zapisanej
 * intencji lub jawnie wybranego zawodu. Brak danych nie oznacza rekomendacji.
 */
export function getProfileRecommendations(
  profiler?: ProfilerState,
): ProfileRecommendation[] {
  if (!profiler) return [];

  const recommendations: ProfileRecommendation[] = [];
  const licenses = profiler.licenses ?? [];

  if (profiler.careerGoal === 'FIRST_JOB' || profiler.careerGoal === 'UNDECIDED') {
    recommendations.push({
      title: 'Jak znaleźć pracę, której można nauczyć się od podstaw',
      hint: 'Materiał dla osób zaczynających lub szukających kierunku.',
      materialId: 'praca-od-podstaw-bez-doswiadczenia',
    });
  }

  if (profiler.careerGoal === 'CAREER_CHANGE') {
    recommendations.push({
      title: 'Jak znaleźć umiejętności przenośne — z prac fizycznych do biura',
      hint: 'Jak pokazać most kompetencji w podsumowaniu i nie zaczynać od zera.',
      materialId: 'umiejetnosci-przenosne-most-kompetencji',
    });
  }

  if (
    profiler.subRoleId === 'warehouse_forklift_operator' &&
    !licenses.includes('udt_forklift')
  ) {
    recommendations.push({
      title: 'Operator wózka widłowego — uprawnienia UDT',
      hint: 'Wybrany zawód wymienia uprawnienia do obsługi wózków jezdniowych.',
      materialId: 'sciezka-operator-wozka-widlowego',
    });
  }

  const isElectricalRole = profiler.subRoleId === 'electrician_sep_g1';
  const isGasHeatingRole = profiler.subRoleId === 'gas_heating_technician';
  const isHvACRole = profiler.subRoleId === 'hvac_klimatyzacja';
  const needsSep =
    (isElectricalRole && !hasSepGroup(profiler, 1)) ||
    (isGasHeatingRole && !hasSepGroup(profiler, 3)) ||
    (isHvACRole && !hasSep(profiler));

  if (needsSep) {
    recommendations.push({
      title: 'Jak zdobyć uprawnienia SEP (G1, G2, G3)',
      hint: 'Wybrany zawód wymienia uprawnienia SEP; sprawdź wymagany zakres E/D i grupę.',
      materialId: 'uprawnienia-sep-g1-g2-g3',
    });
  }

  return recommendations.slice(0, 4);
}
