import type {
  CefrLevel,
  D10FormalRequirementKind,
  EducationLevel,
} from './types';

const stripDiacritics = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export function normalizeFormalTerm(value: string): string {
  return stripDiacritics(value.normalize('NFKC').toLocaleLowerCase('pl-PL'))
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value: string): string {
  return value
    .replace(/[^a-z0-9+#.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

/**
 * Normalizuje nazwę nieznanego jeszcze certyfikatu/licencji tak samo po stronie
 * JD i kandydata. Dzięki temu nowy credential nie wymaga wcześniejszego wpisu
 * do ręcznej taksonomii, a D20 może później jedynie nauczyć się jego aliasów.
 */
export function genericCredentialCanonicalId(
  value: string,
  kind: 'CERTIFICATION' | 'LICENSE',
): string {
  let core = normalizeFormalTerm(value)
    .replace(/\b(mandatory|required by law|required|must have|must-have|must|minimum|warunek konieczny|wymagany|wymagana|wymagane|wymagamy|konieczny|konieczna|konieczne|niezbedny|niezbedna|niezbedne|posiadanie|posiada)\b/g, ' ')
    .replace(/\b(valid|current|aktualny|aktualna|aktualne|wazny|wazna|wazne)\b/g, ' ');

  if (kind === 'CERTIFICATION') {
    core = core.replace(/\b(certyfikat|certyfikacja|certification|certificate|certified|certyfikowany|certyfikowana)\b/g, ' ');
  } else {
    core = core.replace(/\b(uprawnienia|uprawnienie|licencja|license|licence|prawo wykonywania zawodu|kwalifikacje formalne)\b/g, ' ');
  }

  core = core.replace(/\s+/g, ' ').trim();
  const fallback = core || normalizeFormalTerm(value);
  return `${kind === 'CERTIFICATION' ? 'cert' : 'license'}.generic.${slug(fallback)}`;
}

const LANGUAGE_ALIASES: Record<string, string[]> = {
  english: ['english', 'angielski', 'jezyk angielski', 'english language'],
  german: ['german', 'niemiecki', 'jezyk niemiecki', 'deutsch'],
  polish: ['polish', 'polski', 'jezyk polski'],
  french: ['french', 'francuski', 'jezyk francuski', 'francais'],
  spanish: ['spanish', 'hiszpanski', 'jezyk hiszpanski', 'espanol'],
  italian: ['italian', 'wloski', 'jezyk wloski', 'italiano'],
  ukrainian: ['ukrainian', 'ukrainski', 'jezyk ukrainski'],
  russian: ['russian', 'rosyjski', 'jezyk rosyjski'],
  turkish: ['turkish', 'turecki', 'jezyk turecki'],
};

const FORMAL_ALIASES: Array<{
  canonicalId: string;
  kind: D10FormalRequirementKind;
  aliases: string[];
}> = [
  {
    canonicalId: 'cert.aws.cloud-practitioner',
    kind: 'CERTIFICATION',
    aliases: ['aws certified cloud practitioner', 'aws cloud practitioner', 'clf-c02', 'clf-c01'],
  },
  {
    canonicalId: 'cert.azure.az900',
    kind: 'CERTIFICATION',
    aliases: ['az-900', 'microsoft azure fundamentals', 'azure fundamentals'],
  },
  {
    canonicalId: 'cert.cisco.ccna',
    kind: 'CERTIFICATION',
    aliases: ['ccna', 'cisco certified network associate'],
  },
  {
    canonicalId: 'cert.pmp',
    kind: 'CERTIFICATION',
    aliases: ['pmp', 'project management professional'],
  },
  {
    canonicalId: 'cert.prince2',
    kind: 'CERTIFICATION',
    aliases: ['prince2', 'prince 2'],
  },
  {
    canonicalId: 'cert.itil',
    kind: 'CERTIFICATION',
    aliases: ['itil', 'itil foundation'],
  },
  {
    canonicalId: 'license.sep.g1',
    kind: 'LICENSE',
    aliases: ['sep g1', 'uprawnienia sep g1', 'swiadectwo kwalifikacyjne g1', 'kwalifikacje sep g1'],
  },
  {
    canonicalId: 'license.building',
    kind: 'LICENSE',
    aliases: ['uprawnienia budowlane', 'building license', 'construction licence', 'construction license'],
  },
  {
    canonicalId: 'license.legal.counsel.pl',
    kind: 'LICENSE',
    aliases: ['radca prawny', 'prawo wykonywania zawodu radcy prawnego'],
  },
  {
    canonicalId: 'license.medical.practice.pl',
    kind: 'LICENSE',
    aliases: ['prawo wykonywania zawodu lekarza', 'pwz lekarza', 'prawo wykonywania zawodu pielegniarki', 'pwz pielegniarki'],
  },
  {
    canonicalId: 'work-auth.pl',
    kind: 'WORK_AUTHORIZATION',
    aliases: ['prawo do pracy w polsce', 'uprawnienie do pracy w polsce', 'work authorization in poland', 'right to work in poland'],
  },
  {
    canonicalId: 'clearance.security',
    kind: 'CLEARANCE',
    aliases: ['security clearance', 'poswiadczenie bezpieczenstwa', 'dostep do informacji niejawnych'],
  },
];

export const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  NATIVE: 7,
};

export const EDUCATION_RANK: Record<EducationLevel, number> = {
  PRIMARY: 0,
  VOCATIONAL: 1,
  SECONDARY: 2,
  BACHELOR: 3,
  MASTER: 4,
  DOCTORATE: 5,
};

export function canonicalLanguage(value: string): string | null {
  const normalized = normalizeFormalTerm(value);
  for (const [canonical, aliases] of Object.entries(LANGUAGE_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return canonical;
  }
  return null;
}

export function parseCefrLevel(value: string): CefrLevel | null {
  const normalized = normalizeFormalTerm(value);
  const upper = normalized.toUpperCase();
  const direct = upper.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  if (direct) return direct[1] as CefrLevel;
  if (/\b(native|ojczysty|mother tongue)\b/.test(normalized)) return 'NATIVE';
  if (/\b(fluent|biegly|biegla|proficient)\b/.test(normalized)) return 'C1';
  if (/\b(advanced|zaawansowany|zaawansowana)\b/.test(normalized)) return 'B2';
  if (/\b(intermediate|srednio zaawansowany|komunikatywny|communicative)\b/.test(normalized)) return 'B1';
  if (/\b(basic|podstawowy|podstawowa)\b/.test(normalized)) return 'A2';
  return null;
}

export function parseEducationLevel(value: string): EducationLevel | null {
  const n = normalizeFormalTerm(value);
  if (/\b(phd|doctorate|doctoral|doktor|doktorat)\b/.test(n)) return 'DOCTORATE';
  if (/\b(master|msc|magister|magisterskie)\b/.test(n)) return 'MASTER';
  if (/\b(bachelor|bsc|licencjat|licencjackie|inzynier|inzynierskie)\b/.test(n)) return 'BACHELOR';
  if (/\b(secondary|srednie|matura|liceum|technikum)\b/.test(n)) return 'SECONDARY';
  if (/\b(vocational|zawodowe|szkola zawodowa)\b/.test(n)) return 'VOCATIONAL';
  if (/\b(primary|podstawowe)\b/.test(n)) return 'PRIMARY';
  if (/\b(higher education|wyksztalcenie wyzsze|university degree)\b/.test(n)) return 'BACHELOR';
  return null;
}

export function parseDrivingCategory(value: string): string | null {
  const normalized = value.normalize('NFKC').toUpperCase();
  const match = normalized.match(/(?:KAT(?:EGORIA)?\.?\s*|CATEGORY\s*)\b(AM|A1|A2|A|B1|B|C1|C|D1|D|BE|CE|DE|T)\b/);
  if (match) return match[1];
  const compact = normalized.match(/PRAWO\s+JAZDY[^A-Z0-9]{0,8}(AM|A1|A2|A|B1|B|C1|C|D1|D|BE|CE|DE|T)\b/);
  return compact?.[1] ?? null;
}

export function canonicalFormalEntity(value: string): {
  canonicalId: string;
  kind: D10FormalRequirementKind;
  label: string;
} | null {
  const normalized = normalizeFormalTerm(value);
  const driving = parseDrivingCategory(value);
  if (driving) {
    return {
      canonicalId: `driving.${driving.toLowerCase()}`,
      kind: 'DRIVING_LICENSE',
      label: `Prawo jazdy kat. ${driving}`,
    };
  }

  const language = canonicalLanguage(value);
  if (language) {
    return {
      canonicalId: `language.${language}`,
      kind: 'LANGUAGE',
      label: language,
    };
  }

  for (const entity of FORMAL_ALIASES) {
    if (entity.aliases.some((alias) => normalized.includes(alias))) {
      return {
        canonicalId: entity.canonicalId,
        kind: entity.kind,
        label: entity.aliases[0],
      };
    }
  }

  if (/\b(certyfikat|certification|certificate)\b/.test(normalized)) {
    return {
      canonicalId: genericCredentialCanonicalId(value, 'CERTIFICATION'),
      kind: 'CERTIFICATION',
      label: value.trim(),
    };
  }
  if (/\b(uprawnienia|licencja|license|licence|prawo wykonywania zawodu)\b/.test(normalized)) {
    return {
      canonicalId: genericCredentialCanonicalId(value, 'LICENSE'),
      kind: 'LICENSE',
      label: value.trim(),
    };
  }
  return null;
}

export function ordinalThresholdFulfillment(candidateRank: number, requiredRank: number): number {
  if (candidateRank >= requiredRank) return 1;
  const delta = requiredRank - candidateRank;
  if (delta === 1) return 0.45;
  if (delta === 2) return 0.15;
  return 0;
}

export function drivingCategoryFulfillment(candidate: string, required: string): number {
  if (candidate === required) return 1;
  if (candidate === 'CE' && required === 'C') return 1;
  if (candidate === 'DE' && required === 'D') return 1;
  if (candidate === 'BE' && required === 'B') return 1;
  return 0;
}

const STOPWORDS = new Set(['and', 'or', 'of', 'the', 'w', 'i', 'z', 'na', 'dla', 'lub', 'kierunek', 'field', 'study']);

export function fieldSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const tokens = (value: string) => new Set(
    normalizeFormalTerm(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  );
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  const intersection = [...A].filter((token) => B.has(token)).length;
  const union = new Set([...A, ...B]).size;
  return intersection / union;
}
