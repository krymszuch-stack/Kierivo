import { CoverLetter, MasterVault } from '../types';
import { rankExperienceByRelevance, rankHighlightsByRelevance } from './relevanceRanking';
import { getLatestExperience } from './experienceChronology';
import {
  getCoverLetterSalutations,
  getCoverLetterHookVariations,
  getCoverLetterProofIntroductions,
  getCoverLetterCtaVariations,
  getCoverLetterSignOffs,
  selectVariantIndex,
} from './phrasingVariations';

/**
 * Builds a local letter draft from entries in MasterVault; it does not verify their truth.
 * Supports optional `variantIndex` for rotating openings, proof bridges, and CTAs without repetition.
 */
export function generateAntiTemplateCoverLetter(
  targetRole: string,
  companyName: string,
  jobDescription: string,
  vault: MasterVault,
  variantIndex?: number
): CoverLetter {
  const company = companyName || 'Państwa Firmie';
  const role = targetRole || 'oferowanym stanowisku';
  const name = vault.personalInfo.fullName?.trim() || '';

  // 0-token relevance signal from the job offer text, reused to prioritize both skills and proof points
  const jdKeywords = (jobDescription || '').toLowerCase().match(/\b[a-zA-Z0-9#+.-]{3,}\b/g) || [];
  const jdKeywordSet = new Set(jdKeywords);

  // Extract key skills and technologies, JD-matching ones first
  const allSkills = [
    ...(vault.skillsMatrix?.hardSkills || []),
    ...(vault.skillsMatrix?.toolsAndTech || []),
  ].filter(Boolean);
  const rankedSkills = [...allSkills].sort((a, b) => {
    const aMatch = jdKeywordSet.has(a.toLowerCase()) ? 1 : 0;
    const bMatch = jdKeywordSet.has(b.toLowerCase()) ? 1 : 0;
    return bMatch - aMatch;
  });
  const topSkillsStr = rankedSkills.slice(0, 5).join(', ');

  const seed = variantIndex ?? (name + role + company);
  const latestExperience = getLatestExperience(vault.history ?? []);
  const topMetric = latestExperience?.highlights?.find((highlight) =>
    typeof highlight !== 'string' && typeof highlight.metric === 'string' && highlight.metric.trim()
  )?.metric;

  // 1. Nagłówek grzecznościowy (Salutation)
  const salutations = getCoverLetterSalutations(company);
  const salutationIdx = selectVariantIndex(typeof seed === 'number' ? seed : seed + '_salut', salutations.length);
  const salutation = salutations[salutationIdx];

  // 2. Hook (Haczyk) built dynamically from varied templates
  const hookVariations = getCoverLetterHookVariations({
    candidateName: name,
    roleTitle: role,
    companyName: company,
    topSkills: topSkillsStr,
    topMetric,
  });

  const hookIdx = selectVariantIndex(typeof seed === 'number' ? seed : seed + '_hook', hookVariations.length);
  const hook = hookVariations[hookIdx];

  // 3. Proof (Dowód) - Pick real highlights from Master Vault history & projects
  const proofPoints: string[] = [];

  // Extract from experience history, most JD-relevant blocks and bullets first (0 tokens)
  if (vault.history && vault.history.length > 0) {
    const rankedExperience = rankExperienceByRelevance(vault.history, jdKeywords, targetRole);
    for (const { experience: exp } of rankedExperience) {
      const rankedHighlights = rankHighlightsByRelevance(exp.highlights, jdKeywords);
      for (const { highlight: h } of rankedHighlights) {
        const text = typeof h === 'string' ? h : h.text;
        if (text && text.length > 15) {
          const formatted = text.startsWith('•') ? text : `• W roli ${exp.role} w ${exp.company}: ${text}`;
          proofPoints.push(formatted);
          if (proofPoints.length >= 3) break;
        }
      }
      if (proofPoints.length >= 3) break;
    }
  }

  // Extract from projects if we need more proof points
  if (proofPoints.length < 3 && vault.projects && vault.projects.length > 0) {
    for (const proj of vault.projects) {
      if (proj.name && proj.description) {
        proofPoints.push(`• Projekt ${proj.name}: ${proj.description} ${proj.metrics ? `(Wartość zapisana w profilu: ${proj.metrics})` : ''}`);
        if (proofPoints.length >= 3) break;
      }
    }
  }

  // Jeśli brak dowodów z historii i projektów, opieramy się wyłącznie na zadeklarowanych umiejętnościach bez fabrykowania metryk
  if (proofPoints.length === 0 && topSkillsStr) {
    proofPoints.push(`• W profilu wymieniono kompetencje: ${topSkillsStr}.`);
  }

  // 4. Zdanie wprowadzające do dowodów (Proof Introduction) - tylko gdy mamy punkty dowodowe
  const proofIntros = getCoverLetterProofIntroductions();
  const proofIntroIdx = selectVariantIndex(typeof seed === 'number' ? seed : seed + '_intro', proofIntros.length);
  const proofIntro = proofIntros[proofIntroIdx];

  // 5. Call to Action (CTA) built dynamically from varied templates
  const ctaVariations = getCoverLetterCtaVariations(company);
  const ctaIdx = selectVariantIndex(typeof seed === 'number' ? seed : seed + '_cta', ctaVariations.length);
  const callToAction = ctaVariations[ctaIdx];

  // 6. Formuła pożegnania (Sign-off)
  const signOffs = getCoverLetterSignOffs();
  const signOffIdx = selectVariantIndex(typeof seed === 'number' ? seed : seed + '_sign', signOffs.length);
  const signOff = signOffs[signOffIdx];

  const contactInfo = [vault.personalInfo?.phone && `Tel: ${vault.personalInfo.phone}`, vault.personalInfo?.email && `Email: ${vault.personalInfo.email}`].filter(Boolean).join(' | ');

  const proofSection = proofPoints.length > 0 ? `\n\n${proofIntro}\n${proofPoints.join('\n')}` : '';
  const signature = [signOff, name, contactInfo].filter(Boolean).join('\n');
  const fullText = `${salutation}\n\n${hook}${proofSection}\n\n${callToAction}\n\n${signature}`;

  return {
    targetJobTitle: role,
    companyName: company,
    hook,
    proofPoints,
    callToAction,
    fullText,
  };
}

/*
 * Była tu funkcja `generateCoverLetterWithAI`, wołająca `/api/generate-cover-letter`.
 * Serwer nigdy nie wystawiał takiej ścieżki — jego trasa nazywała się
 * `/api/cover-letter` — więc każde wywołanie kończyło się 404 (zweryfikowane na
 * uruchomionym serwerze). Sama funkcja i tak nie miała ani jednego wywołania
 * w interfejsie, więc nikt tego nie zauważył.
 *
 * Generowanie listu wraca w Fazie 6 razem z ekranem, który go używa, i kontrolą
 * uprawnień. Implementacja po stronie serwera (`generateCoverLetterWithFlash`
 * w `src/server/gemini.ts`) jest gotowa i nietknięta.
 */

