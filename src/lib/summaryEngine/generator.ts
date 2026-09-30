import { ExtractedProfileData, SummarySuggestion } from './types';

function formatYears(years: number): string {
  if (years <= 0) return '';
  if (years === 1) return 'rocznym doświadczeniem zawodowym';
  if (years >= 2 && years <= 4) return `${years}-letnim doświadczeniem zawodowym`;
  return `${years}-letnim doświadczeniem zawodowym`;
}

function formatSkills(skills: string[]): string {
  if (!skills || skills.length === 0) return '';
  if (skills.length === 1) return skills[0];
  if (skills.length === 2) return `${skills[0]} oraz ${skills[1]}`;
  return `${skills.slice(0, -1).join(', ')} i ${skills[skills.length - 1]}`;
}

function extractKeywords(text: string, candidates: string[]): string[] {
  const lower = text.toLowerCase();
  return candidates.filter((c) => c && lower.includes(c.toLowerCase()));
}

export function generateSummaries(profile: ExtractedProfileData, count = 4): SummarySuggestion[] {
  const results: SummarySuggestion[] = [];
  const { title, yearsOfExperience, topSkills, workEntries, sourceHighlight } = profile;
  const keywordCandidates = [title, ...topSkills].filter(Boolean);

  // Jeśli profil jest zupełnie pusty, zwracamy pusty stan zgodnie z zasadą zero halucynacji
  if (!title && yearsOfExperience === 0 && topSkills.length === 0 && workEntries.length === 0 && !sourceHighlight) {
    return [];
  }

  // Styl 1: Kompaktowy
  let compactText = '';
  if (title && yearsOfExperience > 0) {
    compactText = `${title} z ${formatYears(yearsOfExperience)}.`;
    if (topSkills.length > 0) {
      compactText += ` W codziennej pracy wykorzystuję ${formatSkills(topSkills.slice(0, 3))}.`;
    }
  } else if (title) {
    compactText = `${title}.`;
    if (topSkills.length > 0) {
      compactText += ` Doświadczenie w obszarach: ${formatSkills(topSkills.slice(0, 4))}.`;
    }
  } else if (topSkills.length > 0) {
    compactText = `Doświadczenie zawodowe oparte na znajomości: ${formatSkills(topSkills.slice(0, 4))}.`;
  }

  if (compactText) {
    const words = compactText.trim().split(/\s+/).length;
    const sentences = compactText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    results.push({
      id: 'summary-compact',
      styleId: 'style_compact',
      styleName: 'Kompaktowy',
      text: compactText.trim(),
      wordCount: words,
      sentenceCount: sentences,
      highlightedKeywords: extractKeywords(compactText, keywordCandidates),
    });
  }

  // Styl 2: Historia zawodowa
  if (workEntries.length > 0) {
    const rolesDesc = workEntries
      .map((e) => (e.company ? `${e.role} w ${e.company}` : e.role))
      .join(', ');
    let historyText = `${title ? `${title}. ` : ''}Dotychczasowa praktyka obejmuje stanowiska: ${rolesDesc}.`;
    if (topSkills.length > 0) {
      historyText += ` Praktyczna znajomość: ${formatSkills(topSkills.slice(0, 3))}.`;
    }
    const words = historyText.trim().split(/\s+/).length;
    const sentences = historyText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    results.push({
      id: 'summary-history',
      styleId: 'style_history',
      styleName: 'Historia zawodowa',
      text: historyText.trim(),
      wordCount: words,
      sentenceCount: sentences,
      highlightedKeywords: extractKeywords(historyText, keywordCandidates),
    });
  }

  // Styl 3: Umiejętności
  if (topSkills.length > 0) {
    const skillsText = `${title ? `${title}. ` : ''}Profil zawodowy skoncentrowany na kluczowych kompetencjach: ${formatSkills(topSkills)}. Doświadczenie w bezpośrednim stosowaniu tych rozwiązań w praktyce zawodowej.`;
    const words = skillsText.trim().split(/\s+/).length;
    const sentences = skillsText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    results.push({
      id: 'summary-skills',
      styleId: 'style_skills',
      styleName: 'Umiejętności',
      text: skillsText.trim(),
      wordCount: words,
      sentenceCount: sentences,
      highlightedKeywords: extractKeywords(skillsText, keywordCandidates),
    });
  }

  // Styl 4: Opis z profilu / Osiągnięcie
  if (sourceHighlight) {
    const highlightText = `${title ? `${title} — ` : ''}${sourceHighlight}`;
    const words = highlightText.trim().split(/\s+/).length;
    const sentences = highlightText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    results.push({
      id: 'summary-highlight',
      styleId: 'style_highlight',
      styleName: 'Opis z profilu',
      text: highlightText.trim(),
      wordCount: words,
      sentenceCount: sentences,
      highlightedKeywords: extractKeywords(highlightText, keywordCandidates),
    });
  } else if (workEntries.length > 0 && topSkills.length > 0) {
    const highlightText = `${title ? `${title}. ` : ''}Doświadczenie zdobyte przy realizacji zadań w ${workEntries.map((e) => e.company || e.role).join(', ')} z wykorzystaniem ${formatSkills(topSkills.slice(0, 2))}.`;
    const words = highlightText.trim().split(/\s+/).length;
    const sentences = highlightText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    results.push({
      id: 'summary-highlight',
      styleId: 'style_highlight',
      styleName: 'Opis z profilu',
      text: highlightText.trim(),
      wordCount: words,
      sentenceCount: sentences,
      highlightedKeywords: extractKeywords(highlightText, keywordCandidates),
    });
  }

  return results.slice(0, count);
}
