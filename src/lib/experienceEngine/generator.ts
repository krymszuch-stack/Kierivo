import { ExperienceFact, GeneratedExperienceVariant } from './types';
import { formatActionWord, joinWithPolishConjunction } from './polishForms';

/**
 * Generuje zróżnicowane, w 100% oparte na faktach warianty opisu doświadczenia.
 */
export function generateExperienceVariants(fact: ExperienceFact): GeneratedExperienceVariant[] {
  if (!fact.role.trim() || !fact.action.trim() || fact.objects.length === 0) return [];

  const objectsStr = joinWithPolishConjunction(fact.objects, 'oraz');
  const techStr = fact.technologies.length > 0
    ? joinWithPolishConjunction(fact.technologies, 'oraz')
    : '';

  const outcomeClause = fact.outcome ? `, ${fact.outcome}` : '';
  const metricClause = fact.metric ? ` (${fact.metric})` : '';

  // 1. Wariant Formalny (Rzeczownikowy / Bezosobowy — standard nowoczesnego CV ATS)
  const actionNoun = formatActionWord(fact.action, 'impersonal');
  let formalBullet1 = `${actionNoun}: ${objectsStr}`;
  if (techStr) {
    formalBullet1 += ` z wykorzystaniem ${techStr}`;
  }
  if (outcomeClause) {
    formalBullet1 += `${outcomeClause}${metricClause}.`;
  } else {
    formalBullet1 += '.';
  }

  // 2. Wariant Aktywny (Czasowniki sprawcze 1 os. lp z uwzględnieniem formy gramatycznej)
  const actionVerb = formatActionWord(fact.action, fact.narrativeStyle);
  let activeBullet1 = `${actionVerb} ${objectsStr}`;
  if (techStr) {
    activeBullet1 += ` w oparciu o ${techStr}`;
  }
  if (outcomeClause) {
    activeBullet1 += `${outcomeClause}${metricClause}.`;
  } else {
    activeBullet1 += '.';
  }

  // 3. Wariant Techniczny / Narzędziowy
  let techBullet1 = techStr
    ? `Narzędzia i technologie: ${techStr} — ${actionNoun.toLowerCase()}: ${objectsStr}.`
    : `${actionNoun}: ${objectsStr} w ramach obszaru ${fact.area}.`;
  if (outcomeClause && fact.outcome) {
    techBullet1 += ` Cel: ${fact.outcome.replace(/^,\s*/, '')}${metricClause}.`;
  }

  const variants: GeneratedExperienceVariant[] = [
    {
      id: 'variant-formal',
      styleName: 'Formalny (Bezosobowy)',
      bulletPoints: [formalBullet1],
      fullParagraph: formalBullet1,
      highlights: {
        action: actionNoun,
        object: objectsStr,
        tech: fact.technologies,
        outcome: fact.outcome,
      },
    },
    {
      id: 'variant-active',
      styleName: 'Osiągnięcia (Czasowniki)',
      bulletPoints: [activeBullet1],
      fullParagraph: activeBullet1,
      highlights: {
        action: actionVerb,
        object: objectsStr,
        tech: fact.technologies,
        outcome: fact.outcome,
      },
    },
    {
      id: 'variant-tech',
      styleName: 'Techniczny / Narzędziowy',
      bulletPoints: [techBullet1],
      fullParagraph: techBullet1,
      highlights: {
        action: actionNoun,
        object: objectsStr,
        tech: fact.technologies,
        outcome: fact.outcome,
      },
    },
  ];

  return variants;
}
