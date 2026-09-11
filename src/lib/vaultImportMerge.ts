import { MasterVault } from '../types';
import { ParsedCVResult } from './cvUniversalParser';

function toKey(value: string | undefined): string {
  return (value || '').toLowerCase().trim();
}

function compositeKey(...parts: Array<string | undefined>): string {
  const key = parts.map(toKey).join('|');
  return key.replace(/\|/g, '') === '' ? '' : key;
}

export function mergeUnique<T>(base: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  const result = [...base];
  const seen = new Set(base.map(keyFn).filter((key) => key !== ''));

  for (const item of incoming) {
    const key = keyFn(item);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function mergeStringSets(base: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...base, ...incoming]));
}

export function mergeImportedVault(prev: MasterVault, parsed: Partial<MasterVault>): MasterVault {
  const safePrev = prev || ({} as MasterVault);
  const incomingLanguages = parsed?.profiler?.languages || [];
  return {
    ...safePrev,
    personalInfo: {
      ...(safePrev.personalInfo || {}),
      ...(parsed?.personalInfo || {}),
    },
    skillsMatrix: {
      ...(safePrev.skillsMatrix || {}),
      hardSkills: mergeStringSets(safePrev.skillsMatrix?.hardSkills, parsed?.skillsMatrix?.hardSkills),
      softSkills: mergeStringSets(safePrev.skillsMatrix?.softSkills, parsed?.skillsMatrix?.softSkills),
      toolsAndTech: mergeStringSets(
        safePrev.skillsMatrix?.toolsAndTech,
        parsed?.skillsMatrix?.toolsAndTech
      ),
      certifications: mergeUnique(
        safePrev.skillsMatrix?.certifications || [],
        parsed?.skillsMatrix?.certifications || [],
        (item) => compositeKey(item?.name)
      ),
    },
    profiler: {
      ...(safePrev.profiler || {}),
      languages: incomingLanguages.length
        ? mergeUnique(safePrev.profiler?.languages || [], incomingLanguages, (item) =>
            compositeKey(item?.language)
          )
        : safePrev.profiler?.languages || [],
    },
    history: mergeUnique(safePrev.history || [], parsed?.history || [], (item) =>
      compositeKey(item?.company, item?.role)
    ),
    education: mergeUnique(safePrev.education || [], parsed?.education || [], (item) =>
      compositeKey(item?.institution, item?.degree)
    ),
    projects: mergeUnique(safePrev.projects || [], parsed?.projects || [], (item) =>
      compositeKey(item?.name)
    ),
    updatedAt: new Date().toISOString(),
  };
}

export type ImportSectionStrategy = 'merge' | 'replace' | 'keep';

export interface ImportStrategies {
  personal: ImportSectionStrategy;
  skills: ImportSectionStrategy;
  experience: ImportSectionStrategy;
  education: ImportSectionStrategy;
}

export interface AppliedImportCounts {
  history: number;
  education: number;
  hardSkills: number;
  softSkills: number;
  toolsAndTech: number;
  certifications: number;
}

export function applyParsedCVToVault(
  prev: MasterVault,
  parsed: ParsedCVResult,
  strategies: ImportStrategies
): { vault: MasterVault; added: AppliedImportCounts } {
  const base = prev || ({} as MasterVault);

  const mergeList = <T,>(incoming: T[], existing: T[], strategy: ImportSectionStrategy, keyFn: (item: T) => string): T[] => {
    if (strategy === 'keep') return existing;
    if (strategy === 'replace') return incoming;
    return mergeUnique(existing, incoming, keyFn);
  };

  const mergeSkills = (incoming: string[], existing: string[], strategy: ImportSectionStrategy): string[] => {
    if (strategy === 'keep') return existing;
    if (strategy === 'replace') return incoming;
    return Array.from(new Set([...existing, ...incoming]));
  };

  const hardSkills = mergeSkills(parsed.hardSkills, base.skillsMatrix?.hardSkills || [], strategies.skills);
  const softSkills = mergeSkills(parsed.softSkills, base.skillsMatrix?.softSkills || [], strategies.skills);
  const toolsAndTech = mergeSkills(
    parsed.toolsAndTech,
    base.skillsMatrix?.toolsAndTech || [],
    strategies.skills
  );
  const history = parsed.history?.length
    ? mergeList(parsed.history, base.history || [], strategies.experience, (item) =>
        compositeKey(item?.company, item?.role)
      )
    : base.history || [];
  const education = parsed.education?.length
    ? mergeList(parsed.education, base.education || [], strategies.education, (item) =>
        compositeKey(item?.institution, item?.degree)
      )
    : base.education || [];
  const certifications =
    parsed.certifications?.length || strategies.skills !== 'replace'
      ? mergeList(
          parsed.certifications || [],
          base.skillsMatrix?.certifications || [],
          strategies.skills,
          (item) => compositeKey(item?.name)
        )
      : [];

  const vault: MasterVault = {
    ...base,
    personalInfo:
      strategies.personal === 'keep'
        ? base.personalInfo
        : {
            ...base.personalInfo,
            ...(parsed.personalInfo.fullName ? { fullName: parsed.personalInfo.fullName } : {}),
            ...(parsed.personalInfo.title ? { title: parsed.personalInfo.title } : {}),
            ...(parsed.personalInfo.email ? { email: parsed.personalInfo.email } : {}),
            ...(parsed.personalInfo.phone ? { phone: parsed.personalInfo.phone } : {}),
            ...(parsed.personalInfo.location ? { location: parsed.personalInfo.location } : {}),
            ...(parsed.personalInfo.summary ? { summary: parsed.personalInfo.summary } : {}),
          },
    skillsMatrix: {
      ...base.skillsMatrix,
      hardSkills,
      softSkills,
      toolsAndTech,
      certifications,
    },
    history,
    education,
    profiler: {
      ...base.profiler,
      languages:
        parsed.languages && parsed.languages.length > 0
          ? mergeUnique(base.profiler?.languages || [], parsed.languages, (item) =>
              compositeKey(item?.language)
            )
          : base.profiler?.languages || [],
    },
    projects:
      parsed.projects && parsed.projects.length > 0
        ? mergeUnique(base.projects || [], parsed.projects, (item) => compositeKey(item?.name))
        : base.projects || [],
    updatedAt: new Date().toISOString(),
  };

  const countAdded = <T,>(next: T[], before: T[] | undefined): number =>
    Math.max(0, next.length - (before?.length || 0));

  return {
    vault,
    added: {
      history: countAdded(history, base.history),
      education: countAdded(education, base.education),
      hardSkills: countAdded(hardSkills, base.skillsMatrix?.hardSkills),
      softSkills: countAdded(softSkills, base.skillsMatrix?.softSkills),
      toolsAndTech: countAdded(toolsAndTech, base.skillsMatrix?.toolsAndTech),
      certifications: countAdded(certifications, base.skillsMatrix?.certifications),
    },
  };
}
