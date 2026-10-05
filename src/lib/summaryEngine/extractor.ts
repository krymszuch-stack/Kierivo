import { MasterVault } from '../../types';
import { parseMonthYear } from '../dateUtils';
import { getLatestExperience, inferLatestExperienceRole } from '../experienceChronology';
import { ExtractedProfileData } from './types';

function monthIndex(value: string): number | null {
  const parsed = parseMonthYear(value);
  if (!parsed || !/^\d{4}-\d{2}$/.test(parsed)) return null;
  const [year, month] = parsed.split('-').map(Number);
  return year * 12 + month - 1;
}

/**
 * Liczy pełne lata z unii potwierdzonych przedziałów, aby równoległe etaty
 * nie podwajały stażu. Niedatowane zakończenie nie oznacza pracy obecnej.
 */
export function calculateYearsOfExperience(history: MasterVault['history']): number {
  if (!history || history.length === 0) return 0;
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const intervals = history.flatMap((item) => {
    const start = monthIndex(item.startDate);
    const end = item.isCurrent ? currentMonth : monthIndex(item.endDate || '');
    if (start === null || end === null || end < start) return [];
    return [{ start, end }];
  }).sort((a, b) => a.start - b.start);

  let months = 0;
  let active: { start: number; end: number } | null = null;
  for (const interval of intervals) {
    if (!active) {
      active = { ...interval };
    } else if (interval.start <= active.end + 1) {
      active.end = Math.max(active.end, interval.end);
    } else {
      months += active.end - active.start + 1;
      active = { ...interval };
    }
  }
  if (active) months += active.end - active.start + 1;
  return Math.floor(months / 12);
}

/** Wyciąga tylko wpisy podane w Vault; etykieta zawodu nie tworzy doświadczenia. */
export function extractProfileFromVault(vault: MasterVault): ExtractedProfileData {
  const latestExperience = getLatestExperience(vault.history);
  const title = (vault.personalInfo?.title || inferLatestExperienceRole(vault.history)).trim();
  const topSkills = [...new Set((vault.skillsMatrix?.hardSkills || [])
    .map((skill) => skill.trim())
    .filter(Boolean))].slice(0, 6);
  const workEntries = (vault.history || [])
    .filter((item) => item.role && item.role.trim())
    .slice(0, 3)
    .map((item) => ({ role: item.role.trim(), company: (item.company || '').trim() }));
  const sourceHighlight = (latestExperience?.highlights || [])
    .map((item) => item.text.trim())
    .find(Boolean) || '';

  return {
    title,
    yearsOfExperience: calculateYearsOfExperience(vault.history),
    topSkills,
    workEntries,
    sourceHighlight,
  };
}
