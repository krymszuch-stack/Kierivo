import type { MasterVault } from '../types';
import { extractDynamicJdPhrases } from './atsSimulator';
import { auditKnockouts } from './knockouts';
import { hasPositiveSkillEvidence, containsPhrase } from './skillEvidence';
import { unionExperienceYears, employmentIntervalForJob } from './experience';
import { ALL_LICENSES } from '../data/licenses';

/**
 * Kanoniczny wynik ATS — JEDYNA liczba, którą wolno pokazywać jako
 * „dopasowanie do oferty" (F6).
 *
 * Wcześniej trzy silniki pokazywały trzy różne „wyniki ATS" dla tych samych
 * danych (63 / 72 / 14 na jednej parze): symulator ignorował formalia,
 * mediana je uśredniała, telemetria odejmowała `blocking*25` po wagach.
 * Ten moduł jest rozstrzygający; `simulateAtsCheck`, `simulateMultiEngineATS`
 * i `buildAtsTelemetryReport` zostają jako diagnostyka symulacyjna i nie
 * wolno ich podpinać pod główny wskaźnik dopasowania w UI.
 *
 * Wzór: S = Σ wi·ci / Σ wi, składniki w [0,100], wagi z intencji produktu:
 * telemetria ważyła hard 0.40 / staż 0.25 / strukturę 0.20 / czasowniki 0.15.
 * Czasowniki sprawcze wypadają z kanonu (faworyzowały polski 1. os. — F8),
 * a ich 0.15 przejmują wymagania formalne (silnik je mierzył, ale wynik je
 * ignorował — F3). Stąd: skills 0.40, experience 0.25, structure 0.20,
 * formal 0.15. Suma wag = 1.00.
 */

export const CANONICAL_WEIGHTS = {
  skills: 0.4,
  experience: 0.25,
  structure: 0.2,
  formal: 0.15,
} as const;

export type CanonicalState =
  | 'SCORABLE'
  | 'INSUFFICIENT_CV'
  | 'INSUFFICIENT_JD'
  | 'NO_REQUIREMENTS_DETECTED';

export interface CanonicalComponents {
  skills: number;
  experience: number;
  structure: number;
  formal: number;
}

export interface CanonicalAtsScore {
  score: number;
  components: CanonicalComponents;
  weights: typeof CANONICAL_WEIGHTS;
  matchedRequirements: string[];
  missingRequirements: string[];
  formalFindings: Array<{ label: string; satisfied: boolean; severity: string }>;
  penalties: string[];
  state: CanonicalState;
  reason: string;
}

const MAX_COUNTED_YEARS = 15;

function licenseLabel(id: string): string {
  return ALL_LICENSES.find((l) => l.id === id)?.label ?? id;
}

/** Cały mierzalny tekst kandydata + etykiety typowane (języki, licencje, certyfikaty). */
export function buildEvidenceCorpus(vault: MasterVault): string {
  const v = vault as MasterVault;
  const parts: string[] = [
    v.personalInfo?.summary || '',
    v.personalInfo?.title || '',
    ...(v.skillsMatrix?.hardSkills ?? []),
    ...(v.skillsMatrix?.toolsAndTech ?? []),
    ...(v.skillsMatrix?.softSkills ?? []),
    ...(v.skillsMatrix?.certifications ?? []).flatMap((c) => [c?.name || '', c?.issuer || '']),
    ...(v.profiler?.licenses ?? []).map(licenseLabel),
    ...(v.profiler?.languages ?? []).map((l) => `${l?.language || ''} ${l?.level || ''}`),
    ...(v.history ?? []).flatMap((job) => [
      job?.role || '',
      job?.company || '',
      ...((job?.highlights ?? []).map((h) =>
        typeof h === 'string' ? h : `${h?.text || ''} ${h?.tool || ''} ${(h?.keywords ?? []).join(' ')}`
      )),
    ]),
    ...(v.projects ?? []).flatMap((p) => [p?.name || '', p?.description || '', ...((p as { techStack?: string[] })?.techStack ?? [])]),
    ...(v.education ?? []).flatMap((e) => [e?.institution || '', e?.degree || '', e?.fieldOfStudy || '']),
  ];
  return parts.filter(Boolean).join('\n');
}

function isCvEmpty(vault: MasterVault): boolean {
  const corpus = buildEvidenceCorpus(vault).trim();
  return corpus.length < 20;
}

/** Formalna fraza spełniona tekstem LUB typowanym rozstrzygnięciem knock-outów. */
function isFormalSatisfied(
  phrase: string,
  corpus: string,
  knockoutLabelsSatisfied: string[]
): boolean {
  if (hasPositiveSkillEvidence(corpus, phrase)) return true;
  return knockoutLabelsSatisfied.some(
    (label) => containsPhrase(label, phrase) || containsPhrase(phrase, label)
  );
}

export function scoreCanonicalAts(
  vault: MasterVault,
  jobDescription: string,
  targetRoleTitle = ''
): CanonicalAtsScore {
  const jd = (jobDescription ?? '').trim();
  const corpus = buildEvidenceCorpus(vault);

  if (isCvEmpty(vault)) {
    return emptyResult('INSUFFICIENT_CV', 'Profil nie zawiera treści do oceny — uzupełnij umiejętności lub doświadczenie.');
  }
  if (jd.length < 20) {
    return emptyResult('INSUFFICIENT_JD', 'Ogłoszenie jest zbyt krótkie, żeby wykryć wymagania.');
  }

  const extraction = extractDynamicJdPhrases(jd);
  const knockouts = auditKnockouts(jd, vault);
  const satisfiedLabels = knockouts.findings.filter((f) => f.satisfied).map((f) => f.label);

  // Frazy twarde zdublowane z kryteriami formalnymi liczymy raz (formalnie),
  // żeby nie ważyć dwa razy tego samego dowodu (np. SEP jako skill i knockout).
  const knockoutLabels = knockouts.findings.map((f) => f.label);
  const hardPhrases = extraction.hardSkills.filter(
    (h) => !knockoutLabels.some((label) => containsPhrase(label, h.phrase) || containsPhrase(h.phrase, label))
  );

  const matchedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const h of hardPhrases) {
    totalWeight += h.weight;
    if (hasPositiveSkillEvidence(corpus, h.phrase)) {
      matchedWeight += h.weight;
      matchedRequirements.push(h.phrase);
    } else {
      missingRequirements.push(h.phrase);
    }
  }
  // Formalia z ekstrakcji (tekst/typy) — waga 2.0 jak w ekstraktorze.
  let matchedFormalWeight = 0;
  let totalFormalWeight = 0;
  for (const f of extraction.formalReqs) {
    totalFormalWeight += f.weight;
    if (isFormalSatisfied(f.phrase, corpus, satisfiedLabels)) {
      matchedFormalWeight += f.weight;
      matchedRequirements.push(f.phrase);
    } else {
      missingRequirements.push(f.phrase);
    }
  }
  // Kryteria zerojedynkowe jako formalia typowane (waga 2.0 za każde).
  for (const finding of knockouts.findings) {
    totalFormalWeight += 2.0;
    if (finding.satisfied) {
      matchedFormalWeight += 2.0;
      if (!matchedRequirements.includes(finding.label)) matchedRequirements.push(finding.label);
    } else if (!missingRequirements.includes(finding.label)) {
      missingRequirements.push(finding.label);
    }
  }

  if (totalWeight === 0 && totalFormalWeight === 0) {
    return emptyResult('NO_REQUIREMENTS_DETECTED', 'Z ogłoszenia nie wykryto żadnych wymagań — nie ma czego oceniać.');
  }

  const skills = totalWeight === 0 ? 100 : Math.round((matchedWeight / totalWeight) * 100);

  // Staż z unii (70%) + świeżość dopasowań w bieżącej roli (30%).
  // Brak dopasowań = świeżość 0, nie bonus 80 jak w symulatorze (F4).
  const years = unionExperienceYears(vault.history);
  const tenureNorm = Math.min(1, years / MAX_COUNTED_YEARS) * 100;
  let recencyNorm = 0;
  const matchedHard = hardPhrases.filter((h) => matchedRequirements.includes(h.phrase));
  if (matchedHard.length > 0) {
    const currentText = vault.history[0]
      ? `${vault.history[0].role} ${vault.history[0].company} ${vault.history[0].highlights.map((h) => typeof h === 'string' ? h : h.text).join(' ')}`
      : '';
    const midText = vault.history
      .slice(1, 3)
      .map((h) => `${h.role} ${h.company} ${h.highlights.map((hl) => typeof hl === 'string' ? hl : hl.text).join(' ')}`)
      .join(' ');
    let sum = 0;
    for (const h of matchedHard) {
      if (currentText && hasPositiveSkillEvidence(currentText, h.phrase)) sum += 100;
      else if (midText && hasPositiveSkillEvidence(midText, h.phrase)) sum += 70;
      else sum += 40;
    }
    recencyNorm = sum / matchedHard.length;
  } else if (totalWeight === 0) {
    recencyNorm = 50;
  }
  const experience = Math.round(tenureNorm * 0.7 + recencyNorm * 0.3);

  // Struktura bez kar za alfabet: nagłówki + kontakt + poprawność dat.
  // Cyrylica nie jest wadą dokumentu (F7); tabele/kolumny bez surowego tekstu
  // przyjmują dokument kanoniczny (stabilny z konstrukcji).
  const penalties: string[] = [];
  const headerAliases: Array<[string, string[]]> = [
    ['Doświadczenie', ['doświadczenie', 'historia zatrudnienia', 'work experience']],
    ['Umiejętności', ['umiejętności', 'kompetencje', 'skills', 'technologie']],
    ['Kontakt', ['kontakt', 'dane osobowe', 'contact']],
  ];
  let missingHeaders = 0;
  for (const [, aliases] of headerAliases) {
    if (!aliases.some((a) => containsPhrase(corpus, a))) missingHeaders++;
  }
  if (missingHeaders > 0) penalties.push(`Brak ${missingHeaders} standardowych nagłówków sekcji.`);
  if (!vault.personalInfo?.email || !vault.personalInfo.email.includes('@')) {
    penalties.push('Brak prawidłowego adresu e-mail.');
  }
  if (!vault.personalInfo?.phone || vault.personalInfo.phone.trim().length < 6) {
    penalties.push('Brak numeru telefonu.');
  }
  let badDates = 0;
  for (const job of vault.history ?? []) {
    if (!job?.startDate) continue;
    if (!employmentIntervalForJob(job)) badDates++;
  }
  if (badDates > 0) penalties.push(`${badDates} wpis(y) z niepoprawnym lub przyszłym zakresem dat (wykluczone ze stażu).`);
  const structure = Math.max(0, Math.round(100 - missingHeaders * 12 - penalties.filter((p) => p.startsWith('Brak prawidłowego') || p.startsWith('Brak numeru')).length * 10 - Math.min(24, badDates * 8)));

  void targetRoleTitle;
  const formal = totalFormalWeight === 0 ? 100 : Math.round((matchedFormalWeight / totalFormalWeight) * 100);

  const components: CanonicalComponents = { skills, experience, structure, formal };
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        components.skills * CANONICAL_WEIGHTS.skills +
          components.experience * CANONICAL_WEIGHTS.experience +
          components.structure * CANONICAL_WEIGHTS.structure +
          components.formal * CANONICAL_WEIGHTS.formal
      )
    )
  );

  return {
    score,
    components,
    weights: CANONICAL_WEIGHTS,
    matchedRequirements: [...new Set(matchedRequirements)],
    missingRequirements: [...new Set(missingRequirements)],
    formalFindings: knockouts.findings.map((f) => ({ label: f.label, satisfied: f.satisfied, severity: f.severity })),
    penalties,
    state: 'SCORABLE',
    reason: 'Policzono na pozytywnych dowodach z granicami słów; negacje, nauka i wyciek wymagań nie liczą się.',
  };
}

function emptyResult(state: CanonicalState, reason: string): CanonicalAtsScore {
  return {
    score: 0,
    components: { skills: 0, experience: 0, structure: 0, formal: 0 },
    weights: CANONICAL_WEIGHTS,
    matchedRequirements: [],
    missingRequirements: [],
    formalFindings: [],
    penalties: [],
    state,
    reason,
  };
}

/** Rekonstrukcja do testu uzgodnienia (pokazana suma ≡ składniki). */
export function recomputeCanonicalTotal(components: CanonicalComponents): number {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        components.skills * CANONICAL_WEIGHTS.skills +
          components.experience * CANONICAL_WEIGHTS.experience +
          components.structure * CANONICAL_WEIGHTS.structure +
          components.formal * CANONICAL_WEIGHTS.formal
      )
    )
  );
}
