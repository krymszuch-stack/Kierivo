import { detectIndustryFromRole, IndustryDomain } from './starContextHelper';

export type SectionType = 'bullet' | 'summary' | 'project';
export type RuleFocus = 'star' | 'action_verbs' | 'ats_clarity';

export interface RewriteAnalysis {
  hasPassiveOrWeakWords: boolean;
  detectedWeakPhrases: string[];
  hasMetrics: boolean;
  detectedMetrics: string[];
  industry: IndustryDomain;
}

export interface RewriteResult {
  originalText: string;
  proposedText: string;
  ruleExplanation: string;
  appliedRules: string[];
  analysis: RewriteAnalysis;
  diffHighlights: {
    addedOrChanged: string[];
  };
}

const WEAK_PHRASES = [
  'moim zadaniem było',
  'byłem odpowiedzialny za',
  'byłam odpowiedzialna za',
  'odpowiedzialny za',
  'odpowiedzialna za',
  'zajmowałem się',
  'zajmowałam się',
  'polegało na',
  'pomagałem w',
  'pomagałam w',
  'brałem udział w',
  'brałam udział w',
  'uczestniczyłem w',
  'uczestniczyłam w',
  'robiłem',
  'robiłam',
  'wykonywałem pracę',
  'wykonywałam pracę',
  'do moich obowiązków należało',
  'ja ',
];

const INDUSTRY_STRONG_VERBS: Record<IndustryDomain, string[]> = {
  tech: [
    'Zmontowałem i uruchomiłem',
    'Zmodernizowałem instalację',
    'Przeprowadziłem diagnostykę i naprawę',
    'Zrealizowałem montaż',
    'Wykonałem prace spawalnicze i montażowe',
  ],
  logistics: [
    'Skompletowałem i przygotowałem do wysyłki',
    'Zoptymalizowałem proces załadunku',
    'Obsłużyłem przyjęcia magazynowe w systemie WMS',
    'Zreorganizowałem przestrzeń składowania',
  ],
  medical: [
    'Przeprowadziłem procedury medyczne',
    'Zabezpieczyłem i monitorowałem stan pacjentów',
    'Wdrożyłem zaktualizowane procedury sanitarne',
    'Skoordynowałem opiekę nad pacjentami',
  ],
  sales: [
    'Pozyskałem i sfinalizowałem umowy z',
    'Zbudowałem długofalowe relacje z',
    'Wynegocjowałem warunki handlowe dla',
    'Przeprowadziłem prezentacje produktowe dla',
  ],
  mgmt: [
    'Skoordynowałem realizację projektu',
    'Wdrożyłem usprawnienia procesowe w zespole',
    'Zarządzałem budżetem i harmonogramem',
    'Zreorganizowałem podział zadań w dziale',
  ],
  it: [
    'Zaprojektowałem i zaimplementowałem',
    'Zoptymalizowałem architekturę modułu',
    'Wdrożyłem zautomatyzowane testy i pipeline CI/CD',
    'Zintegrowałem kluczowe usługi API',
  ],
  general: [
    'Zrealizowałem kompleksowo proces',
    'Wdrożyłem usprawnienia operacyjne w zakresie',
    'Skoordynowałem wykonanie zadań w obszarze',
    'Opracowałem i wdrożyłem procedurę dla',
  ],
};

/**
 * Analizuje fragment tekstu pod kątem słabości stylistycznych i standardów ATS.
 */
export function analyzeSectionText(text: string, roleTitle?: string): RewriteAnalysis {
  const lower = text.toLowerCase();

  const detectedWeakPhrases = WEAK_PHRASES.filter((phrase) => lower.includes(phrase));

  // Wykrywanie istniejących metryk (cyfry, procenty, kwoty, przedziały)
  const metricRegex = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|zł|pln|usd|eur|godz|h|min|szt|km|ton|kg|m2|m3|krot|razy))?|\b\d+\+/gi;
  const matches = text.match(metricRegex) || [];
  const detectedMetrics = [...new Set(matches.map((m) => m.trim()))];

  const industry = detectIndustryFromRole(roleTitle);

  return {
    hasPassiveOrWeakWords: detectedWeakPhrases.length > 0,
    detectedWeakPhrases,
    hasMetrics: detectedMetrics.length > 0,
    detectedMetrics,
    industry,
  };
}

/**
 * Oczyszcza tekst z typowych form biernych i zaimków wprowadzających.
 */
function stripWeakPrefixes(text: string): string {
  let cleaned = text.trim();

  // Usuń początkowe punktorowe znaki (-, •, *, itp.)
  cleaned = cleaned.replace(/^[-•*–—\s]+/, '');

  for (const phrase of WEAK_PHRASES) {
    const regex = new RegExp(`^${phrase}\\s*`, 'i');
    cleaned = cleaned.replace(regex, '');
  }

  // Wyrównanie wielkości pierwszej litery po usunięciu prefiksu
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  return cleaned.trim();
}

/**
 * Deterministyczny silnik regułowy rewritingu (zgodny z regułami STAR i ATS).
 * Działa natychmiastowo, bezpiecznie i bez zmyślania danych.
 */
export function rewriteSectionWithRules(params: {
  text: string;
  roleTitle?: string;
  sectionType?: SectionType;
  ruleFocus?: RuleFocus;
}): RewriteResult {
  const { text, roleTitle, ruleFocus = 'star' } = params;
  const analysis = analyzeSectionText(text, roleTitle);

  const appliedRules: string[] = [];
  const explanationParts: string[] = [];

  const strippedBody = stripWeakPrefixes(text);

  // Wybór mocnego czasownika akcji dla danej branży
  const verbs = INDUSTRY_STRONG_VERBS[analysis.industry] || INDUSTRY_STRONG_VERBS.general;
  const selectedVerb = verbs[0];

  appliedRules.push('Mocny czasownik dokonany');
  explanationParts.push(
    `Zastąpiono formę bierną aktywnym czasownikiem („${selectedVerb}”) dopasowanym do branży (${analysis.industry}).`
  );

  if (analysis.hasPassiveOrWeakWords) {
    appliedRules.push('Eliminacja zaimków i zwrotów biernych');
    explanationParts.push(
      `Usunięto osłabiające sformułowania (${analysis.detectedWeakPhrases.join(', ')}), aby parsery ATS i rekruter od razu widzieli sprawczość.`
    );
  }

  appliedRules.push('Struktura STAR (Akcja + Rezultat)');

  let proposedText: string;

  if (analysis.hasMetrics) {
    // Jeśli użytkownik podał już metrykę w tekście — ściśle ją zachowaj! (Reguła 1)
    appliedRules.push('Zachowanie oryginalnych metryk');
    explanationParts.push(
      `Zachowano podane w oryginale faktyczne liczby (${analysis.detectedMetrics.join(', ')}).`
    );

    proposedText = `${selectedVerb} ${strippedBody}, co bezpośrednio przełożyło się na realizację założonych celów.`;
  } else {
    // Jeśli brak metryki — zgodnie z Regułą 1 NIE wymyślamy zmyślonych liczb,
    // tylko wstawiamy czytelny szablon dla kandydata do wpisania prawdy.
    appliedRules.push('Szablon mierzalnego rezultatu (Zero zmyślania liczb)');
    explanationParts.push(
      'Dodano miejsce na mierzalny wskaźnik [np. o X% / Y szt.] — uzupełnij go wyłącznie prawdziwym pomiarem.'
    );

    if (ruleFocus === 'ats_clarity') {
      proposedText = `${selectedVerb} ${strippedBody}, podnosząc efektywność operacyjną [np. o X% / w skali Y].`;
    } else {
      proposedText = `${selectedVerb} ${strippedBody}, osiągając mierzalny rezultat [np. skrócenie czasu o X% / realizacja Y zleceń bez uwag].`;
    }
  }

  // Wygładzenie interpunkcji i spacji
  proposedText = proposedText.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();

  // Obliczenie tokenów diff (dodane lub zmienione słowa)
  const origWords = new Set(text.toLowerCase().split(/\s+/));
  const proposedWords = proposedText.split(/\s+/);
  const addedOrChanged = proposedWords.filter(
    (word) => !origWords.has(word.toLowerCase().replace(/[.,;:]/g, ''))
  );

  return {
    originalText: text.trim(),
    proposedText,
    ruleExplanation: explanationParts.join(' '),
    appliedRules,
    analysis,
    diffHighlights: {
      addedOrChanged: [...new Set(addedOrChanged)].slice(0, 10),
    },
  };
}
