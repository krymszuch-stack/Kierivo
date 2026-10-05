import type { MasterVault, TailoredResume } from '../types';
import { ALL_LICENSES } from '../data/licenses';

export type ManualCvOverrides = Partial<{ title: string; summary: string }>;

/** Ręczna zmiana w podglądzie ma pierwszeństwo przed wersją z dopasowania. */
export function applyManualCvOverrides(
  tailoredResume: TailoredResume | null | undefined,
  overrides: ManualCvOverrides,
): TailoredResume | null | undefined {
  if (!tailoredResume) return tailoredResume;
  const hasTitle = Object.prototype.hasOwnProperty.call(overrides, 'title');
  const hasSummary = Object.prototype.hasOwnProperty.call(overrides, 'summary');
  if (!hasTitle && !hasSummary) return tailoredResume;

  return {
    ...tailoredResume,
    ...(hasTitle ? { targetJobTitle: overrides.title! } : {}),
    ...(hasSummary ? { summary: overrides.summary! } : {}),
  };
}

/** Buduje tekst CV z tych samych sekcji i danych, które pokazuje DocumentRenderer. */
export function buildCvPlainText(vault: MasterVault, tailoredResume?: TailoredResume | null): string {
  const personal = vault.personalInfo;
  const sections: string[] = [];
  const header = [personal.fullName, tailoredResume?.targetJobTitle || personal.title]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (header.length) sections.push(header.join('\n'));

  const contact = [personal.email, personal.phone, personal.location, personal.linkedin, personal.github, personal.website]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (contact.length) sections.push(contact.join(' | '));

  const summary = tailoredResume?.summary?.trim() || personal.summary?.trim();
  if (summary) sections.push(`PODSUMOWANIE ZAWODOWE:\n${summary}`);

  const skills = vault.skillsMatrix?.hardSkills?.filter((skill) => skill?.trim());
  if (skills?.length) sections.push(`KLUCZOWE UMIEJĘTNOŚCI & NARZĘDZIA:\n${skills.join(' · ')}`);

  const tools = vault.skillsMatrix?.toolsAndTech?.filter((skill) => skill?.trim());
  if (tools?.length) sections.push(`NARZĘDZIA I TECHNOLOGIE:\n${tools.join(' · ')}`);

  const softSkills = vault.skillsMatrix?.softSkills?.filter((skill) => skill?.trim());
  if (softSkills?.length) sections.push(`UMIEJĘTNOŚCI INTERPERSONALNE:\n${softSkills.join(' · ')}`);

  const experiences = (vault.history || []).map((experience) => {
    const heading = [experience.role, experience.company].filter(Boolean).join(' • ');
    const dates = [experience.startDate, experience.isCurrent ? 'Obecnie' : experience.endDate]
      .filter(Boolean).join(' – ');
    const lines = [[heading, dates].filter(Boolean).join(' | ')];
    if (experience.description?.trim()) lines.push(experience.description.trim());
    for (const highlight of experience.highlights || []) {
      if (highlight.text?.trim()) lines.push(`• ${highlight.text.trim()}`);
    }
    return lines.filter(Boolean).join('\n');
  }).filter(Boolean);
  if (experiences.length) sections.push(`DOŚWIADCZENIE ZAWODOWE:\n${experiences.join('\n\n')}`);

  const education = (vault.education || []).map((entry) => {
    const degree = [entry.degree, entry.fieldOfStudy].filter(Boolean).join(' — ');
    const dates = [entry.startDate, entry.endDate].filter(Boolean).join(' – ');
    return [degree, entry.institution, dates].filter(Boolean).join('\n');
  }).filter(Boolean);
  if (education.length) sections.push(`EDUKACJA & WYKSZTAŁCENIE:\n${education.join('\n\n')}`);

  const projects = (vault.projects || []).map((project) => [
    [project.name, project.role].filter(Boolean).join(' — '),
    project.description?.trim(),
    Array.isArray(project.techStack) ? project.techStack.filter(Boolean).join(' · ') : '',
    project.metrics?.trim(),
    project.link?.trim(),
  ].filter(Boolean).join('\n')).filter(Boolean);
  if (projects.length) sections.push(`PROJEKTY:\n${projects.join('\n\n')}`);

  const licenses = (vault.profiler?.licenses ?? []).map((id) =>
    ALL_LICENSES.find((license) => license.id === id)?.label || id
  );
  if (licenses.length) sections.push(`UPRAWNIENIA:\n${licenses.join(' · ')}`);

  const certifications = (vault.skillsMatrix?.certifications ?? []).map((cert) =>
    [cert.name, cert.issuer && `— ${cert.issuer}`, cert.date && `(${cert.date})`]
      .filter(Boolean).join(' ')
  ).filter(Boolean);
  if (certifications.length) sections.push(`UPRAWNIENIA I CERTYFIKATY:\n${certifications.join('\n')}`);

  const languages = (vault.profiler?.languages ?? []).map(({ language, level }) =>
    `${language}${level ? ` — ${level}` : ''}`
  ).filter(Boolean);
  if (languages.length) sections.push(`JĘZYKI:\n${languages.join(' · ')}`);

  return sections.join('\n\n').trim();
}
