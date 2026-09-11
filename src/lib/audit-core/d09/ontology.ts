import type { D09MatchType, D09RequirementKind } from './types';

export interface D09OntologyEntity {
  id: string;
  label: string;
  kind: D09RequirementKind;
  aliases: string[];
  parentIds?: string[];
  relatedIds?: string[];
}

const ENTITIES: D09OntologyEntity[] = [
  { id: 'relational-database', label: 'Relacyjne bazy danych', kind: 'SKILL', aliases: ['relational database', 'relacyjne bazy danych', 'rdbms', 'sql databases'] },
  { id: 'postgresql', label: 'PostgreSQL', kind: 'SKILL', aliases: ['postgresql', 'postgres'], parentIds: ['relational-database'] },
  { id: 'mysql', label: 'MySQL', kind: 'SKILL', aliases: ['mysql'], parentIds: ['relational-database'] },
  { id: 'sql', label: 'SQL', kind: 'SKILL', aliases: ['sql'], parentIds: ['relational-database'] },

  { id: 'js-framework', label: 'Framework JavaScript', kind: 'SKILL', aliases: ['javascript framework', 'frontend framework', 'framework javascript'] },
  { id: 'react', label: 'React', kind: 'SKILL', aliases: ['react', 'react.js', 'reactjs'], parentIds: ['js-framework'], relatedIds: ['vue', 'angular'] },
  { id: 'vue', label: 'Vue.js', kind: 'SKILL', aliases: ['vue', 'vue.js', 'vuejs'], parentIds: ['js-framework'], relatedIds: ['react', 'angular'] },
  { id: 'angular', label: 'Angular', kind: 'SKILL', aliases: ['angular', 'angular.js', 'angularjs'], parentIds: ['js-framework'], relatedIds: ['react', 'vue'] },
  { id: 'javascript', label: 'JavaScript', kind: 'SKILL', aliases: ['javascript', 'js'] },
  { id: 'typescript', label: 'TypeScript', kind: 'SKILL', aliases: ['typescript', 'ts'], parentIds: ['javascript'] },
  { id: 'nodejs', label: 'Node.js', kind: 'SKILL', aliases: ['node.js', 'nodejs', 'node js'] },
  { id: 'python', label: 'Python', kind: 'SKILL', aliases: ['python'] },
  { id: 'java', label: 'Java', kind: 'SKILL', aliases: ['java'] },
  { id: 'spring-framework', label: 'Spring Framework', kind: 'SKILL', aliases: ['spring framework', 'spring'] },
  { id: 'spring-boot', label: 'Spring Boot', kind: 'SKILL', aliases: ['spring boot'], parentIds: ['spring-framework'] },
  { id: 'cpp', label: 'C++', kind: 'SKILL', aliases: ['c++', 'cpp'] },
  { id: 'csharp', label: 'C#', kind: 'SKILL', aliases: ['c#', 'c sharp'] },
  { id: 'dotnet', label: '.NET', kind: 'SKILL', aliases: ['.net', 'dotnet', 'dot net'] },

  { id: 'containerization', label: 'Konteneryzacja', kind: 'SKILL', aliases: ['containerization', 'konteneryzacja', 'containers'] },
  { id: 'docker', label: 'Docker', kind: 'SKILL', aliases: ['docker'], parentIds: ['containerization'] },
  { id: 'container-orchestration', label: 'Orkiestracja kontenerów', kind: 'SKILL', aliases: ['container orchestration', 'orkiestracja kontenerów'] },
  { id: 'kubernetes', label: 'Kubernetes', kind: 'SKILL', aliases: ['kubernetes', 'k8s'], parentIds: ['container-orchestration'] },
  { id: 'terraform', label: 'Terraform', kind: 'SKILL', aliases: ['terraform'] },
  { id: 'aws', label: 'AWS', kind: 'SKILL', aliases: ['aws', 'amazon web services'], parentIds: ['cloud'] },
  { id: 'azure', label: 'Microsoft Azure', kind: 'SKILL', aliases: ['azure', 'microsoft azure'], parentIds: ['cloud'] },
  { id: 'gcp', label: 'Google Cloud', kind: 'SKILL', aliases: ['gcp', 'google cloud', 'google cloud platform'], parentIds: ['cloud'] },
  { id: 'cloud', label: 'Cloud computing', kind: 'SKILL', aliases: ['cloud computing', 'cloud platforms', 'chmura'] },
  { id: 'linux', label: 'Linux', kind: 'SKILL', aliases: ['linux'] },
  { id: 'git', label: 'Git', kind: 'SKILL', aliases: ['git'] },
  { id: 'cicd', label: 'CI/CD', kind: 'SKILL', aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery'] },
  { id: 'powershell', label: 'PowerShell', kind: 'SKILL', aliases: ['powershell', 'power shell'] },
  { id: 'm365', label: 'Microsoft 365', kind: 'SKILL', aliases: ['microsoft 365', 'm365', 'office 365', 'o365'] },
  { id: 'active-directory', label: 'Active Directory', kind: 'SKILL', aliases: ['active directory', 'ad ds', 'entra domain services'] },

  { id: 'crm', label: 'CRM', kind: 'SKILL', aliases: ['crm', 'customer relationship management'] },
  { id: 'salesforce', label: 'Salesforce', kind: 'SKILL', aliases: ['salesforce'], parentIds: ['crm'] },
  { id: 'key-account-management', label: 'Key Account Management', kind: 'SKILL', aliases: ['key account management', 'key account manager', 'kam'] },
  { id: 'b2b-sales', label: 'Sprzedaż B2B', kind: 'SKILL', aliases: ['b2b sales', 'sprzedaż b2b', 'sprzedaz b2b'] },

  { id: 'excel', label: 'Microsoft Excel', kind: 'SKILL', aliases: ['excel', 'microsoft excel', 'ms excel'] },
  { id: 'power-bi', label: 'Power BI', kind: 'SKILL', aliases: ['power bi', 'powerbi'] },
  { id: 'financial-analysis', label: 'Analiza finansowa', kind: 'SKILL', aliases: ['financial analysis', 'analiza finansowa'] },
  { id: 'finance-domain', label: 'Finanse', kind: 'DOMAIN', aliases: ['finance', 'financial services', 'finanse', 'banking', 'bankowość'] },
  { id: 'automotive-domain', label: 'Automotive', kind: 'DOMAIN', aliases: ['automotive', 'motoryzacja'] },
  { id: 'ecommerce-domain', label: 'E-commerce', kind: 'DOMAIN', aliases: ['e-commerce', 'ecommerce', 'handel internetowy'] },

  { id: 'communication', label: 'Komunikacja', kind: 'SOFT_SKILL', aliases: ['communication', 'komunikacja', 'komunikatywność'] },
  { id: 'problem-solving', label: 'Rozwiązywanie problemów', kind: 'SOFT_SKILL', aliases: ['problem solving', 'rozwiązywanie problemów', 'rozwiazywanie problemow'] },

  { id: 'license-driving-b', label: 'Prawo jazdy kat. B', kind: 'FORMAL_REFERENCE', aliases: ['prawo jazdy kat. b', 'driving licence b', 'driving license b'] },
  { id: 'license-driving-c', label: 'Prawo jazdy kat. C', kind: 'FORMAL_REFERENCE', aliases: ['prawo jazdy kat. c', 'driving licence c', 'driving license c'] },
  { id: 'license-sep-g1', label: 'SEP G1', kind: 'FORMAL_REFERENCE', aliases: ['sep g1', 'uprawnienia sep g1'] },
  { id: 'license-udt', label: 'UDT', kind: 'FORMAL_REFERENCE', aliases: ['udt', 'uprawnienia udt'] },
  { id: 'language-english', label: 'Język angielski', kind: 'FORMAL_REFERENCE', aliases: ['english', 'język angielski', 'angielski'] },
];

export const D09_ONTOLOGY: ReadonlyArray<D09OntologyEntity> = ENTITIES;

const byId = new Map(ENTITIES.map((entity) => [entity.id, entity]));
const aliasToId = new Map<string, string>();

export function normalizeD09EntityText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('pl-PL')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const entity of ENTITIES) {
  aliasToId.set(normalizeD09EntityText(entity.label), entity.id);
  for (const alias of entity.aliases) aliasToId.set(normalizeD09EntityText(alias), entity.id);
}

export function getD09OntologyEntity(id: string): D09OntologyEntity | null {
  return byId.get(id) ?? null;
}

export function canonicalizeD09Term(term: string): D09OntologyEntity | null {
  const id = aliasToId.get(normalizeD09EntityText(term));
  return id ? byId.get(id) ?? null : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findD09EntitiesInText(text: string): D09OntologyEntity[] {
  const normalized = normalizeD09EntityText(text);
  const hits = new Set<string>();
  for (const entity of ENTITIES) {
    for (const rawAlias of [entity.label, ...entity.aliases]) {
      const alias = normalizeD09EntityText(rawAlias);
      const escaped = escapeRegex(alias);
      const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu');
      if (pattern.test(normalized)) {
        hits.add(entity.id);
        break;
      }
    }
  }
  return [...hits].map((id) => byId.get(id)).filter((entity): entity is D09OntologyEntity => Boolean(entity));
}

function isAncestor(ancestorId: string, descendantId: string, seen = new Set<string>()): boolean {
  if (ancestorId === descendantId) return false;
  if (seen.has(descendantId)) return false;
  seen.add(descendantId);
  const descendant = byId.get(descendantId);
  if (!descendant?.parentIds?.length) return false;
  if (descendant.parentIds.includes(ancestorId)) return true;
  return descendant.parentIds.some((parentId) => isAncestor(ancestorId, parentId, seen));
}

export interface D09SemanticRelation {
  matchType: D09MatchType;
  strength: number;
  semanticStrength: number;
}

function relation(matchType: D09MatchType, strength: number): D09SemanticRelation {
  return { matchType, strength, semanticStrength: strength };
}

export function resolveD09SemanticRelation(
  requirementCanonicalId: string,
  evidenceCanonicalId: string,
): D09SemanticRelation {
  if (requirementCanonicalId === evidenceCanonicalId) {
    return relation('EXACT', 1);
  }

  // Evidence bardziej szczegółowe spełnia szerszy wymóg, np. PostgreSQL → relational DB.
  if (isAncestor(requirementCanonicalId, evidenceCanonicalId)) {
    return relation('EVIDENCE_SUBTYPE_OF_REQUIREMENT', 0.95);
  }

  // Sam szeroki termin jest słabym dowodem konkretnej technologii.
  if (isAncestor(evidenceCanonicalId, requirementCanonicalId)) {
    return relation('EVIDENCE_SUPERTYPE_OF_REQUIREMENT', 0.25);
  }

  const requirement = byId.get(requirementCanonicalId);
  const evidence = byId.get(evidenceCanonicalId);
  if (
    requirement?.relatedIds?.includes(evidenceCanonicalId) ||
    evidence?.relatedIds?.includes(requirementCanonicalId)
  ) {
    // Related tech jest wyłącznie sygnałem transferowalności. Nie spełnia konkretnego wymagania.
    return relation('RELATED_ONLY', 0);
  }

  return relation('NONE', 0);
}
