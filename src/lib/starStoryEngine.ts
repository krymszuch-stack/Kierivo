import { STARStory, MasterVault } from '../types';

/**
 * Słownik słów kluczowych dla silnika autotagowania NLP (Lightweight NLP)
 */
const AUTO_TAG_DICTIONARY: Array<{ tag: string; regex: RegExp; category: 'TECH' | 'TRADE' | 'SOFT' | 'BUSINESS' }> = [
  // IT & Technologie
  { tag: 'TypeScript', regex: /\b(?:typescript|ts)\b/i, category: 'TECH' },
  { tag: 'React', regex: /\b(?:react|reactjs|react\.js)\b/i, category: 'TECH' },
  { tag: 'Node.js', regex: /\b(?:node|nodejs|node\.js)\b/i, category: 'TECH' },
  { tag: 'PostgreSQL', regex: /\b(?:postgres|postgresql)\b/i, category: 'TECH' },
  { tag: 'SQL', regex: /\b(?:sql|mysql|oracle|database)\b/i, category: 'TECH' },
  { tag: 'Kafka', regex: /\b(?:kafka|event-driven|strumieniowanie)\b/i, category: 'TECH' },
  { tag: 'Docker', regex: /\b(?:docker|konteneryzacja|containers)\b/i, category: 'TECH' },
  { tag: 'Kubernetes', regex: /\b(?:kubernetes|k8s)\b/i, category: 'TECH' },
  { tag: 'AWS', regex: /\b(?:aws|amazon web services|s3|lambda|ec2)\b/i, category: 'TECH' },
  { tag: 'GCP', regex: /\b(?:gcp|google cloud|bigquery)\b/i, category: 'TECH' },
  { tag: 'Azure', regex: /\b(?:azure|microsoft cloud)\b/i, category: 'TECH' },
  { tag: 'Python', regex: /\b(?:python|django|fastapi|flask)\b/i, category: 'TECH' },
  { tag: 'Redis', regex: /\b(?:redis|caching|pamięć podręczna)\b/i, category: 'TECH' },
  { tag: 'GraphQL', regex: /\b(?:graphql|apollo)\b/i, category: 'TECH' },
  { tag: 'CI/CD', regex: /\b(?:ci\/cd|pipeline|github actions|gitlab ci|jenkins)\b/i, category: 'TECH' },
  { tag: 'Mikroserwisy', regex: /\b(?:mikroserwisy|microservices|rozproszon)\b/i, category: 'TECH' },

  // Branże techniczne i prace fizyczne (Reguła 8)
  { tag: 'SEP', regex: /\b(?:sep|sep\s+g1|sep\s+g2|sep\s+g3|uprawnienia\s+elektryczne)\b/i, category: 'TRADE' },
  { tag: 'UDT', regex: /\b(?:udt|wózki\s+widłowe|suwnice|podesty)\b/i, category: 'TRADE' },
  { tag: 'F-Gaz', regex: /\b(?:f-gaz|fgaz|klimatyzacja|chłodnictwo)\b/i, category: 'TRADE' },
  { tag: 'Spawanie TIG', regex: /\b(?:spawanie\s+tig|metoda\s+141|tig)\b/i, category: 'TRADE' },
  { tag: 'Spawanie MIG/MAG', regex: /\b(?:spawanie\s+mig|spawanie\s+mag|metoda\s+135|mig\/mag)\b/i, category: 'TRADE' },
  { tag: 'Utrzymanie Ruchu', regex: /\b(?:utrzymanie\s+ruchu|ur|awari[ae]|napraw[ay]|prewencja)\b/i, category: 'TRADE' },
  { tag: 'BHP', regex: /\b(?:bhp|bezpieczeństwo\s+pracy|środki\s+ochrony)\b/i, category: 'TRADE' },
  { tag: '5S', regex: /\b(?:5s|lean|lean\s+manufacturing|kaizen)\b/i, category: 'TRADE' },
  { tag: 'WMS', regex: /\b(?:wms|magazyn|gospodarka\s+magazynowa|kompletacja)\b/i, category: 'TRADE' },

  // Kompetencje miękkie & przywództwo
  { tag: 'Optymalizacja', regex: /\b(?:optymalizacj[aei]|przyspieszen|skrócen|popraw[ay]\s+wydajności)\b/i, category: 'SOFT' },
  { tag: 'Architektura', regex: /\b(?:architektur[ae]|design\s+patterns|wzorce\s+projektowe)\b/i, category: 'SOFT' },
  { tag: 'Przywództwo', regex: /\b(?:przywództwo|leadership|kierowanie|zarządzanie\s+zespołem|team\s+lead)\b/i, category: 'SOFT' },
  { tag: 'Mentoring', regex: /\b(?:mentoring|onboarding|wdrażanie\s+pracowników|szkolenie)\b/i, category: 'SOFT' },
  { tag: 'Rozwiązywanie Problemów', regex: /\b(?:rozwiąz|problem|debugging|analiza\s+przyczyn|rca)\b/i, category: 'SOFT' },
  { tag: 'Zarządzanie Kryzysowe', regex: /\b(?:kryzys|incydent|postmortem|awaria\s+krytyczna)\b/i, category: 'SOFT' },
  { tag: 'Praca Zespołowa', regex: /\b(?:zespół|współpraca|cross-functional|komunikacja)\b/i, category: 'SOFT' },

  // Wyniki & Wskaźniki Biznesowe
  { tag: 'Redukcja Kosztów', regex: /\b(?:koszt[ówy]|oszczędnoś|taniej|budżet)\b/i, category: 'BUSINESS' },
  { tag: 'Wysoka Dostępność (HA)', regex: /\b(?:uptime|high\s+availability|sla|99\.\d+%)\b/i, category: 'BUSINESS' },
  { tag: 'Skalowanie', regex: /\b(?:skalowan|tps|ruch|użytkownik[ówi]|skala)\b/i, category: 'BUSINESS' },
];

/**
 * Lekki silnik NLP (Lightweight NLP) sugerujący tagi na podstawie treści historii STAR.
 */
export function suggestTagsForSTARStory(
  story: Partial<STARStory>,
  existingTags: string[] = []
): string[] {
  const combinedText = [
    story.title || '',
    story.situation || '',
    story.task || '',
    story.action || '',
    story.result || '',
    story.sourceEvidence || '',
    ...(story.metrics || []),
  ].join(' ');

  if (!combinedText.trim()) {
    return [];
  }

  const existingNorm = new Set(
    [...(story.tags || []), ...existingTags].map((t) => t.trim().toLowerCase())
  );

  const suggested = new Set<string>();

  for (const item of AUTO_TAG_DICTIONARY) {
    if (!existingNorm.has(item.tag.toLowerCase()) && item.regex.test(combinedText)) {
      suggested.add(item.tag);
    }
  }

  // Wykrywanie wskaźników liczbowych -> tag "Metryki i Liczby"
  if (/(?:^|\s|[+<>=~])\d+[%xXkKmM+]?(?:\s*(?:s|ms|zł|pln|tps|lcp|fcp))?(?:\s|$|[,.:;])/i.test(combinedText) && !existingNorm.has('metryki i liczby')) {
    suggested.add('Metryki i Liczby');
  }

  return Array.from(suggested);
}

/**
 * Tworzy szkice historii z jawnych wpisów profilu. Sam punkt CV nie dowodzi
 * sytuacji, zakresu odpowiedzialności ani rezultatu, więc te pola pozostają puste.
 */
export function buildStarStoriesFromVault(vault: MasterVault): STARStory[] {
  const stories: STARStory[] = [];

  // 1. Punkty doświadczenia pozostają materiałem źródłowym, nie gotową historią STAR.
  if (Array.isArray(vault?.history)) {
    vault.history.forEach((exp) => {
      if (Array.isArray(exp?.highlights)) {
        exp.highlights.forEach((hl, hlIdx) => {
          const hlText = typeof hl === 'string' ? hl : (hl?.text || '');
          const hlMetric = typeof hl === 'object' && hl !== null ? hl.metric : undefined;
          const hlAction = typeof hl === 'object' && hl !== null ? hl.action : undefined;
          const hlTarget = typeof hl === 'object' && hl !== null ? hl.target : undefined;
          const hlTool = typeof hl === 'object' && hl !== null ? hl.tool : undefined;
          const hlKeywords = typeof hl === 'object' && hl !== null && Array.isArray(hl.keywords) ? hl.keywords : [];
          const sourceEvidence = [
            hlText.trim(),
            hlAction && `Działanie zapisane w profilu: ${hlAction}`,
            hlTarget && `Zakres zapisany w profilu: ${hlTarget}`,
            hlTool && `Narzędzie zapisane w profilu: ${hlTool}`,
            hlMetric && `Metryka zapisana w profilu: ${hlMetric}`,
          ].filter((part): part is string => Boolean(part && part.trim()));

          // Puste rekordy highlight nie mogą produkować kart wyglądających jak historie.
          if (sourceEvidence.length === 0) return;

          const tags = hlKeywords.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()));
          const roleAndCompany = [exp.role, exp.company].filter(Boolean).join(' — ');

          const story: STARStory = {
            id: `star_exp_${exp.id || 'exp'}_${hlIdx}`,
            title: roleAndCompany || 'Punkt doświadczenia z profilu',
            situation: '',
            task: '',
            action: '',
            result: '',
            sourceEvidence: sourceEvidence.join(' • '),
            metrics: hlMetric ? [hlMetric] : [],
            tags,
            projectId: exp.id || `exp_${hlIdx}`,
            durationSec: 90, // Domyślny czas prezentacji STAR = 90 sekund (1.5 minuty)
          };

          // Dopełnij tagi sugestiami NLP
          const autoTags = suggestTagsForSTARStory(story, story.tags);
          story.tags = Array.from(new Set([...story.tags, ...autoTags.slice(0, 2)]));

          stories.push(story);
        });
      }
    });
  }

  // 2. Z projektów bierzemy tylko opisane fakty; nie zakładamy wdrożenia ani sukcesu.
  if (Array.isArray(vault.projects)) {
    vault.projects.forEach((proj, projIdx) => {
      const sourceEvidence = [
        proj.description && `Opis zapisany w profilu: ${proj.description}`,
        proj.role && `Rola zapisana w profilu: ${proj.role}`,
        Array.isArray(proj.techStack) && proj.techStack.length > 0
          ? `Technologie zapisane w profilu: ${proj.techStack.join(', ')}`
          : '',
        proj.metrics && `Metryka zapisana w profilu: ${proj.metrics}`,
      ].filter((part): part is string => Boolean(part && part.trim()));

      if (sourceEvidence.length === 0) return;

      const story: STARStory = {
        id: `star_proj_${proj.id || projIdx}`,
        title: proj.name ? `Projekt: ${proj.name}` : 'Projekt z profilu',
        situation: '',
        task: '',
        action: '',
        result: '',
        sourceEvidence: sourceEvidence.join(' • '),
        metrics: proj.metrics ? [proj.metrics] : [],
        tags: Array.isArray(proj.techStack) ? [...proj.techStack] : [],
        projectId: proj.id || `proj_${projIdx}`,
        durationSec: 90,
      };

      const autoTags = suggestTagsForSTARStory(story, story.tags);
      story.tags = Array.from(new Set([...story.tags, ...autoTags.slice(0, 2)]));

      stories.push(story);
    });
  }

  return stories;
}

/**
 * Filtruje historie STAR na podstawie wybranych tagów z chmury tagów.
 */
export function filterStarStoriesByTags(
  stories: STARStory[],
  activeTags: string[],
  searchQuery: string = ''
): STARStory[] {
  let filtered = stories;

  if (activeTags.length > 0) {
    const activeLower = activeTags.map((t) => t.toLowerCase());
    filtered = filtered.filter((s) =>
      s.tags.some((tag) => activeLower.includes(tag.toLowerCase()))
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.situation.toLowerCase().includes(q) ||
        s.action.toLowerCase().includes(q) ||
        s.result.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return filtered;
}

/**
 * Znajduje najbardziej pasującą historię STAR dla aktywnego tagu (auto-load do slotu 3 w HUD).
 */
export function findStoryForActiveTag(
  stories: STARStory[],
  activeTag: string | undefined
): STARStory | undefined {
  if (!activeTag || !stories.length) return undefined;
  const tagLower = activeTag.toLowerCase();
  return stories.find((s) => s.tags.some((t) => t.toLowerCase() === tagLower));
}
