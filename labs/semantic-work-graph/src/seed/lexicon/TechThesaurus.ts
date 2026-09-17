import { SkillSynonym } from '../../repositories/SqliteGraphRepository.js';

/**
 * Awaryjny (offline) tezaurus umiejętności.
 *
 * Docelowym źródłem jest taksonomia ESCO Komisji Europejskiej. Gdy pobranie ESCO
 * jest niemożliwe, ten zestaw utrzymuje działanie mapowania żargonu: 100
 * najpopularniejszych technologii oraz kompetencje opisane czasownikami akcji,
 * każde z etykietami alternatywnymi w polskim i angielskim wariancie branżowym.
 */
export interface SkillSeed {
  /** Nazwa bazowa, do której sprowadzamy wszystkie warianty. */
  canonical: string;
  /** Kategoria dziedzinowa. */
  category: string;
  /** Etykiety alternatywne: skróty, anglicyzmy, opisy wielowyrazowe. */
  altLabels: string[];
}

/** 100 najpopularniejszych technologii wraz z żargonem branżowym. */
export const TECHNOLOGY_SKILLS: SkillSeed[] = [
  // --- Języki programowania -------------------------------------------------
  { canonical: 'javascript', category: 'Języki programowania', altLabels: ['js', 'ecmascript', 'es6', 'javascripcie'] },
  { canonical: 'typescript', category: 'Języki programowania', altLabels: ['ts', 'typed javascript'] },
  { canonical: 'python', category: 'Języki programowania', altLabels: ['python3', 'py', 'pyton'] },
  { canonical: 'java', category: 'Języki programowania', altLabels: ['jdk', 'jvm', 'java se', 'java ee'] },
  { canonical: 'kotlin', category: 'Języki programowania', altLabels: ['kotlin jvm'] },
  { canonical: 'c#', category: 'Języki programowania', altLabels: ['csharp', 'c sharp', 'c-sharp'] },
  { canonical: 'c++', category: 'Języki programowania', altLabels: ['cpp', 'c plus plus'] },
  { canonical: 'go', category: 'Języki programowania', altLabels: ['golang', 'go lang'] },
  { canonical: 'rust', category: 'Języki programowania', altLabels: ['rust lang'] },
  { canonical: 'php', category: 'Języki programowania', altLabels: ['php8', 'php7'] },
  { canonical: 'ruby', category: 'Języki programowania', altLabels: ['ruby lang'] },
  { canonical: 'swift', category: 'Języki programowania', altLabels: ['swift ios'] },
  { canonical: 'scala', category: 'Języki programowania', altLabels: ['scala jvm'] },
  { canonical: 'sql', category: 'Języki programowania', altLabels: ['zapytania sql', 'język sql', 'ansi sql'] },
  { canonical: 'bash', category: 'Języki programowania', altLabels: ['shell', 'skrypty powłoki', 'sh', 'zsh'] },

  // --- Frontend -------------------------------------------------------------
  { canonical: 'react', category: 'Frontend', altLabels: ['reactjs', 'react.js', 'react js'] },
  { canonical: 'next.js', category: 'Frontend', altLabels: ['nextjs', 'next js'] },
  { canonical: 'vue', category: 'Frontend', altLabels: ['vuejs', 'vue.js', 'vue3'] },
  { canonical: 'angular', category: 'Frontend', altLabels: ['angularjs', 'angular2'] },
  { canonical: 'svelte', category: 'Frontend', altLabels: ['sveltekit'] },
  { canonical: 'tailwind', category: 'Frontend', altLabels: ['tailwindcss', 'tailwind css'] },
  { canonical: 'sass', category: 'Frontend', altLabels: ['scss', 'preprocesor css'] },
  { canonical: 'webpack', category: 'Frontend', altLabels: ['bundler webpack'] },
  { canonical: 'vite', category: 'Frontend', altLabels: ['vitejs', 'vite js'] },
  { canonical: 'redux', category: 'Frontend', altLabels: ['redux toolkit', 'rtk'] },
  { canonical: 'html', category: 'Frontend', altLabels: ['html5', 'hypertext markup language'] },
  { canonical: 'css', category: 'Frontend', altLabels: ['css3', 'arkusze stylów'] },

  // --- Backend i frameworki -------------------------------------------------
  { canonical: 'node.js', category: 'Backend', altLabels: ['nodejs', 'node', 'node js'] },
  { canonical: 'express', category: 'Backend', altLabels: ['expressjs', 'express.js'] },
  { canonical: 'nest.js', category: 'Backend', altLabels: ['nestjs', 'nest js'] },
  { canonical: 'spring', category: 'Backend', altLabels: ['spring boot', 'springboot', 'spring framework'] },
  { canonical: 'django', category: 'Backend', altLabels: ['django rest framework', 'drf'] },
  { canonical: 'flask', category: 'Backend', altLabels: ['flask python'] },
  { canonical: 'fastapi', category: 'Backend', altLabels: ['fast api'] },
  { canonical: 'laravel', category: 'Backend', altLabels: ['laravel php'] },
  { canonical: 'ruby on rails', category: 'Backend', altLabels: ['rails', 'ror'] },
  { canonical: '.net', category: 'Backend', altLabels: ['dotnet', 'asp.net', 'net core', '.net core'] },
  { canonical: 'symfony', category: 'Backend', altLabels: ['symfony php'] },
  { canonical: 'graphql', category: 'Backend', altLabels: ['graph ql', 'apollo graphql'] },

  // --- Bazy danych ----------------------------------------------------------
  { canonical: 'postgresql', category: 'Bazy danych', altLabels: ['postgres', 'psql', 'postgre'] },
  { canonical: 'mysql', category: 'Bazy danych', altLabels: ['my sql', 'mariadb'] },
  { canonical: 'mongodb', category: 'Bazy danych', altLabels: ['mongo', 'mongo db'] },
  { canonical: 'redis', category: 'Bazy danych', altLabels: ['cache redis', 'redisie'] },
  { canonical: 'elasticsearch', category: 'Bazy danych', altLabels: ['elastic', 'elastic search', 'opensearch'] },
  { canonical: 'cassandra', category: 'Bazy danych', altLabels: ['apache cassandra'] },
  { canonical: 'sqlite', category: 'Bazy danych', altLabels: ['sqlite3'] },
  { canonical: 'oracle', category: 'Bazy danych', altLabels: ['oracle db', 'oracle database', 'plsql'] },
  { canonical: 'sql server', category: 'Bazy danych', altLabels: ['mssql', 'ms sql', 'microsoft sql server', 'tsql'] },
  { canonical: 'dynamodb', category: 'Bazy danych', altLabels: ['dynamo db', 'aws dynamodb'] },
  { canonical: 'clickhouse', category: 'Bazy danych', altLabels: ['click house'] },
  { canonical: 'neo4j', category: 'Bazy danych', altLabels: ['baza grafowa', 'graph database'] },

  // --- Chmura ---------------------------------------------------------------
  { canonical: 'aws', category: 'Chmura', altLabels: ['amazon web services', 'chmura amazona', 'amazon aws'] },
  { canonical: 'azure', category: 'Chmura', altLabels: ['microsoft azure', 'chmura microsoftu', 'ms azure'] },
  { canonical: 'gcp', category: 'Chmura', altLabels: ['google cloud', 'google cloud platform', 'chmura google'] },
  {
    canonical: 'kubernetes',
    category: 'Chmura',
    altLabels: ['k8s', 'k8', 'kube', 'orkiestracja kontenerów', 'kubernetesy', 'klaster kubernetes'],
  },
  {
    canonical: 'docker',
    category: 'Chmura',
    altLabels: ['konteneryzacja dockerowa', 'konteneryzacja', 'kontenery docker', 'dokier', 'docker engine'],
  },
  { canonical: 'terraform', category: 'Chmura', altLabels: ['iac', 'infrastructure as code', 'infrastruktura jako kod'] },
  { canonical: 'ansible', category: 'Chmura', altLabels: ['ansible playbook', 'automatyzacja ansible'] },
  { canonical: 'openshift', category: 'Chmura', altLabels: ['red hat openshift', 'ocp'] },
  { canonical: 'helm', category: 'Chmura', altLabels: ['helm chart', 'charty helm'] },
  { canonical: 'serverless', category: 'Chmura', altLabels: ['aws lambda', 'lambda', 'bezserwerowy'] },

  // --- DevOps i infrastruktura ---------------------------------------------
  { canonical: 'jenkins', category: 'DevOps', altLabels: ['jenkins ci', 'hudson'] },
  { canonical: 'gitlab', category: 'DevOps', altLabels: ['gitlab ci', 'gitlab-ci'] },
  { canonical: 'github actions', category: 'DevOps', altLabels: ['gh actions', 'github workflow'] },
  { canonical: 'ci/cd', category: 'DevOps', altLabels: ['cicd', 'ciągła integracja', 'continuous integration', 'ciągłe wdrażanie'] },
  { canonical: 'git', category: 'DevOps', altLabels: ['kontrola wersji', 'system kontroli wersji', 'vcs'] },
  { canonical: 'prometheus', category: 'DevOps', altLabels: ['monitoring prometheus'] },
  { canonical: 'grafana', category: 'DevOps', altLabels: ['dashboardy grafana'] },
  { canonical: 'kafka', category: 'DevOps', altLabels: ['apache kafka', 'kolejka kafka'] },
  { canonical: 'rabbitmq', category: 'DevOps', altLabels: ['rabbit mq', 'kolejka komunikatów'] },
  { canonical: 'nginx', category: 'DevOps', altLabels: ['engine x', 'reverse proxy'] },
  { canonical: 'linux', category: 'DevOps', altLabels: ['ubuntu', 'debian', 'rhel', 'administracja linux'] },
  { canonical: 'observability', category: 'DevOps', altLabels: ['obserwowalność', 'monitoring', 'opentelemetry'] },

  // --- Dane i AI ------------------------------------------------------------
  { canonical: 'uczenie maszynowe', category: 'Dane i AI', altLabels: ['machine learning', 'ml', 'modele ml'] },
  { canonical: 'tensorflow', category: 'Dane i AI', altLabels: ['tf', 'keras'] },
  { canonical: 'pytorch', category: 'Dane i AI', altLabels: ['torch', 'py torch'] },
  { canonical: 'pandas', category: 'Dane i AI', altLabels: ['pandas python', 'dataframe'] },
  { canonical: 'numpy', category: 'Dane i AI', altLabels: ['num py'] },
  { canonical: 'spark', category: 'Dane i AI', altLabels: ['apache spark', 'pyspark'] },
  { canonical: 'airflow', category: 'Dane i AI', altLabels: ['apache airflow', 'orkiestracja zadań'] },
  { canonical: 'power bi', category: 'Dane i AI', altLabels: ['powerbi', 'microsoft power bi'] },
  { canonical: 'tableau', category: 'Dane i AI', altLabels: ['wizualizacja danych tableau'] },
  { canonical: 'etl', category: 'Dane i AI', altLabels: ['hurtownia danych', 'data warehouse', 'przetwarzanie danych'] },

  // --- Metodyki i praktyki --------------------------------------------------
  { canonical: 'scrum', category: 'Metodyki', altLabels: ['scrum master', 'sprinty', 'metodyka scrum'] },
  { canonical: 'agile', category: 'Metodyki', altLabels: ['zwinne metodyki', 'metodyki zwinne', 'zwinne wytwarzanie'] },
  { canonical: 'kanban', category: 'Metodyki', altLabels: ['tablica kanban'] },
  { canonical: 'jira', category: 'Metodyki', altLabels: ['atlassian jira', 'confluence'] },
  { canonical: 'devops', category: 'Metodyki', altLabels: ['dev-ops', 'kultura devops', 'sre'] },
  { canonical: 'tdd', category: 'Metodyki', altLabels: ['test driven development', 'programowanie sterowane testami'] },
  { canonical: 'code review', category: 'Metodyki', altLabels: ['przegląd kodu', 'review kodu', 'recenzja kodu'] },
  {
    // Nazwa bazowa w liczbie pojedynczej: forma „mikroserwisy” to mianownik l.mn.
    // rzeczownika „mikroserwis”, więc jako lemat kolidowałaby ze słownikiem.
    canonical: 'mikroserwis',
    category: 'Metodyki',
    altLabels: ['microservices', 'mikroserwisy', 'architektura mikroserwisowa', 'mikrousługi'],
  },
  { canonical: 'rest api', category: 'Metodyki', altLabels: ['api rest', 'restful', 'usługi rest'] },
  { canonical: 'ux', category: 'Metodyki', altLabels: ['user experience', 'doświadczenie użytkownika', 'ui/ux'] },

  // --- Bezpieczeństwo -------------------------------------------------------
  { canonical: 'owasp', category: 'Bezpieczeństwo', altLabels: ['owasp top 10', 'bezpieczeństwo aplikacji'] },
  { canonical: 'oauth', category: 'Bezpieczeństwo', altLabels: ['oauth2', 'openid connect', 'sso'] },
  { canonical: 'jwt', category: 'Bezpieczeństwo', altLabels: ['json web token', 'tokeny jwt'] },
  { canonical: 'tls', category: 'Bezpieczeństwo', altLabels: ['ssl', 'certyfikaty ssl', 'https'] },
  { canonical: 'testy penetracyjne', category: 'Bezpieczeństwo', altLabels: ['pentesty', 'penetration testing', 'pentest'] },
  { canonical: 'iso 27001', category: 'Bezpieczeństwo', altLabels: ['iso27001', 'system zarządzania bezpieczeństwem informacji'] },
  { canonical: 'rodo', category: 'Bezpieczeństwo', altLabels: ['gdpr', 'ochrona danych osobowych'] },
];

/**
 * Kompetencje opisywane czasownikami akcji — odpowiednik grupy „umiejętności
 * przekrojowych” w ESCO. Etykiety alternatywne obejmują warianty składniowe,
 * których kandydaci używają w CV.
 */
export const ACTION_SKILLS: SkillSeed[] = [
  {
    canonical: 'zarządzanie zespołem',
    category: 'Kompetencje',
    altLabels: ['kierowanie zespołem', 'zarządzanie ludźmi', 'team leadership', 'people management', 'prowadzenie zespołu'],
  },
  {
    canonical: 'zarządzanie projektami',
    category: 'Kompetencje',
    altLabels: ['project management', 'prowadzenie projektów', 'kierowanie projektami', 'pm'],
  },
  {
    canonical: 'wdrażanie systemów',
    category: 'Kompetencje',
    altLabels: ['wdrożenia produkcyjne', 'deployment', 'deploy', 'uruchamianie systemów', 'wdrożenie systemu'],
  },
  {
    canonical: 'projektowanie architektury',
    category: 'Kompetencje',
    altLabels: ['architektura systemów', 'software architecture', 'projektowanie systemów'],
  },
  {
    canonical: 'optymalizacja wydajności',
    category: 'Kompetencje',
    altLabels: ['performance tuning', 'strojenie wydajności', 'przyspieszanie aplikacji'],
  },
  {
    canonical: 'automatyzacja procesów',
    category: 'Kompetencje',
    altLabels: ['process automation', 'automatyzacja pracy', 'rpa'],
  },
  {
    canonical: 'analiza danych',
    category: 'Kompetencje',
    altLabels: ['data analysis', 'analityka danych', 'raportowanie danych'],
  },
  {
    canonical: 'testowanie oprogramowania',
    category: 'Kompetencje',
    altLabels: ['qa', 'quality assurance', 'zapewnienie jakości', 'testy automatyczne'],
  },
  {
    canonical: 'utrzymanie infrastruktury',
    category: 'Kompetencje',
    altLabels: ['administracja serwerami', 'utrzymanie systemów', 'infrastructure maintenance'],
  },
  {
    canonical: 'migracja systemów',
    category: 'Kompetencje',
    altLabels: ['migracja do chmury', 'cloud migration', 'przenoszenie systemów'],
  },
  {
    canonical: 'szkolenie pracowników',
    category: 'Kompetencje',
    altLabels: ['prowadzenie szkoleń', 'mentoring', 'onboarding zespołu'],
  },
  {
    canonical: 'negocjacje handlowe',
    category: 'Kompetencje',
    altLabels: ['negocjowanie kontraktów', 'negotiation', 'prowadzenie negocjacji'],
  },
  {
    canonical: 'obsługa klienta',
    category: 'Kompetencje',
    altLabels: ['customer service', 'wsparcie klienta', 'kontakt z klientem'],
  },
  {
    canonical: 'zarządzanie budżetem',
    category: 'Kompetencje',
    altLabels: ['budget management', 'kontrola kosztów', 'planowanie budżetu'],
  },
  {
    canonical: 'dokumentacja techniczna',
    category: 'Kompetencje',
    altLabels: ['technical writing', 'tworzenie dokumentacji', 'opisywanie procesów'],
  },
  {
    canonical: 'diagnostyka usterek',
    category: 'Kompetencje',
    altLabels: ['diagnozowanie awarii', 'troubleshooting', 'usuwanie usterek', 'naprawa usterek'],
  },
  {
    canonical: 'serwis urządzeń',
    category: 'Kompetencje',
    altLabels: ['serwisowanie urządzeń', 'obsługa serwisowa', 'konserwacja urządzeń'],
  },
  {
    canonical: 'montaż instalacji',
    category: 'Kompetencje',
    altLabels: ['montowanie instalacji', 'instalacja urządzeń', 'prace montażowe'],
  },
  {
    canonical: 'spawanie',
    category: 'Kompetencje',
    altLabels: ['prace spawalnicze', 'spawanie tig', 'spawanie mag', 'welding'],
  },
  {
    canonical: 'raportowanie wyników',
    category: 'Kompetencje',
    altLabels: ['przygotowywanie raportów', 'reporting', 'sprawozdawczość'],
  },
  // --- Prace fizyczne i techniczne (reguła 8: monter, spawacz i magazynier
  // obok programisty) ---------------------------------------------------------
  {
    canonical: 'spawanie tig',
    category: 'Kompetencje',
    altLabels: ['spawanie metodą tig', 'tig 141', 'spawanie nietopliwą elektrodą', 'tig welding'],
  },
  {
    canonical: 'spawanie mag',
    category: 'Kompetencje',
    altLabels: ['spawanie metodą mag', 'mag 135', 'spawanie mig', 'migomat', 'mag welding'],
  },
  {
    canonical: 'obsługa obrabiarek cnc',
    category: 'Kompetencje',
    altLabels: ['operator cnc', 'obróbka skrawaniem', 'toczenie i frezowanie', 'programowanie cnc', 'cnc'],
  },
  {
    canonical: 'instalacje elektryczne',
    category: 'Kompetencje',
    altLabels: ['instalacja elektryczna', 'elektryka budowlana', 'pomiary elektryczne', 'rozdzielnice elektryczne', 'uprawnienia sep'],
  },
  {
    canonical: 'instalacje sanitarne',
    category: 'Kompetencje',
    altLabels: ['instalacja sanitarna', 'hydraulika siłowa', 'wod-kan', 'co i cwu', 'montaż kotłów'],
  },
  {
    canonical: 'diagnostyka pojazdów',
    category: 'Kompetencje',
    altLabels: ['diagnostyka komputerowa', 'obd2', 'komputer diagnostyczny', 'elektromechanika pojazdowa'],
  },
  {
    canonical: 'gospodarka magazynowa',
    category: 'Kompetencje',
    altLabels: ['magazynowanie', 'kompletacja zamówień', 'inwentaryzacja', 'obsługa wózka widłowego', 'wms'],
  },
  {
    canonical: 'księgowość',
    category: 'Kompetencje',
    altLabels: ['pełna księgowość', 'księgowanie', 'rozliczenia podatkowe', 'kadry i płace', 'bookkeeping'],
  },
];

/** Pełna lista wpisów tezaurusa offline. */
export const OFFLINE_SKILL_SEEDS: SkillSeed[] = [...TECHNOLOGY_SKILLS, ...ACTION_SKILLS];

/** Nazwy technologii przekazywane do generatora morfologii (odmiana polska). */
export function technologyLemmas(): string[] {
  return TECHNOLOGY_SKILLS.map((s) => s.canonical);
}

/** Spłaszcza tezaurus do wierszy tabeli `skill_synonyms`. */
export function buildOfflineSkillThesaurus(): SkillSynonym[] {
  const rows: SkillSynonym[] = [];

  for (const seed of OFFLINE_SKILL_SEEDS) {
    const canonicalName = seed.canonical.toLowerCase().trim();
    // Wiersz tożsamościowy: nazwa bazowa jest też swoją własną etykietą, dzięki
    // czemu wyszukanie kanonicznego terminu nie wymaga osobnej ścieżki kodu.
    rows.push({ canonicalName, altLabel: canonicalName, category: seed.category });

    for (const alt of seed.altLabels) {
      const altLabel = alt.toLowerCase().trim();
      if (!altLabel || altLabel === canonicalName) continue;
      rows.push({ canonicalName, altLabel, category: seed.category });
    }
  }

  return rows;
}
