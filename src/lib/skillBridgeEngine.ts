import { SkillBridge, MasterVault } from '../types';
import { buildCandidateSkillEvidenceEntries } from './candidateEvidence';
import { hasPositiveSkillEvidence } from './skillEvidence';

interface BridgeDefinition {
  targetSkillRegex: RegExp;
  adjacentSkills: string[];
  relatedTopics: string;
}

/**
 * Matryca mostów kompetencyjnych łącząca brakujące umiejętności z umiejętnościami pokrewnymi
 * (obejmuje IT, architekturę systemów oraz branże techniczno-inżynieryjne zgodnie z Regułą 8).
 */
const BRIDGE_DEFINITIONS: BridgeDefinition[] = [
  // IT & Architektura
  {
    targetSkillRegex: /\b(?:kafka|apache\s+kafka)\b/i,
    adjacentSkills: ['RabbitMQ', 'Redis', 'AWS SQS', 'Event-Driven', 'Microservices', 'Node.js', 'PostgreSQL'],
    relatedTopics: 'Wiadomości, publikowanie i subskrypcja oraz asynchroniczne strumienie zdarzeń.',
  },
  {
    targetSkillRegex: /\b(?:aws|amazon\s+web\s+services)\b/i,
    adjacentSkills: ['GCP', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Linux'],
    relatedTopics: 'Tożsamość i dostęp, przechowywanie obiektów, maszyny obliczeniowe i funkcje bezserwerowe.',
  },
  {
    targetSkillRegex: /\b(?:kubernetes|k8s)\b/i,
    adjacentSkills: ['Docker', 'Docker Compose', 'CI/CD', 'Konteneryzacja', 'Linux', 'Microservices'],
    relatedTopics: 'Kontenery, deklaratywna konfiguracja, orkiestracja i routing sieciowy.',
  },
  {
    targetSkillRegex: /\b(?:graphql)\b/i,
    adjacentSkills: ['REST API', 'TypeScript', 'gRPC', 'PostgreSQL', 'SQL', 'Node.js'],
    relatedTopics: 'Modelowanie danych, interfejsy API i kształtowanie odpowiedzi.',
  },
  {
    targetSkillRegex: /\b(?:typescript|ts)\b/i,
    adjacentSkills: ['JavaScript', 'React', 'Node.js', 'Java', 'C#', 'C++'],
    relatedTopics: 'Składnia programowania, typy danych i narzędzia deweloperskie.',
  },

  // Branże techniczne & Prace inżynieryjne (Reguła 8)
  {
    targetSkillRegex: /\b(?:spawanie\s+tig|metoda\s+141|tig)\b/i,
    adjacentSkills: ['Spawanie MIG/MAG', 'Metoda 135', 'Ślusarstwo', 'Rysunek techniczny', 'Obróbka metali'],
    relatedTopics: 'Przygotowanie materiału, kontrola procesu i ocena jakości spoin.',
  },
  {
    targetSkillRegex: /\b(?:sep\s+g2|cieplne|uprawnienia\s+cieplne)\b/i,
    adjacentSkills: ['SEP G1', 'Uprawnienia elektryczne', 'BHP', 'Utrzymanie Ruchu', 'Prewencja'],
    relatedTopics: 'Bezpieczeństwo pracy i eksploatacja urządzeń; grupy i zakresy kwalifikacji pozostają odrębne.',
  },
  {
    targetSkillRegex: /\b(?:siemens|s7-1200|s7-1500|step\s*7|tia\s+portal)\b/i,
    adjacentSkills: ['Automatyka', 'Omron', 'Allen-Bradley', 'Utrzymanie Ruchu', 'Diagnostyka maszyn', 'Schematy elektryczne'],
    relatedTopics: 'Automatyka, sygnały wejścia/wyjścia i diagnostyka urządzeń.',
  },
  {
    targetSkillRegex: /\b(?:sap\s+wms|sap\s+erp)\b/i,
    adjacentSkills: ['WMS', 'Comarch ERP', 'Gospodarka Magazynowa', 'Skanery kodów', 'Inwentaryzacja'],
    relatedTopics: 'Stany magazynowe, lokalizacje, kompletacja i obieg dokumentów.',
  },
];

/**
 * Buduje most kompetencyjny dla pojedynczej brakującej umiejętności.
 */
export function findSkillBridgeForGap(
  missingSkill: string | undefined | null,
  vault: MasterVault | Partial<MasterVault> | undefined | null
): SkillBridge | undefined {
  const skillStr = typeof missingSkill === 'string' ? missingSkill.trim() : String(missingSkill || '').trim();
  if (!skillStr) return undefined;

  const safeVault = (vault || {}) as MasterVault;
  const evidenceEntries = buildCandidateSkillEvidenceEntries(safeVault);

  for (const def of BRIDGE_DEFINITIONS) {
    if (def.targetSkillRegex.test(skillStr)) {
      // Brak wpisu nie jest dowodem braku kompetencji — jeżeli profil już ją
      // zawiera, nie pokazuj sugestii „brak” ani mostu dla tej samej pozycji.
      // Regex wybiera rodzinę mostu, nie stwierdza równoważności jej narzędzi.
      // TIA Portal w profilu nie potwierdza automatycznie sterowników Siemens S7.
      if (evidenceEntries.some(entry => hasPositiveSkillEvidence(entry.text, skillStr))) return undefined;
      // Szukamy wyłącznie umiejętności pokrewnej rzeczywiście posiadanej przez kandydata
      let foundAdjacent: string | undefined;
      for (const adj of def.adjacentSkills) {
        if (evidenceEntries.some(entry => hasPositiveSkillEvidence(entry.text, adj))) {
          foundAdjacent = adj;
          break;
        }
      }

      // Jeżeli kandydat rzeczywiście posiada umiejętność pokrewną z definicji
      if (foundAdjacent) {
        const adjacentSkill = foundAdjacent;

        // Źródło także musi zawierać pozytywny wpis; sam tag w zanegowanej pracy
        // nie pozwala przypisać umiejętności do tej firmy.
        const evidenceFromVault = evidenceEntries.find(entry =>
          entry.sourceLabel && hasPositiveSkillEvidence(entry.text, adjacentSkill)
        )?.sourceLabel;

      const talkingPoint = `W profilu mam wskazane ${adjacentSkill}${evidenceFromVault ? ` (${evidenceFromVault})` : ''}. To powiązane doświadczenie, ale samo w sobie nie potwierdza ${skillStr} ani wymaganych do niej formalnych uprawnień. Mogę opisać zakres, który rzeczywiście wykonywałem, i dopytać, jakiego poziomu ${skillStr} oczekuje pracodawca.`;

        return {
          id: `bridge_${skillStr.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          missingSkill: skillStr,
          adjacentSkill,
          relatedTopics: def.relatedTopics,
          bridgeExplanation: `Profil zawiera wpis o ${adjacentSkill}. To powiązana pozycja, ale nie potwierdza ${skillStr} i nie zastępuje wymaganej kwalifikacji.`,
          talkingPoint,
          evidenceFromVault,
        };
      }
    }
  }

  // Brak jawnej definicji mostu dla tej luki (albo brak udokumentowanej
  // umiejętności pokrewnej) = brak mostu. Wcześniejszy fallback generyczny
  // (`Excel → Kafka`, „pewność" 75%) fabrykował równoważność pojęciową dla
  // dowolnej pary z pierwszej umiejętności z brzegu — liczba 75 nie miała
  // kalibracji i wprowadzała w błąd (F12, faza 4: usuń fałszywą pewność).
  // Wywołujący (`generateSkillBridges`) filtruje `undefined`.
  return undefined;
}

/**
 * Generuje listę mostów kompetencyjnych dla podanej listy brakujących umiejętności.
 */
export function generateSkillBridges(
  missingSkills: string[] | undefined | null,
  vault: MasterVault | Partial<MasterVault> | undefined | null
): SkillBridge[] {
  if (!Array.isArray(missingSkills) || missingSkills.length === 0) return [];
  const safeVault = (vault || {}) as MasterVault;
  const uniqueMissing = Array.from(new Set(missingSkills.map((s) => (typeof s === 'string' ? s.trim() : String(s || '').trim())))).filter(Boolean);
  return uniqueMissing
    .map((skill) => findSkillBridgeForGap(skill, safeVault))
    .filter((b): b is SkillBridge => Boolean(b));
}

export const findOrGenerateBridge = findSkillBridgeForGap;

export function getCommonSkillsList(): string[] {
  return [
    'AWS',
    'Kafka',
    'Kubernetes',
    'GraphQL',
    'TypeScript',
    'Docker',
    'PostgreSQL',
    'Redis',
    'Terraform',
    'React',
    'SEP',
    'UDT',
    'Next.js',
    'Rust',
  ];
}

