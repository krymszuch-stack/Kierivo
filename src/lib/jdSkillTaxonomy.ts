/**
 * Generalizowana, kategoryzowana taksonomia umiejętności/narzędzi ekstrahowanych
 * z sekcji "Wymagania" / "Mile widziane" ogłoszeń o pracę.
 *
 * Dlaczego osobny plik: `jdParser.ts` miał jedną płaską listę `skillNames`
 * zaprojektowaną niemal wyłącznie pod stanowiska IT/.NET. Recall na ślepym
 * holdoutcie 20 ofert wynosił 30.66% — z czego większość strat to całe branże
 * (automatyka przemysłowa, logistyka, gastronomia, księgowość, marketing,
 * QA, obsługa klienta) nieobecne w słowniku w ogóle (reguła 8: domena to
 * także prace fizyczne, nie tylko IT). Ten plik jest jednym źródłem prawdy
 * dla wszystkich kategorii (reguła 3) — nowy termin dopisuje się tutaj, nie
 * w osobnej kopii wewnątrz `jdParser.ts` czy `jdKeywordMapper.ts`.
 *
 * Każdy wpis to `SkillDefinition`: kanoniczna forma wyświetlana konsumentom
 * (`term`), czy trafia do `toolsAndTech` czy do `requiredHardSkills`/
 * `requiredSoftSkills` (`kind`), opcjonalny własny wzorzec dopasowania
 * (obsługa odmiany przez końcówki fleksyjne, wariantów zapisu typu
 * "ASP.NET"/"ASP .NET" czy skrótowców) oraz opcjonalny `guard` — dodatkowy
 * warunek na surowym tekście źródłowym, gdy samo dopasowanie granicy słowa
 * nie wystarcza do odróżnienia pojęcia od fałszywego trafienia (np. „SQL”
 * jako część „NoSQL”, czy „Jest” jako polskie słowo, a nie framework testowy).
 */

export type SkillKind = 'HARD' | 'TOOL';

export interface SkillDefinition {
  /** Kanoniczna forma zwracana konsumentom API (CV, ATS, sugestie). */
  term: string;
  kind: SkillKind;
  /**
   * Źródło wyrażenia regularnego (bez granic \b) budowane ręcznie zamiast
   * domyślnego escape'owania `term` — używane dla skrótowców z kropkami
   * ("ASP.NET"), rdzeni fleksyjnych po polsku ("wóz\p{L}*") albo alternatyw
   * zapisu. Musi być bezpieczne do owinięcia w granice `(?<![\p{L}\p{N}])`
   * i `(?![\p{L}\p{N}])` z flagami `iu`.
   */
  pattern?: string;
  /**
   * Dodatkowy warunek na źródle (fragment sekcji wymagań/mile widziane).
   * Zwrócenie `false` odrzuca dopasowanie mimo trafionego wzorca — używane
   * do rozróżnień kontekstowych (np. "Azure DevOps" vs platforma Azure).
   */
  guard?: (source: string) => boolean;
}

/** Escapuje znaki specjalne regexpu w dosłownym fragmencie terminu. */
function escapeLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Buduje wzorzec granicy słowa dla danego skilla. Domyślnie: dosłowny,
 * escape'owany termin między granicami nie-literowo/cyfrowymi (obsługuje też
 * Unicode, więc polskie znaki diakrytyczne liczą się jako litery graniczne).
 * `C` ma osobną granicę (bez uwzględniania `+`/`#`, żeby nie łapać C++/C#).
 */
export function skillRegex(def: SkillDefinition): RegExp {
  const term = def.pattern ?? escapeLiteral(def.term);
  const boundary = def.term === 'C'
    ? `(?<![A-Za-z0-9+#])C(?![A-Za-z0-9+#])`
    : `(?<![\\p{L}\\p{N}])${term}(?![\\p{L}\\p{N}])`;
  // "Jest" bez `i` — małe „jest” w polskim zdaniu nie może trafić we framework.
  return def.term === 'Jest' ? new RegExp(boundary, 'u') : new RegExp(boundary, 'iu');
}

// ---------------------------------------------------------------------------
// Software / backend & frontend: języki, frameworki, bazy danych, komunikacja,
// chmura, infrastruktura.
// ---------------------------------------------------------------------------
const SOFTWARE_SKILLS: SkillDefinition[] = [
  { term: 'TypeScript', kind: 'HARD' },
  { term: 'JavaScript', kind: 'HARD' },
  { term: 'React', kind: 'HARD' },
  { term: 'Vue', kind: 'HARD' },
  { term: 'Angular', kind: 'HARD' },
  { term: 'Svelte', kind: 'HARD' },
  { term: 'HTML', kind: 'HARD' },
  { term: 'CSS', kind: 'HARD' },
  { term: 'Node.js', kind: 'HARD' },
  { term: 'Express', kind: 'HARD' },
  { term: 'Python', kind: 'HARD' },
  { term: 'Java', kind: 'HARD' },
  { term: 'Kotlin', kind: 'HARD' },
  { term: 'Spring Boot', kind: 'HARD' },
  { term: 'Spring', kind: 'HARD' },
  { term: 'C#', kind: 'HARD' },
  { term: '.NET', kind: 'HARD', pattern: '\\.\\s*NET' },
  { term: '.NET Framework', kind: 'HARD' },
  { term: 'ASP.NET', kind: 'HARD', pattern: 'ASP\\s*\\.\\s*NET' },
  { term: 'PostgreSQL', kind: 'HARD' },
  { term: 'Oracle SQL', kind: 'HARD' },
  { term: 'PL/SQL', kind: 'HARD' },
  { term: 'SQL', kind: 'HARD' },
  { term: 'MySQL', kind: 'HARD' },
  { term: 'MongoDB', kind: 'HARD' },
  { term: 'Redis', kind: 'TOOL' },
  { term: 'Docker', kind: 'TOOL' },
  { term: 'Kubernetes', kind: 'TOOL' },
  { term: 'AWS', kind: 'TOOL' },
  { term: 'GCP', kind: 'TOOL' },
  {
    term: 'Azure', kind: 'TOOL',
    guard: (source) => !(/azure\s+devops/i.test(source) && !/(?<!devops\s)(?:platforma|chmura|usługa|usługi)\s+azure/i.test(source)),
  },
  { term: 'GraphQL', kind: 'HARD' },
  { term: 'REST API', kind: 'HARD' },
  { term: 'RESTful', kind: 'HARD' },
  { term: 'gRPC', kind: 'HARD' },
  { term: 'CI/CD', kind: 'TOOL' },
  { term: 'Git', kind: 'TOOL' },
  { term: 'GitHub', kind: 'TOOL' },
  { term: 'Bitbucket', kind: 'TOOL' },
  { term: 'Confluence', kind: 'TOOL' },
  { term: 'Tailwind', kind: 'TOOL' },
  { term: 'Next.js', kind: 'HARD' },
  { term: 'NestJS', kind: 'HARD' },
  { term: 'Microservices', kind: 'HARD' },
  { term: 'Mikroserwisy', kind: 'HARD' },
  { term: 'Jest', kind: 'TOOL' },
  { term: 'Cypress', kind: 'TOOL' },
  { term: 'Selenium', kind: 'TOOL' },
  { term: 'Playwright', kind: 'TOOL' },
  { term: 'Linux', kind: 'TOOL' },
  { term: 'Agile', kind: 'HARD' },
  { term: 'Scrum', kind: 'HARD' },
  { term: 'Jira', kind: 'TOOL' },
  { term: 'Terraform', kind: 'TOOL' },
  { term: 'Kafka', kind: 'TOOL' },
  { term: 'RabbitMQ', kind: 'TOOL' },
  { term: 'WinForms', kind: 'HARD' },
  { term: 'WPF', kind: 'HARD' },
  { term: 'MVVM', kind: 'HARD' },
  { term: 'CQRS', kind: 'HARD' },
  { term: 'DDD', kind: 'HARD' },
  { term: 'TCP/IP', kind: 'HARD' },
  { term: 'C++', kind: 'HARD' },
  { term: 'C', kind: 'HARD' },
  { term: 'Pascal', kind: 'HARD' },
  { term: 'IEC61850', kind: 'HARD' },
  { term: 'IEC870-5-103', kind: 'HARD' },
  { term: 'DNP3', kind: 'HARD' },
  { term: 'CANBUS', kind: 'HARD' },
  { term: 'MODBUS', kind: 'HARD' },
  { term: 'QT', kind: 'HARD' },
  { term: 'Embedded', kind: 'HARD' },
  { term: 'Grafana', kind: 'TOOL' },
  { term: 'Prometheus', kind: 'TOOL' },
  { term: 'EF Core', kind: 'HARD' },
  { term: 'Entity Framework Core', kind: 'HARD' },
  { term: 'Dapper', kind: 'HARD' },
  { term: 'XPO', kind: 'HARD' },
  { term: 'MVC', kind: 'HARD' },
  { term: 'MS SQL', kind: 'HARD' },
  { term: 'DevExpress WinForms', kind: 'HARD' },
  { term: 'API', kind: 'HARD' },
];

// ---------------------------------------------------------------------------
// Desktop/support: systemy operacyjne, M365/Active Directory, sieci, ticketing.
// ---------------------------------------------------------------------------
const DESKTOP_SUPPORT_SKILLS: SkillDefinition[] = [
  { term: 'Windows', kind: 'TOOL' },
  { term: 'macOS', kind: 'TOOL' },
  { term: 'Active Directory', kind: 'TOOL' },
  { term: 'Office 365', kind: 'TOOL' },
  { term: 'Microsoft 365', kind: 'TOOL' },
  { term: 'VPN', kind: 'TOOL' },
  { term: 'ServiceNow', kind: 'TOOL' },
  { term: 'Zendesk', kind: 'TOOL' },
  { term: 'Freshdesk', kind: 'TOOL' },
];

// ---------------------------------------------------------------------------
// Automatyka przemysłowa: PLC/SCADA/HMI, protokoły, robotyka.
// ---------------------------------------------------------------------------
const INDUSTRIAL_AUTOMATION_SKILLS: SkillDefinition[] = [
  { term: 'PLC', kind: 'HARD' },
  { term: 'SCADA', kind: 'HARD' },
  { term: 'HMI', kind: 'HARD' },
  { term: 'Siemens', kind: 'TOOL' },
  { term: 'Rockwell', kind: 'TOOL' },
  { term: 'Allen-Bradley', kind: 'TOOL' },
  { term: 'TIA Portal', kind: 'TOOL', pattern: 'TIA\\s*Portal' },
  { term: 'Profinet', kind: 'HARD' },
  {
    term: 'Robotics', kind: 'HARD',
    // Termin bywa opisany po polsku ("robotyka") niezależnie od języka
    // reszty ogłoszenia — wykrywamy obie formy pod jedną kanoniczną nazwą.
    pattern: '(?:robotics|robotyk\\p{L}*)',
  },
  { term: 'Electrical Engineering', kind: 'HARD' },
  {
    term: 'Automatyka przemysłowa', kind: 'HARD',
    pattern: 'automatyk\\p{L}*\\s+przemys\\p{L}*',
  },
];

// ---------------------------------------------------------------------------
// Dane / BI: arkusze, BI, ETL, analityka.
// ---------------------------------------------------------------------------
const DATA_BI_SKILLS: SkillDefinition[] = [
  { term: 'Excel', kind: 'TOOL', pattern: '(?:MS\\s+|Microsoft\\s+)?Excel' },
  { term: 'PowerPoint', kind: 'TOOL', pattern: '(?:MS\\s+|Microsoft\\s+)?PowerPoint' },
  { term: 'Power BI', kind: 'TOOL' },
  { term: 'Tableau', kind: 'TOOL' },
  { term: 'Qlik', kind: 'TOOL' },
  { term: 'Looker', kind: 'TOOL' },
  { term: 'ETL', kind: 'HARD' },
  { term: 'SSRS', kind: 'TOOL' },
  { term: 'SSIS', kind: 'TOOL' },
  { term: 'UML', kind: 'HARD' },
];

// ---------------------------------------------------------------------------
// Marketing: reklama, analityka, SEO, CRM.
// ---------------------------------------------------------------------------
const MARKETING_SKILLS: SkillDefinition[] = [
  { term: 'Google Analytics', kind: 'TOOL', pattern: 'Google\\s+Analytics(?:\\s*4|\\s*GA4)?|GA4' },
  { term: 'Google Ads', kind: 'TOOL' },
  { term: 'Meta Ads', kind: 'TOOL' },
  { term: 'Facebook Ads', kind: 'TOOL' },
  { term: 'Google Tag Manager', kind: 'TOOL', pattern: 'Google\\s+Tag\\s+Manager|GTM' },
  { term: 'SEO', kind: 'HARD' },
  { term: 'SEM', kind: 'HARD' },
  { term: 'Copywriting', kind: 'HARD' },
  { term: 'Content Marketing', kind: 'HARD' },
  { term: 'Social Media', kind: 'HARD' },
  { term: 'Mailchimp', kind: 'TOOL' },
  { term: 'HubSpot', kind: 'TOOL' },
];

// ---------------------------------------------------------------------------
// Finanse / księgowość: systemy, ERP, procesy.
// ---------------------------------------------------------------------------
const FINANCE_SKILLS: SkillDefinition[] = [
  { term: 'ERP', kind: 'TOOL' },
  { term: 'SAP', kind: 'TOOL' },
  { term: 'Enova', kind: 'TOOL' },
  { term: 'Symfonia', kind: 'TOOL' },
  { term: 'Comarch', kind: 'TOOL' },
  { term: 'Płatnik', kind: 'TOOL' },
  {
    term: 'Pełna księgowość', kind: 'HARD',
    pattern: 'pe\\p{L}*n\\p{L}*\\s+ksi\\p{L}*gowo\\p{L}*',
  },
  { term: 'Kadry i płace', kind: 'HARD', pattern: 'kadr\\p{L}*\\s+i\\s+p\\p{L}*ac\\p{L}*' },
];

// ---------------------------------------------------------------------------
// QA: automatyzacja, API, wydajność.
// ---------------------------------------------------------------------------
const QA_SKILLS: SkillDefinition[] = [
  { term: 'Postman', kind: 'TOOL' },
  { term: 'JMeter', kind: 'TOOL' },
  { term: 'Performance Testing', kind: 'HARD', pattern: '(?:performance\\s+testing|testy?\\s+wydajno\\p{L}*)' },
];

// ---------------------------------------------------------------------------
// Logistyka: WMS, uprawnienia, systemy.
// ---------------------------------------------------------------------------
const LOGISTICS_SKILLS: SkillDefinition[] = [
  { term: 'WMS', kind: 'TOOL' },
  { term: 'TMS', kind: 'TOOL' },
  {
    term: 'Wózki widłowe', kind: 'HARD',
    pattern: 'w[óo]zk?\\p{L}*\\s+wid[łl]ow\\p{L}*',
  },
  { term: 'UDT', kind: 'HARD' },
  {
    term: 'System magazynowy', kind: 'TOOL',
    pattern: 'system\\p{L}*\\s+magazynow\\p{L}*',
  },
  { term: 'Spedycja', kind: 'HARD', pattern: 'spedycj\\p{L}*' },
];

// ---------------------------------------------------------------------------
// Hotelarstwo / gastronomia: HACCP, sanepid, kuchnia, systemy hotelowe.
// ---------------------------------------------------------------------------
const HOSPITALITY_SKILLS: SkillDefinition[] = [
  { term: 'HACCP', kind: 'HARD' },
  { term: 'Sanepid', kind: 'HARD', pattern: 'sanepid\\p{L}*' },
  {
    term: 'Kuchnia polska', kind: 'HARD',
    pattern: 'kuchni\\p{L}*\\s+polsk\\p{L}*',
  },
  {
    term: 'System hotelowy', kind: 'TOOL',
    pattern: 'system\\p{L}*\\s+hotelow\\p{L}*',
  },
];

// ---------------------------------------------------------------------------
// Biuro / administracja: pakiety biurowe, obieg dokumentów, organizacja pracy.
// ---------------------------------------------------------------------------
const OFFICE_ADMIN_SKILLS: SkillDefinition[] = [
  { term: 'Word', kind: 'TOOL', pattern: '(?:MS\\s+|Microsoft\\s+)?Word' },
  { term: 'Outlook', kind: 'TOOL' },
  {
    term: 'Organizacja pracy', kind: 'HARD',
    pattern: 'organizacj\\p{L}*\\s+prac\\p{L}*',
  },
  { term: 'Obieg dokumentów', kind: 'HARD', pattern: 'obieg\\p{L}*\\s+dokument\\p{L}*' },
];

// ---------------------------------------------------------------------------
// Sprzedaż / obsługa klienta: CRM, sprzedaż, systemy klienckie.
// ---------------------------------------------------------------------------
const SALES_CUSTOMER_SERVICE_SKILLS: SkillDefinition[] = [
  { term: 'CRM', kind: 'TOOL' },
  { term: 'Salesforce', kind: 'TOOL' },
  {
    term: 'Obsługa klienta', kind: 'HARD',
    pattern: 'obs\\p{L}*ug\\p{L}*\\s+klient\\p{L}*',
  },
  {
    term: 'Obsługa pacjenta', kind: 'HARD',
    pattern: 'obs\\p{L}*ug\\p{L}*\\s+pacjent\\p{L}*',
  },
  {
    term: 'Rejestracja medyczna', kind: 'HARD',
    pattern: 'rejestracj\\p{L}*\\s+medyczn\\p{L}*',
  },
  { term: 'Negocjacje', kind: 'HARD', pattern: 'negocjacj\\p{L}*' },
];

/**
 * Pełna, jednolita taksonomia — jedno źródło prawdy dla każdego konsumenta
 * (`jdParser.ts` dziś; `jdKeywordMapper.ts` docelowo, patrz reguła 3).
 */
export const SKILL_TAXONOMY: SkillDefinition[] = [
  ...SOFTWARE_SKILLS,
  ...DESKTOP_SUPPORT_SKILLS,
  ...INDUSTRIAL_AUTOMATION_SKILLS,
  ...DATA_BI_SKILLS,
  ...MARKETING_SKILLS,
  ...FINANCE_SKILLS,
  ...QA_SKILLS,
  ...LOGISTICS_SKILLS,
  ...HOSPITALITY_SKILLS,
  ...OFFICE_ADMIN_SKILLS,
  ...SALES_CUSTOMER_SERVICE_SKILLS,
];

/** Nazwy odrębne od `SKILL_TAXONOMY`: dodatkowe formalia/wykształcenie o specjalnej składni. */
export const EXTRA_FORMAL_PATTERNS: SkillDefinition[] = [
  { term: 'Logistyka', kind: 'HARD', pattern: 'logistyk\\p{L}*' },
  {
    term: 'Wykształcenie wyższe informatyczne', kind: 'HARD',
    pattern: 'wykszta\\p{L}*cenie\\s+wy\\p{L}*sze[ ,]+informatyczne',
  },
];

/**
 * Nazwy języków traktowane jako umiejętność (nie jako formalne wymaganie
 * językowe) wyłącznie wtedy, gdy pojawiają się w sekcji "Mile widziane" bez
 * poziomu biegłości — patrz `extractNiceLanguageSkills` w `jdParser.ts`.
 * W sekcji wymagań język zawsze zostaje wyłącznie polem formalnym
 * (`languagesRequired`/`structuredLanguages`), bo tam pełni funkcję progu
 * dopuszczającego, a nie dodatkowej kompetencji do wypunktowania.
 */
export const NICE_TO_HAVE_LANGUAGE_NAMES: Record<string, string> = {
  angielski: 'Angielski', english: 'English',
  niemiecki: 'Niemiecki', german: 'German',
  francuski: 'Francuski', french: 'French',
  hiszpański: 'Hiszpański', spanish: 'Spanish',
  włoski: 'Włoski', italian: 'Italian',
  rosyjski: 'Rosyjski', russian: 'Russian',
  ukraiński: 'Ukraiński', ukrainian: 'Ukrainian',
  portugalski: 'Portugalski', portuguese: 'Portuguese',
};

/**
 * Generyczne stop-słowa dla ścieżki "bezpiecznej ekstrakcji ogólnej" —
 * fragmenty zdań i łączniki, które nigdy nie są same w sobie nazwą
 * umiejętności/narzędzia, niezależnie od branży. Celowo NIE jest to jedyny
 * mechanizm filtrujący (reguła: "unikaj podejścia czysto blacklistowego") —
 * patrz `looksLikeGenericSkillToken` w `jdParser.ts`, który wymaga też, by
 * token wyglądał jak nazwa własna/skrót, zanim w ogóle trafi pod ten filtr.
 */
export const GENERIC_REQUIREMENT_STOPWORDS = new Set([
  'min', 'minimum', 'lat', 'lata', 'roku', 'lub', 'lub równoważne', 'oraz', 'i', 'w', 'z', 'do', 'na', 'lub/i',
  'doświadczenie', 'doświadczenia', 'znajomość', 'znajomości', 'umiejętność', 'umiejętności', 'mile', 'widziane',
  'wymagania', 'wymagane', 'nasze', 'twoje', 'pracy', 'zespole', 'zespołowej', 'języka', 'poziomie', 'wykształcenie',
  'wyższe', 'obszarze', 'zakresie', 'stanowisku', 'osoby', 'osobę', 'kandydat', 'kandydata', 'kandydatów',
]);

/**
 * Polskie rzeczowniki abstrakcyjne na "-ość"/"-ości" ("dokładność",
 * "rzetelność", "samodzielność", "terminowość"...) opisują cechę/postawę,
 * nigdy nazwę narzędzia czy technologii — to produktywny (nieskończony)
 * wzorzec słowotwórczy, więc łapiemy go końcówką, a nie wymienianką słów
 * (unikamy długiej listy per-cecha, patrz reguła "bez blacklisty"). Bez tego
 * filtru zdanie zaczynające się od takiej cechy ("Dokładność, rzetelność...")
 * dawało fałszywe trafienie, bo pierwsze słowo zdania jest wielką literą,
 * a sam kształt tokenu wygląda jak nazwa własna.
 */
const ABSTRACT_TRAIT_NOUN_SUFFIX_PATTERN = /(?:ość|ości)$/iu;

/**
 * Rdzeń nazwy miasta do dopasowania odmienionych form ("Gdańska", "Poznaniu",
 * "Krakowie") bez pełnej listy przypadków — obcinamy 2 ostatnie znaki (albo
 * mniej dla krótkich nazw), więc odmieniona forma nadal zaczyna się od rdzenia
 * w zdecydowanej większości polskich deklinacji miejscowych.
 */
function locationStem(city: string): string {
  return city.slice(0, Math.max(4, city.length - 2));
}

/**
 * Frazy portalowe/benefitowe/opisowe, które nigdy nie są wymaganiem — nawet
 * jeśli formalnie znajdą się w linii sekcji "Wymagania"/"Mile widziane"
 * (np. źle posegmentowane ogłoszenie). Blokuje kandydatów niezależnie od
 * tego, czy wyglądają jak nazwa własna.
 */
export const NOISE_PHRASE_PATTERN = /aplikuj|portal|asystent rekrutacji|podsumowanie oferty|benefit|prywatna opieka|karta (?:sportowa|multisport)|premia|urlop|zniżk|integracyjn|owocow|darmow[ea]\s+(?:przekąski|kawa)/i;

/** Wszystkie definicje przeszukiwane przez `findSkillDefinitions` — słownik domenowy plus formalia o specjalnej składni. */
const ALL_SKILL_DEFINITIONS: SkillDefinition[] = [...SKILL_TAXONOMY, ...EXTRA_FORMAL_PATTERNS];

/**
 * Przeszukuje fragment tekstu (sekcję wymagań/mile widziane) pod kątem KAŻDEJ
 * definicji z taksonomii. To jest jedyne miejsce, które zna cały słownik —
 * `jdParser.ts` woła wyłącznie tę funkcję, nigdy nie iteruje `SKILL_TAXONOMY`
 * samodzielnie (reguła 3: jedno źródło prawdy).
 */
export function findSkillDefinitions(source: string): SkillDefinition[] {
  if (!source) return [];
  return ALL_SKILL_DEFINITIONS.filter((def) => {
    if (!skillRegex(def).test(source)) return false;
    if (def.guard && !def.guard(source)) return false;
    return true;
  });
}

/** Usuwa duplikaty po kanonicznym terminie (bez rozróżniania wielkości liter). */
export function dedupeSkillDefinitions(defs: SkillDefinition[]): SkillDefinition[] {
  const seen = new Map<string, SkillDefinition>();
  for (const def of defs) {
    const key = def.term.toLocaleLowerCase('pl-PL');
    if (!seen.has(key)) seen.set(key, def);
  }
  return Array.from(seen.values());
}

/**
 * Wykrywa gołą nazwę języka (bez poziomu biegłości) w sekcji "Mile widziane".
 * Zwraca kanoniczną formę z `NICE_TO_HAVE_LANGUAGE_NAMES` dla każdego języka,
 * który się tam pojawił — niezależnie od tego, czy zapisano go po polsku czy
 * po angielsku (gold bywa zapisany w obu wariantach).
 */
export function extractNiceLanguageSkills(niceSectionText: string): string[] {
  if (!niceSectionText) return [];
  const found = new Set<string>();
  for (const [key, canonical] of Object.entries(NICE_TO_HAVE_LANGUAGE_NAMES)) {
    const boundary = new RegExp(`(?<![\\p{L}\\p{N}])${escapeLiteral(key)}(?![\\p{L}\\p{N}])`, 'iu');
    if (boundary.test(niceSectionText)) found.add(canonical);
  }
  return Array.from(found);
}

/**
 * Nazwy miast/lokalizacji używane w ogłoszeniach — jedno źródło prawdy dla
 * pola `location` w `jdParser.ts` ORAZ dla odrzucania fałszywych trafień
 * w ścieżce generycznej: nazwa miasta ma dokładnie kształt nazwy własnej
 * (wielka litera, jedno słowo), więc bez tej listy `looksLikeGenericSkillToken`
 * wciągnąłby ją jako "umiejętność", gdyby trafiła do sekcji wymagań.
 */
export const KNOWN_LOCATION_NAMES = [
  'warszawa', 'katowice', 'gliwice', 'kraków', 'wrocław', 'gdańsk', 'poznań',
  'łódź', 'szczecin', 'białołęka', 'polska', 'remote', 'zdalnie',
];

export const LOCATION_NAME_PATTERN = new RegExp(KNOWN_LOCATION_NAMES.join('|'), 'i');

/** Tokeny nazw języków wykluczane ze ścieżki generycznej — języki mają własną, dedykowaną ścieżkę (`extractNiceLanguageSkills` / `structuredLanguages`). */
const KNOWN_LANGUAGE_NAME_TOKENS = new Set([
  ...Object.keys(NICE_TO_HAVE_LANGUAGE_NAMES),
  'polski', 'polish',
]);

/**
 * Separatory wyliczeń w zdaniach wymagań: przecinek, spójniki
 * "i"/"oraz"/"lub"/"and" jako osobne słowo (nie fragment innego wyrazu)
 * i koniec zdania (kropka + spacja/koniec stringa).
 *
 * Celowo BEZ ukośnika: "CI/CD", "UX/UI" to pojedyncze złożone terminy, nie
 * wyliczenie dwóch pozycji — dzielenie po "/" rozbijało "CI/CD" na osobne
 * fałszywe trafienia "CI" i "CD" (widoczne jako FP przy pełnym holdoutcie),
 * mimo że sam termin złożony jest już poprawnie łapany przez `SKILL_TAXONOMY`.
 */
const ENUMERATION_SPLIT_PATTERN = /,|\bi\b|\boraz\b|\blub\b|\band\b|\.(?:\s|$)/iu;

/**
 * Łączniki/zwroty, które poprzedzają nazwę własną, ale nią nie są — usuwane
 * z przodu tokenu, zanim ocenimy jego kształt. Stosowane iteracyjnie, bo
 * bywa więcej niż jeden łącznik z rzędu ("Minimum 3 lata doświadczenia w").
 */
const LEADING_CONNECTOR_PATTERN = /^(?:znajomo\p{L}*|umiej\p{L}*no\p{L}*|do\p{L}*wiadczeni\p{L}*(?:\s+w)?|mile\s+widzian\p{L}*|minimum|min\.?|co\s+najmniej|nasze|twoje|wymagan\p{L}*|dobr(?:a|ej|ym)|praktyczn\p{L}*|podstawow\p{L}*|bardzo\s+dobr\p{L}*)\s+/iu;

function stripLeadingConnectors(token: string): string {
  let value = token.trim();
  let previous: string;
  do {
    previous = value;
    value = value.replace(LEADING_CONNECTOR_PATTERN, '').trim();
  } while (value !== previous && value.length > 0);
  return value;
}

/**
 * Rozstrzyga, czy oczyszczony token wygląda jak nazwa własna/skrótowiec
 * narzędzia/technologii/kompetencji, a nie fragment zdania.
 *
 * Celowo NIE jest to lista firm ani narzędzi branżowych (unikamy blacklisty
 * per branża, patrz reguła "nie dokładaj hardkodowania per oferta") — token
 * musi mieć KSZTAŁT nazwy własnej: 1-3 słowa, każde albo jest akronimem
 * (same wielkie litery, dopuszczając cyfry/kropki/plusy jak "C++"/"ASP.NET"),
 * albo zaczyna się wielką literą z resztą małych liter, i żadne nie jest
 * generycznym łącznikiem/rzeczownikiem z `GENERIC_REQUIREMENT_STOPWORDS`.
 */
export function looksLikeGenericSkillToken(rawToken: string): boolean {
  const token = stripLeadingConnectors(rawToken).replace(/[.,;:]+$/g, '').trim();
  if (token.length < 2 || token.length > 40) return false;
  if (NOISE_PHRASE_PATTERN.test(token)) return false;
  // Same liczby lat doświadczenia ("3 lata", "5+ lat") nigdy nie są skillem.
  if (/^\d+\s*\+?\s*(?:lat\p{L}*|roku|years?)?$/iu.test(token)) return false;
  const lower = token.toLocaleLowerCase('pl-PL');
  if (KNOWN_LANGUAGE_NAME_TOKENS.has(lower)) return false;
  if (KNOWN_LOCATION_NAMES.includes(lower)) return false;
  // Odmieniona nazwa miasta (dopełniacz/miejscownik) ma inny sufiks, ale
  // ten sam rdzeń — patrz `locationStem`.
  if (KNOWN_LOCATION_NAMES.some((city) => lower.startsWith(locationStem(city)))) return false;
  const words = token.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  if (words.length === 1 && ABSTRACT_TRAIT_NOUN_SUFFIX_PATTERN.test(lower)) return false;
  // Jeśli KAŻDE słowo tokenu jest generycznym łącznikiem/rzeczownikiem, to
  // nie jest to nazwa własna, tylko resztka zdania.
  if (words.every((word) => GENERIC_REQUIREMENT_STOPWORDS.has(word.toLocaleLowerCase('pl-PL')))) return false;
  return words.every((word) => {
    if (GENERIC_REQUIREMENT_STOPWORDS.has(word.toLocaleLowerCase('pl-PL'))) return false;
    // Akronim: 2+ wielkie litery gdziekolwiek w słowie, reszta cyfry/./+/#/-.
    if (/^[\p{Lu}0-9][\p{Lu}0-9.+#/-]*$/u.test(word) && /\p{Lu}{2,}/u.test(word)) return true;
    // Nazwa własna: wielka litera na początku, dalej małe litery (z kropką/myślnikiem/apostrofem).
    return /^\p{Lu}[\p{Ll}.'-]*$/u.test(word);
  });
}

/**
 * Bezpieczna ścieżka generyczna: rozbija sekcję wymagań/mile widziane na
 * kandydatów-wyliczenia i zwraca te, które wyglądają jak nazwa własna/skrót
 * (patrz `looksLikeGenericSkillToken`). To siatka bezpieczeństwa dla nazw
 * narzędzi/technologii spoza `SKILL_TAXONOMY` — nie zastępuje słownika,
 * dopełnia go, więc nowe branże i produkty nie wymagają hardkodowania,
 * o ile są zapisane jako pojedyncza nazwa własna w wyliczeniu.
 */
export function extractGenericRequirementCandidates(sectionText: string): string[] {
  if (!sectionText) return [];
  const rawTokens = sectionText.split(ENUMERATION_SPLIT_PATTERN).map((token) => token.trim()).filter(Boolean);
  const candidates = new Set<string>();
  for (const raw of rawTokens) {
    const cleaned = stripLeadingConnectors(raw).replace(/[.,;:]+$/g, '').trim();
    if (!cleaned || !looksLikeGenericSkillToken(cleaned)) continue;
    candidates.add(cleaned);
  }
  return Array.from(candidates);
}
