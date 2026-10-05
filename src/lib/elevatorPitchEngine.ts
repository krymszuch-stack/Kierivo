import { MasterVault, ElevatorPitchOutput } from '../types';
import { inferLatestExperienceRole } from './experienceChronology';

/**
 * Szacuje czas trwania wypowiedzi przy zadanym tempie mówienia.
 */
export function estimateSpeakingDurationSec(text: string, wordsPerMinute = 130): number {
  if (!text) return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;
  return Math.max(1, Math.round((wordCount / wordsPerMinute) * 60));
}

/** Pobiera metryki podane w historii, projektach lub zapisanych osiągnięciach. */
export function extractTopMetrics(vault: MasterVault | undefined | null): string[] {
  if (!vault) return [];
  const metrics: string[] = [];

  for (const exp of vault.history || []) {
    for (const rawHighlight of exp?.highlights || []) {
      const highlight = rawHighlight as unknown;
      if (
        typeof highlight === 'object' && highlight !== null &&
        'metric' in highlight && typeof (highlight as { metric: unknown }).metric === 'string'
      ) {
        const metric = (highlight as { metric: string }).metric.trim();
        if (metric) metrics.push(metric);
      } else if (typeof highlight === 'string') {
        const match = highlight.trim().match(/\d+[%kKmM+xX]?/);
        if (match) metrics.push(match[0]);
      }
    }
  }

  for (const project of vault.projects || []) {
    if (typeof project?.metrics === 'string' && project.metrics.trim()) metrics.push(project.metrics.trim());
  }
  for (const claim of vault.claims || []) {
    if (typeof claim?.metric === 'string' && claim.metric.trim()) metrics.push(claim.metric.trim());
  }

  return Array.from(new Set(metrics));
}

function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function joinList(values: Array<string | undefined | null>): string {
  return values.map(clean).filter(Boolean).join(', ');
}

/**
 * Prawdziwe wartości z profilu są opisywane jako wpisy w profilu. Nie dopisujemy
 * stażu, odpowiedzialności, cech charakteru ani codziennego używania narzędzi.
 */
function profileStatements(vault: MasterVault | Partial<MasterVault>, targetRole: string): string[] {
  const statements: string[] = [];
  const personal = vault.personalInfo;
  const name = clean(personal?.fullName);
  const summary = clean(personal?.summary);
  const target = clean(targetRole);
  const skills = joinList([
    ...(vault.skillsMatrix?.hardSkills ?? []),
    ...(vault.skillsMatrix?.toolsAndTech ?? []),
  ]);
  const certifications = joinList((vault.skillsMatrix?.certifications ?? []).map((cert) => cert?.name));
  const experienceEntries = (vault.history ?? []).filter((entry) =>
    clean(entry?.role) || clean(entry?.description) || entry?.highlights?.some((item) => Boolean(item && clean(item.text)))
  );
  const projects = (vault.projects ?? []).filter((project) => clean(project?.name) || clean(project?.description));
  const metrics = extractTopMetrics(vault as MasterVault).slice(0, 3);

  if (name) statements.push(`Nazywam się ${name}.`);
  if (target) statements.push(`Przygotowuję się do rozmowy na stanowisko ${target}.`);
  for (const entry of experienceEntries) {
    const role = clean(entry.role);
    const company = clean(entry.company);
    const description = clean(entry.description);
    const label = joinList([role, company]);
    if (role) statements.push(`W historii mojego CV widnieje stanowisko „${label}”.`);
    if (description) statements.push(`Opis wpisu doświadczenia w moim CV: ${description}`);
    for (const highlight of entry.highlights ?? []) {
      const text = clean(highlight?.text);
      if (text) statements.push(`W osiągnięciach CV zapisano: ${text}`);
    }
  }
  const profileTitle = clean(personal?.title);
  if (profileTitle && !experienceEntries.some((entry) => profileTitle === clean(entry.role))) {
    statements.push(`W profilu zawodowym wskazuję stanowisko: ${profileTitle}.`);
  }
  if (summary) statements.push(`Podsumowanie z mojego profilu: ${summary}`);
  if (skills) statements.push(`W profilu wymieniam: ${skills}.`);
  if (certifications) statements.push(`W profilu wymieniam certyfikaty: ${certifications}.`);
  for (const project of projects) {
    const name = clean(project.name);
    const description = clean(project.description);
    if (name && description) statements.push(`W projektach mojego profilu widnieje wpis „${name}”: ${description}`);
    else if (name) statements.push(`W projektach mojego profilu widnieje wpis „${name}”.`);
    else if (description) statements.push(`Opis projektu z profilu: ${description}`);
  }
  if (metrics.length) statements.push(`W zapisanych osiągnięciach podano: ${metrics.join('; ')}.`);

  return statements;
}

/** Czy profil zawiera fakt zawodowy, na którym można oprzeć pitch. */
export function hasVaultEvidence(vault: MasterVault | Partial<MasterVault> | undefined | null): boolean {
  if (!vault) return false;
  return Boolean(
    clean(vault.personalInfo?.title) ||
    clean(vault.personalInfo?.summary) ||
    vault.skillsMatrix?.hardSkills?.some((skill) => Boolean(clean(skill))) ||
    vault.skillsMatrix?.toolsAndTech?.some((tool) => Boolean(clean(tool))) ||
    vault.skillsMatrix?.certifications?.some((cert) => Boolean(clean(cert?.name))) ||
    vault.history?.some((entry) =>
      clean(entry?.role) || clean(entry?.description) || entry?.highlights?.some((item) => Boolean(item && clean(item.text)))
    ) ||
    vault.projects?.some((project) => clean(project?.name) || clean(project?.description)) ||
    extractTopMetrics(vault as MasterVault).length > 0
  );
}

/**
 * Tworzy trzy długości szkicu wyłącznie z wartości zapisanych w MasterVault.
 * Jeśli profilu nie ma, zwraca puste warianty zamiast zastępczej biografii.
 */
export function generateElevatorPitch(
  vault: MasterVault | Partial<MasterVault> | undefined | null,
  targetRoleOverride?: string,
  variantIndex?: number,
): ElevatorPitchOutput {
  const safeVault = vault ?? {};
  const profileRole = clean(safeVault.personalInfo?.title) || inferLatestExperienceRole(safeVault.history ?? []);
  const targetRole = clean(targetRoleOverride) || profileRole;
  const hasEvidence = hasVaultEvidence(safeVault);
  const statements = hasEvidence
    ? profileStatements(safeVault, targetRole)
    : [];
  const offset = statements.length ? Math.abs(Math.trunc(variantIndex ?? 0)) % statements.length : 0;
  const arrangedStatements = statements.length
    ? [...statements.slice(offset), ...statements.slice(0, offset)]
    : [];
  const oneLiner = arrangedStatements.slice(0, 3).join(' ');
  const metricStatements = arrangedStatements.filter((statement) => statement.startsWith('W zapisanych osiągnięciach podano:'));
  const thirtySecondStatements = [...new Set([...arrangedStatements.slice(0, 6), ...metricStatements])];
  const thirtySeconds = thirtySecondStatements.join(' ');
  const ninetySeconds = arrangedStatements.length
    ? `${arrangedStatements.join('\n\n')}\n\n[Dodaj własny przykład z pracy lub projektu. Nie został pobrany z profilu.]`
    : '';
  const metrics = extractTopMetrics(safeVault as MasterVault).slice(0, 3);

  return {
    oneLiner,
    thirtySeconds,
    ninetySeconds,
    metricsUsed: metrics,
    targetRole,
    estimatedDurationSec: {
      oneLiner: estimateSpeakingDurationSec(oneLiner),
      thirtySeconds: estimateSpeakingDurationSec(thirtySeconds),
      ninetySeconds: estimateSpeakingDurationSec(ninetySeconds),
    },
  };
}
