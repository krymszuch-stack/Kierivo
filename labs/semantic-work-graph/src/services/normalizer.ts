export function normalizeTerm(text: string): { original: string; normalized: string; searchVariant: string; stemVariant: string } {
  const original = text;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Polish diacritics removal for resilient search indexing
  const searchVariant = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Apply light Polish stemming to tokenized words
  const words = searchVariant.split(' ');
  const stemmedWords = words.map(stemPolishWord);
  const stemVariant = stemmedWords.join(' ');

  return {
    original,
    normalized: lower,
    searchVariant,
    stemVariant,
  };
}

/**
 * Light Polish Stemmer (Suffix Stripper)
 * Handles common Polish noun and adjective inflections/declensions
 */
export function stemPolishWord(word: string): string {
  if (!word || word.length <= 3) return word;

  let stem = word.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .replace(/[^a-z0-9-]/g, '')
    .trim();

  // Replace common phonetic variations
  stem = stem.replace(/ciol$/, 'cotol').replace(/kotl/, 'cotol').replace(/kotlow/, 'cotol');

  // Strip inflectional suffixes
  const suffixes = [
    'owego', 'owych', 'owym', 'owski', 'owska', 'owek',
    'ami', 'ach', 'ego', 'ych', 'ich', 'nym', 'nej', 'ow',
    'om', 'em', 'ie', 'iu', 'ki', 'ka', 'ke', 'y', 'a', 'e', 'o'
  ];

  for (const suf of suffixes) {
    if (stem.length - suf.length >= 3 && stem.endsWith(suf)) {
      stem = stem.slice(0, -suf.length);
      break;
    }
  }

  return stem;
}

export function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateJaroWinklerSimilarity(s1: string, s2: string): number {
  let m = 0;

  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;

  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  for (let i = 0; i < s1.length; i++) {
    const low = i >= range ? i - range : 0;
    const high = i + range <= s2.length - 1 ? i + range : s2.length - 1;

    for (let j = low; j <= high; j++) {
      if (!s1Matches[i] && !s2Matches[j] && s1[i] === s2[j]) {
        m++;
        s1Matches[i] = true;
        s2Matches[j] = true;
        break;
      }
    }
  }

  if (m === 0) return 0;

  let k = 0;
  let numTranspositions = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) numTranspositions++;
      k++;
    }
  }

  const jaro = (m / s1.length + m / s2.length + (m - numTranspositions / 2) / m) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export function calculateTrigramSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 3 || b.length < 3) {
    return calculateJaroWinklerSimilarity(a, b);
  }

  const getTrigrams = (str: string): Set<string> => {
    const set = new Set<string>();
    const padded = `  ${str} `;
    for (let i = 0; i < padded.length - 2; i++) {
      set.add(padded.substring(i, i + 3));
    }
    return set;
  };

  const aSet = getTrigrams(a);
  const bSet = getTrigrams(b);

  let intersection = 0;
  aSet.forEach((gram) => {
    if (bSet.has(gram)) intersection++;
  });

  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function calculateHybridSimilarity(query: string, target: string): number {
  const normQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
  const normTarget = target.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();

  if (normQuery === normTarget) return 1.0;
  if (normTarget.includes(normQuery)) return 0.88;
  if (normQuery.includes(normTarget)) return 0.78;

  const stemQuery = normQuery.split(' ').map(stemPolishWord).join(' ');
  const stemTarget = normTarget.split(' ').map(stemPolishWord).join(' ');

  if (stemQuery === stemTarget) return 0.95;
  if (stemTarget.includes(stemQuery) || stemQuery.includes(stemTarget)) return 0.85;

  const jaro = calculateJaroWinklerSimilarity(normQuery, normTarget);
  const trigram = calculateTrigramSimilarity(normQuery, normTarget);

  const levDist = calculateLevenshteinDistance(normQuery, normTarget);
  const maxLen = Math.max(normQuery.length, normTarget.length);
  const lev = maxLen === 0 ? 1 : 1 - levDist / maxLen;

  const stemJaro = calculateJaroWinklerSimilarity(stemQuery, stemTarget);
  const combined = 0.35 * jaro + 0.35 * stemJaro + 0.2 * trigram + 0.1 * lev;
  return Math.round(combined * 100) / 100;
}
