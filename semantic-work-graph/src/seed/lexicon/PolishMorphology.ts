import { MorphEntry } from '../../repositories/SqliteGraphRepository.js';

/**
 * Generator kuratorowanego korpusu morfologicznego języka polskiego.
 *
 * Pełny słownik pochodzi z PoliMorf (IPI PAN). Ten moduł pełni dwie role:
 *  1. **Awaryjne źródło offline** — gdy pobranie PoliMorf jest niemożliwe
 *     (brak sieci, zmiana adresu wydania), lematyzacja nadal działa dla
 *     słownictwa krytycznego dla CV: czasowników akcji i rzeczowników IT.
 *  2. **Warstwa dziedzinowa** — PoliMorf nie zna słów typu „mikroserwis”,
 *     „konteneryzacja” czy „backend”. Te wpisy dokładamy zawsze, niezależnie
 *     od tego, czy korpus ogólny udało się pobrać.
 *
 * Formy generujemy deklaratywnie z tabel wzorców. Każdy wzorzec pokrywa
 * regularny paradygmat; nieregularności podajemy jawnie w `extraForms`,
 * zamiast rozbudowywać reguły o wyjątki, których i tak nie da się domknąć.
 */

/** Części mowy dopuszczone w słowniku (zgodne z filtrem importu PoliMorf). */
export type PosTag = 'subst' | 'verb' | 'fin' | 'praet' | 'ger' | 'adj';

/** Priorytet rozstrzygania kolizji form wewnątrz korpusu kuratorowanego. */
const POS_RANK: Record<PosTag, number> = { ger: 0, subst: 1, praet: 2, fin: 3, verb: 4, adj: 5 };

// ---------------------------------------------------------------------------
// Czasowniki
// ---------------------------------------------------------------------------

interface VerbSpec {
  /** Bezokolicznik = lemat. */
  lemma: string;
  /** Rzeczownik odczasownikowy, jeśli reguła sufiksowa daje zły wynik. */
  gerund?: string | null;
  /** Formy nieregularne dopisywane wprost (forma -> tag). */
  extraForms?: Array<[string, PosTag]>;
  /** Wyłącza generowanie form osobowych (dla czasowników o nieregularnej koniugacji). */
  skipFinite?: boolean;
  /**
   * Wyłącza generowanie czasu przeszłego regułą (temat = lemat bez „ć").
   * Dla czasowników z obocznością ą→ę w temacie („ciąć" → „cięła", „dociąć" →
   * „docięłam") reguła dałaby nieistniejące „ciąła" — pełny paradygmat podajemy
   * wtedy w `extraForms`, a generator ma nie dokładać swoich.
   */
  skipPraeteritum?: boolean;
  /**
   * Jawne przestawienie paradygmatu czasu teraźniejszego. Klasy wykrywamy
   * sufiksem, ale „-awać" jest dwuznaczne: „spawać" ma temat „spaw-" (spawam),
   * a „wydawać" temat „wydaj-" (wydaję). Automat zostawia wariant „-aw-",
   * a lematy z tematem „-aj-" oznaczamy wprost — pomyłka w drugą stronę
   * (generowanie „spaję") byłaby gorsza niż brak formy.
   */
  finiteOverride?: 'aj';
}

type VerbClass = 'owac' | 'ywac' | 'ac' | 'ic' | 'yc' | 'jac' | 'other';

function classifyVerb(lemma: string): VerbClass {
  if (lemma.endsWith('ować')) return 'owac';
  if (lemma.endsWith('ywać') || lemma.endsWith('iwać')) return 'ywac';
  // -jąć ma własny paradygmat (przyjmę, nie „przyjmam") i własny rzeczownik
  // (przyjęcie, nie „przyjanie") — sprawdzamy przed regułą ogólną.
  if (lemma.endsWith('jąć')) return 'jac';
  if (lemma.endsWith('ać')) return 'ac';
  if (lemma.endsWith('ić')) return 'ic';
  if (lemma.endsWith('yć')) return 'yc';
  return 'other';
}

/**
 * Temat 1 os. lp i 3 os. lm czasowników na -ić.
 *
 * Końcówka „-ię" z reguły naiwnej („szkolię", „prosię", „prowadzią") jest
 * poprawna tylko po spółgłoskach wargowych i „n": mówię, robię, kupię, trafię,
 * bronię, uruchomię. Po pozostałych „i" wypada, a wygłos mięknie: szkolę,
 * proszę, wożę, płacę, prowadzę, puszczę, jeżdżę. Temat na samogłoskę
 * („zbroić") dostaje wstawione „j": zbroję, zbrojenie.
 */
function softenIcStem(stem: string): { base: string; withI: boolean } {
  if (/[aeiouyąęó]$/.test(stem)) return { base: `${stem}j`, withI: false };
  if (/(m|w|p|b|f|n)$/.test(stem)) return { base: stem, withI: true };
  let base = stem;
  if (base.endsWith('st')) base = `${base.slice(0, -2)}szcz`;
  else if (base.endsWith('zd')) base = `${base.slice(0, -2)}żdż`;
  // Kolejność ma znaczenie: „prowadz" kończy się na „dz", nie na samo „z".
  else if (base.endsWith('dz')) base = base;
  else if (base.endsWith('s')) base = `${base.slice(0, -1)}sz`;
  else if (base.endsWith('z')) base = `${base.slice(0, -1)}ż`;
  else if (base.endsWith('t')) base = `${base.slice(0, -1)}c`;
  else if (base.endsWith('d')) base = `${base.slice(0, -1)}dz`;
  return { base, withI: false };
}

/**
 * Rzeczownik odczasownikowy: „zarządzać” → „zarządzanie”, „wdrożyć” → „wdrożenie”,
 * „uruchomić” → „uruchomienie”, „przyjąć” → „przyjęcie”.
 */
function deriveGerund(lemma: string, cls: VerbClass): string | null {
  switch (cls) {
    case 'owac':
    case 'ywac':
    case 'ac':
      return `${lemma.slice(0, -1)}nie`;
    case 'ic': {
      // „prowadzić" → „prowadzenie" (nie „prowadzienie"), „prosić" →
      // „proszenie", „szkolić" → „szkolenie" — ten sam temat co w 1 os. lp.
      const stem = lemma.slice(0, -2);
      const { base, withI } = softenIcStem(stem);
      return `${base}${withI ? 'ienie' : 'enie'}`;
    }
    case 'jac':
      return `${lemma.slice(0, -3)}jęcie`;
    case 'yc':
      return `${lemma.slice(0, -2)}enie`;
    default:
      return null;
  }
}

/** Czas przeszły — wspólny dla wszystkich klas regularnych: temat = lemat bez „ć”. */
function derivePraeteritum(lemma: string): string[] {
  const base = lemma.slice(0, -1);
  return [
    `${base}łem`,
    `${base}łam`,
    `${base}łeś`,
    `${base}łaś`,
    `${base}ł`,
    `${base}ła`,
    `${base}ło`,
    `${base}li`,
    `${base}ły`,
    `${base}liśmy`,
    `${base}łyśmy`,
    `${base}liście`,
    `${base}łyście`,
  ];
}

/** Formy osobowe czasu teraźniejszego/przyszłego prostego. */
function deriveFinite(lemma: string, cls: VerbClass, finiteOverride?: 'aj'): string[] {
  if (finiteOverride === 'aj') {
    // „wydawać" → „wydaję" (nie „wydawam"): temat na -aj-, reszta jak klasa -ać.
    const stem = `${lemma.slice(0, -4)}aj`;
    return ['ę', 'esz', 'e', 'emy', 'ecie', 'ą'].map((s) => stem + s);
  }
  switch (cls) {
    case 'owac':
    case 'ywac': {
      // -ować / -ywać / -iwać dają ten sam paradygmat -uję:
      // programować -> programuję, utrzymywać -> utrzymuję, obsługiwać -> obsługuję.
      const stem = lemma.slice(0, -4);
      return ['uję', 'ujesz', 'uje', 'ujemy', 'ujecie', 'ują'].map((s) => stem + s);
    }
    case 'ac': {
      const stem = lemma.slice(0, -2); // zarządzać -> zarządz
      return ['am', 'asz', 'a', 'amy', 'acie', 'ają'].map((s) => stem + s);
    }
    case 'jac': {
      const stem = `${lemma.slice(0, -3)}jm`; // przyjąć -> przyjm
      return ['ę', 'iesz', 'ie', 'iemy', 'iecie', 'ą'].map((s) => stem + s);
    }
    case 'ic': {
      // „szkolić" → „szkolę" (nie „szkolię"), „prowadzić" → „prowadzą"
      // (nie „prowadzią") — 2 os. i 1/2 os. lm biorą końcówki wprost z tematu.
      const stem = lemma.slice(0, -2); // uruchomić -> uruchom
      const { base, withI } = softenIcStem(stem);
      const eOrIe = withI ? 'ię' : 'ę';
      const aOrIa = withI ? 'ią' : 'ą';
      return [`${base}${eOrIe}`, `${stem}isz`, `${stem}i`, `${stem}imy`, `${stem}icie`, `${base}${aOrIa}`];
    }
    case 'yc': {
      const stem = lemma.slice(0, -2); // wdrożyć -> wdroż
      return ['ę', 'ysz', 'y', 'ymy', 'ycie', 'ą'].map((s) => stem + s);
    }
    default:
      return [];
  }
}

/** Odmiana rzeczownika odczasownikowego rodzaju nijakiego („wdrożenie”). */
function declineGerund(gerund: string): string[] {
  if (!gerund.endsWith('e')) return [gerund];
  const stem = gerund.slice(0, -1); // wdrożenie -> wdrożeni
  const forms = [
    gerund,
    `${stem}a`,
    `${stem}u`,
    `${stem}em`,
    `${stem}om`,
    `${stem}ami`,
    `${stem}ach`,
  ];

  // Dopełniacz l.mn. zmiękcza wygłos tematu:
  // wdrożenie -> wdrożeń, osiągnięcie -> osiągnięć, narzędzie -> narzędzi.
  if (gerund.endsWith('nie')) forms.push(`${gerund.slice(0, -3)}ń`);
  else if (gerund.endsWith('cie')) forms.push(`${gerund.slice(0, -3)}ć`);
  else forms.push(stem);

  return forms;
}

/**
 * Czasowniki akcji spotykane w polskich CV. Lista celowo obejmuje pary aspektowe
 * (np. „wdrażać” / „wdrożyć”), bo kandydaci używają obu wymiennie.
 */
export const ACTION_VERBS: VerbSpec[] = [
  { lemma: 'zarządzać' },
  { lemma: 'kierować' },
  { lemma: 'nadzorować' },
  { lemma: 'koordynować' },
  { lemma: 'planować' },
  { lemma: 'organizować' },
  { lemma: 'delegować' },
  { lemma: 'motywować' },
  { lemma: 'rekrutować' },
  { lemma: 'szkolić' },
  { lemma: 'mentorować' },
  { lemma: 'prowadzić' },
  { lemma: 'wdrażać' },
  { lemma: 'wdrożyć' },
  { lemma: 'implementować' },
  { lemma: 'zaimplementować' },
  { lemma: 'programować' },
  { lemma: 'oprogramować' },
  { lemma: 'projektować' },
  { lemma: 'zaprojektować' },
  { lemma: 'tworzyć' },
  { lemma: 'stworzyć' },
  { lemma: 'budować' },
  { lemma: 'zbudować' },
  { lemma: 'rozwijać' },
  { lemma: 'utrzymywać' },
  { lemma: 'obsługiwać' },
  { lemma: 'testować' },
  { lemma: 'przetestować' },
  { lemma: 'weryfikować' },
  { lemma: 'walidować' },
  { lemma: 'analizować' },
  { lemma: 'przeanalizować' },
  { lemma: 'optymalizować' },
  { lemma: 'zoptymalizować' },
  { lemma: 'automatyzować' },
  { lemma: 'zautomatyzować' },
  { lemma: 'integrować' },
  { lemma: 'zintegrować' },
  { lemma: 'konfigurować' },
  { lemma: 'skonfigurować' },
  { lemma: 'instalować' },
  { lemma: 'zainstalować' },
  { lemma: 'migrować' },
  { lemma: 'zmigrować' },
  { lemma: 'skalować' },
  { lemma: 'monitorować' },
  { lemma: 'refaktoryzować' },
  { lemma: 'debugować' },
  { lemma: 'dokumentować' },
  { lemma: 'udokumentować' },
  { lemma: 'raportować' },
  { lemma: 'prezentować' },
  { lemma: 'negocjować' },
  { lemma: 'konsultować' },
  { lemma: 'doradzać' },
  { lemma: 'audytować' },
  { lemma: 'kontrolować' },
  { lemma: 'certyfikować' },
  { lemma: 'standaryzować' },
  { lemma: 'modernizować' },
  { lemma: 'archiwizować' },
  { lemma: 'wizualizować' },
  { lemma: 'modelować' },
  { lemma: 'realizować' },
  { lemma: 'zrealizować' },
  { lemma: 'opracowywać' },
  { lemma: 'opracować' },
  { lemma: 'wykonywać' },
  { lemma: 'przeprowadzać' },
  { lemma: 'przeprowadzić' },
  { lemma: 'usprawnić' },
  { lemma: 'usprawniać' },
  { lemma: 'poprawić' },
  { lemma: 'poprawiać' },
  { lemma: 'przyspieszyć' },
  { lemma: 'zwiększyć' },
  { lemma: 'zwiększać' },
  { lemma: 'zmniejszyć' },
  { lemma: 'obniżyć' },
  { lemma: 'redukować' },
  { lemma: 'zredukować' },
  { lemma: 'uruchomić' },
  { lemma: 'uruchamiać' },
  { lemma: 'serwisować' },
  { lemma: 'montować' },
  { lemma: 'zamontować' },
  { lemma: 'naprawiać' },
  { lemma: 'naprawić' },
  { lemma: 'diagnozować' },
  { lemma: 'spawać' },
  { lemma: 'współpracować' },
  { lemma: 'wspierać' },
  { lemma: 'dostarczać' },
  { lemma: 'dostarczyć' },
  { lemma: 'zapewniać' },
  { lemma: 'zapewnić' },
  { lemma: 'badać' },
  { lemma: 'sterować' },
  {
    // Koniugacja typu -ąć jest nieregularna (ą/ę w temacie), więc podajemy formy wprost.
    lemma: 'osiągnąć',
    gerund: 'osiągnięcie',
    skipFinite: true,
    extraForms: [
      ['osiągnąłem', 'praet'],
      ['osiągnęłam', 'praet'],
      ['osiągnął', 'praet'],
      ['osiągnęła', 'praet'],
      ['osiągnęli', 'praet'],
      ['osiągnęły', 'praet'],
      ['osiągnę', 'fin'],
      ['osiągniesz', 'fin'],
      ['osiągnie', 'fin'],
      ['osiągniemy', 'fin'],
      ['osiągną', 'fin'],
    ],
  },
  {
    lemma: 'osiągać',
  },

  // --- Budownictwo, prace wykończeniowe i remontowe -----------------------
  // Formy 1 os. lp („tynkuję", „muruję") kandydata i rzeczowniki odczasownikowe
  // („tynkowanie") ogłoszenia sprowadzają się do wspólnego bezokolicznika.
  { lemma: 'tynkować' },
  { lemma: 'otynkować' },
  { lemma: 'murować' },
  { lemma: 'wymurować' },
  { lemma: 'szpachlować' },
  { lemma: 'wyszpachlować' },
  { lemma: 'malować' },
  { lemma: 'pomalować' },
  { lemma: 'tapetować' },
  { lemma: 'wytapetować' },
  { lemma: 'gipsować' },
  { lemma: 'zagipsować' },
  { lemma: 'gruntować' },
  { lemma: 'zagruntować' },
  { lemma: 'szlifować' },
  { lemma: 'oszlifować' },
  { lemma: 'poziomować' },
  { lemma: 'wypoziomować' },
  { lemma: 'izolować' },
  { lemma: 'zaizolować' },
  { lemma: 'ocieplać' },
  { lemma: 'ocieplić' },
  { lemma: 'zbroić' },
  { lemma: 'uzbroić' },
  { lemma: 'szalować' },
  { lemma: 'oszalować' },
  { lemma: 'deskować' },
  { lemma: 'odeskować' },
  { lemma: 'kotwić' },
  { lemma: 'zakotwić' },
  { lemma: 'wiercić' },
  { lemma: 'wywiercić' },
  { lemma: 'bruzdować' },
  { lemma: 'wybruzdować' },
  { lemma: 'uszczelniać' },
  { lemma: 'uszczelnić' },
  { lemma: 'fugować' },
  { lemma: 'zafugować' },
  { lemma: 'silikonować' },
  { lemma: 'zasilikonować' },
  { lemma: 'układać' },
  { lemma: 'ułożyć' },
  { lemma: 'wylewać' },
  { lemma: 'wylać' },
  { lemma: 'zacierać' },
  { lemma: 'piaskować' },
  { lemma: 'spiaskować' },
  { lemma: 'zgrzewać' },
  { lemma: 'zgrzać' },
  { lemma: 'kleić' },
  { lemma: 'skleić' },
  { lemma: 'skuwać' },
  { lemma: 'spoinować' },
  { lemma: 'zasypywać' },
  { lemma: 'zasypać' },
  { lemma: 'zagęszczać' },
  { lemma: 'zagęścić' },
  { lemma: 'korytować' },
  { lemma: 'niwelować' },
  { lemma: 'betonować' },
  { lemma: 'wybetonować' },
  { lemma: 'brukować' },
  { lemma: 'wybrukować' },
  { lemma: 'demontować' },
  { lemma: 'zdemontować' },

  // --- Instalacje elektryczne, sanitarne, HVAC i chłodnictwo ---------------
  { lemma: 'podłączać' },
  { lemma: 'podłączyć' },
  { lemma: 'odłączać' },
  { lemma: 'odłączyć' },
  { lemma: 'rozprowadzać' },
  { lemma: 'rozprowadzić' },
  { lemma: 'lutować' },
  { lemma: 'przylutować' },
  { lemma: 'zlutować' },
  { lemma: 'gwintować' },
  { lemma: 'nagwintować' },
  { lemma: 'odpowietrzać' },
  { lemma: 'odpowietrzyć' },
  { lemma: 'napełniać' },
  { lemma: 'napełnić' },
  { lemma: 'płukać' },
  { lemma: 'wypłukać' },
  { lemma: 'plombować' },
  { lemma: 'zaplombować' },
  { lemma: 'kalibrować' },
  { lemma: 'skalibrować' },
  { lemma: 'nastawiać' },
  { lemma: 'nastawić' },
  { lemma: 'regulować' },
  { lemma: 'wyregulować' },
  { lemma: 'mostkować' },
  { lemma: 'zmostkować' },
  { lemma: 'zaciskać' },
  { lemma: 'zacisnąć' },
  { lemma: 'mierzyć' },
  { lemma: 'zmierzyć' },
  { lemma: 'pomierzyć' },
  { lemma: 'resetować' },
  { lemma: 'zresetować' },
  { lemma: 'chłodzić' },
  { lemma: 'nagrzewać' },
  { lemma: 'nagrzać' },
  { lemma: 'wymieniać' },
  { lemma: 'wymienić' },
  { lemma: 'regenerować' },
  { lemma: 'zregenerować' },
  { lemma: 'konserwować' },
  { lemma: 'zakonserwować' },
  { lemma: 'czyścić' },
  { lemma: 'wyczyścić' },
  { lemma: 'odtłuszczać' },
  { lemma: 'odtłuścić' },
  { lemma: 'udrażniać' },
  { lemma: 'udrożnić' },
  { lemma: 'próbkować' },
  { lemma: 'przezwajać' },

  // --- Mechanika, obróbka skrawaniem, CNC i spawalnictwo -------------------
  { lemma: 'toczyć' },
  { lemma: 'wytoczyć' },
  { lemma: 'frezować' },
  { lemma: 'wyfrezować' },
  { lemma: 'przycinać' },
  {
    // Jak „ciąć": teraźniejszy od tematu „gn-" (gnę), przeszły z ą/ę (giąłem,
    // gięła) — wprost, bo reguła dałaby „giłem".
    lemma: 'giąć',
    gerund: 'gięcie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['giąłem', 'praet'],
      ['gięłam', 'praet'],
      ['giąłeś', 'praet'],
      ['gięłaś', 'praet'],
      ['giął', 'praet'],
      ['gięła', 'praet'],
      ['gięło', 'praet'],
      ['gięli', 'praet'],
      ['gięły', 'praet'],
      ['gięliśmy', 'praet'],
      ['gięłyśmy', 'praet'],
      ['gięliście', 'praet'],
      ['gięłyście', 'praet'],
      ['gnę', 'fin'],
      ['gniesz', 'fin'],
      ['gnie', 'fin'],
      ['gniemy', 'fin'],
      ['gniecie', 'fin'],
      ['gną', 'fin'],
    ],
  },
  {
    lemma: 'wygiąć',
    gerund: 'wygięcie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['wygiąłem', 'praet'],
      ['wygięłam', 'praet'],
      ['wygiąłeś', 'praet'],
      ['wygięłaś', 'praet'],
      ['wygiął', 'praet'],
      ['wygięła', 'praet'],
      ['wygięło', 'praet'],
      ['wygięli', 'praet'],
      ['wygięły', 'praet'],
      ['wygięliśmy', 'praet'],
      ['wygięłyśmy', 'praet'],
      ['wygięliście', 'praet'],
      ['wygięłyście', 'praet'],
      ['wygnę', 'fin'],
      ['wygniesz', 'fin'],
      ['wygnie', 'fin'],
      ['wygniemy', 'fin'],
      ['wygniecie', 'fin'],
      ['wygną', 'fin'],
    ],
  },
  { lemma: 'tłoczyć' },
  { lemma: 'wytłoczyć' },
  { lemma: 'prasować' },
  { lemma: 'zaprasować' },
  { lemma: 'hartować' },
  { lemma: 'zahartować' },
  { lemma: 'odpuszczać' },
  { lemma: 'polerować' },
  { lemma: 'wypolerować' },
  { lemma: 'nitować' },
  { lemma: 'znitować' },
  { lemma: 'dokręcać' },
  { lemma: 'dokręcić' },
  { lemma: 'skręcać' },
  { lemma: 'skręcić' },
  { lemma: 'smarować' },
  { lemma: 'nasmarować' },
  { lemma: 'oliwić' },
  { lemma: 'naoliwić' },
  { lemma: 'wyważać' },
  { lemma: 'wyważyć' },
  { lemma: 'centrować' },
  { lemma: 'wycentrować' },
  { lemma: 'lakierować' },
  { lemma: 'polakierować' },
  { lemma: 'cynkować' },
  { lemma: 'ocynkować' },
  { lemma: 'wytrawiać' },
  { lemma: 'wytrawić' },
  { lemma: 'nawiercać' },
  { lemma: 'nawiercić' },
  { lemma: 'rozwiercać' },
  { lemma: 'rozwiercić' },
  { lemma: 'fazować' },
  { lemma: 'sfazować' },
  { lemma: 'ostrzyć' },
  { lemma: 'naostrzyć' },
  { lemma: 'czopować' },
  { lemma: 'dłutować' },
  { lemma: 'strugać' },
  { lemma: 'heblować' },

  // --- Magazyn, logistyka, transport i spedycja ---------------------------
  { lemma: 'magazynować' },
  { lemma: 'zamagazynować' },
  { lemma: 'składować' },
  { lemma: 'zaskładować' },
  { lemma: 'kompletować' },
  { lemma: 'skompletować' },
  { lemma: 'sortować' },
  { lemma: 'posortować' },
  { lemma: 'pakować' },
  { lemma: 'spakować' },
  { lemma: 'rozpakowywać' },
  { lemma: 'rozpakować' },
  { lemma: 'foliować' },
  { lemma: 'zafoliować' },
  { lemma: 'paletyzować' },
  { lemma: 'spaletyzować' },
  { lemma: 'etykietować' },
  { lemma: 'zaetykietować' },
  { lemma: 'znakować' },
  { lemma: 'oznakować' },
  { lemma: 'oznaczać' },
  { lemma: 'oznaczyć' },
  { lemma: 'załadowywać' },
  { lemma: 'załadować' },
  { lemma: 'rozładowywać' },
  { lemma: 'rozładować' },
  { lemma: 'przeładowywać' },
  { lemma: 'przeładować' },
  { lemma: 'przewozić' },
  { lemma: 'wozić' },
  {
    // „przewieźć" ma temat „przywioz-"/„przewiez-" zależnie od osoby, więc obie
    // serie podajemy wprost — reguła sufiksowa dałaby „przewieźłem".
    lemma: 'przewieźć',
    gerund: 'przewiezienie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['przewiozłem', 'praet'],
      ['przewiozłam', 'praet'],
      ['przewiozłeś', 'praet'],
      ['przewiozłaś', 'praet'],
      ['przewiózł', 'praet'],
      ['przewiozła', 'praet'],
      ['przewiozło', 'praet'],
      ['przewieźli', 'praet'],
      ['przewiozły', 'praet'],
      ['przewieźliśmy', 'praet'],
      ['przewiozłyśmy', 'praet'],
      ['przewieźliście', 'praet'],
      ['przewiozłyście', 'praet'],
      ['przewiozę', 'fin'],
      ['przewieziesz', 'fin'],
      ['przewiezie', 'fin'],
      ['przewieziemy', 'fin'],
      ['przewieziecie', 'fin'],
      ['przewiozą', 'fin'],
    ],
  },
  { lemma: 'transportować' },
  { lemma: 'przetransportować' },
  { lemma: 'dysponować' },
  { lemma: 'zadysponować' },
  { lemma: 'przyjąć' },
  { lemma: 'wydawać', finiteOverride: 'aj' },
  { lemma: 'wydać' },
  { lemma: 'przyjmować' },
  { lemma: 'inwentaryzować' },
  { lemma: 'zinwentaryzować' },
  { lemma: 'skanować' },
  { lemma: 'zeskanować' },
  { lemma: 'ważyć' },
  { lemma: 'zważyć' },
  { lemma: 'przeliczać' },
  { lemma: 'przeliczyć' },
  { lemma: 'rozsyłać' },
  { lemma: 'rozesłać' },
  { lemma: 'pilotować' },
  { lemma: 'nadawać', finiteOverride: 'aj' },
  { lemma: 'sprzedawać', finiteOverride: 'aj' },
  { lemma: 'podawać', finiteOverride: 'aj' },
  { lemma: 'oddawać', finiteOverride: 'aj' },
  { lemma: 'oddać' },

  // --- Medycyna, farmacja, diagnostyka i opieka ---------------------------
  { lemma: 'leczyć' },
  { lemma: 'wyleczyć' },
  { lemma: 'rehabilitować' },
  { lemma: 'zrehabilitować' },
  { lemma: 'pielęgnować' },
  { lemma: 'asystować' },
  { lemma: 'zaasystować' },
  { lemma: 'cewnikować' },
  { lemma: 'intubować' },
  { lemma: 'zaintubować' },
  { lemma: 'reanimować' },
  { lemma: 'zreanimować' },
  { lemma: 'szczepić' },
  { lemma: 'zaszczepić' },
  { lemma: 'pobierać' },
  { lemma: 'pobrać' },
  { lemma: 'dawkować' },
  { lemma: 'zadawkować' },
  { lemma: 'podać' },
  { lemma: 'aplikować' },
  { lemma: 'zaaplikować' },
  { lemma: 'sterylizować' },
  { lemma: 'wysterylizować' },
  { lemma: 'dezynfekować' },
  { lemma: 'zdezynfekować' },
  { lemma: 'opatrywać' },
  { lemma: 'opatrzyć' },
  { lemma: 'bandażować' },
  { lemma: 'zabandażować' },
  { lemma: 'naświetlać' },
  { lemma: 'naświetlić' },
  { lemma: 'masować' },
  { lemma: 'rozmasować' },
  { lemma: 'preparować' },
  { lemma: 'spreparować' },
  { lemma: 'osłuchiwać' },
  { lemma: 'osłuchać' },
  { lemma: 'znieczulać' },
  { lemma: 'znieczulić' },

  // --- Finanse, księgowość, administracja i biuro -------------------------
  { lemma: 'księgować' },
  { lemma: 'zaksięgować' },
  { lemma: 'fakturować' },
  { lemma: 'zafakturować' },
  { lemma: 'bilansować' },
  { lemma: 'zbilansować' },
  { lemma: 'rozliczać' },
  { lemma: 'rozliczyć' },
  { lemma: 'kalkulować' },
  { lemma: 'skalkulować' },
  { lemma: 'wyceniać' },
  { lemma: 'wycenić' },
  { lemma: 'ewidencjonować' },
  { lemma: 'zaewidencjonować' },
  { lemma: 'sporządzać' },
  { lemma: 'sporządzić' },
  { lemma: 'dekretować' },
  { lemma: 'zadekretować' },
  { lemma: 'zatwierdzać' },
  { lemma: 'zatwierdzić' },
  { lemma: 'parafować' },
  {
    // „podpisać" ma temat „podpisz-" w czasie teraźniejszym (podpiszę),
    // nie „podpis-" — przeszły („podpisałem") idzie regułą.
    lemma: 'podpisać',
    skipFinite: true,
    extraForms: [
      ['podpiszę', 'fin'],
      ['podpiszesz', 'fin'],
      ['podpisze', 'fin'],
      ['podpiszemy', 'fin'],
      ['podpiszecie', 'fin'],
      ['podpiszą', 'fin'],
    ],
  },
  { lemma: 'podpisywać' },
  { lemma: 'korespondować' },
  { lemma: 'redagować' },
  { lemma: 'zredagować' },

  // --- IT, oprogramowanie i cyberbezpieczeństwo ---------------------------
  { lemma: 'kodować' },
  { lemma: 'zakodować' },
  { lemma: 'kompilować' },
  { lemma: 'skompilować' },
  { lemma: 'wersjonować' },
  { lemma: 'zwersjonować' },
  { lemma: 'deployować' },
  { lemma: 'zdeployować' },
  { lemma: 'szyfrować' },
  { lemma: 'zaszyfrować' },
  { lemma: 'deszyfrować' },
  { lemma: 'odszyfrować' },
  { lemma: 'autoryzować' },
  { lemma: 'zautoryzować' },
  { lemma: 'uwierzytelniać' },
  { lemma: 'uwierzytelnić' },
  { lemma: 'replikować' },
  { lemma: 'zreplikować' },
  { lemma: 'synchronizować' },
  { lemma: 'zsynchronizować' },
  { lemma: 'backupować' },
  { lemma: 'zbackupować' },
  { lemma: 'profilować' },
  { lemma: 'skryptować' },
  { lemma: 'indeksować' },
  { lemma: 'zaindeksować' },
  { lemma: 'klastrować' },
  { lemma: 'konteneryzować' },
  { lemma: 'orkiestrować' },

  // --- Uzupełnienia pod licznik sprawczości ATS ---------------------------
  // `PERFECTIVE_VERBS` w `src/lib/atsScorer.ts` punktuje 1 os. lp. dokonaną —
  // każda forma stamtąd musi mieć lemat tutaj, inaczej silnik zliczy
  // sprawczość, której słownik grafu nie potwierdzi (reguła 3: jedno źródło).
  { lemma: 'skracać' },
  { lemma: 'skrócić' },
  {
    // „podnieść" ma oboczność eś→ios w czasie przeszłym (podniosłem),
    // więc obie serie idą wprost.
    lemma: 'podnieść',
    gerund: 'podniesienie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['podniosłem', 'praet'],
      ['podniosłam', 'praet'],
      ['podniosłeś', 'praet'],
      ['podniosłaś', 'praet'],
      ['podniósł', 'praet'],
      ['podniosła', 'praet'],
      ['podniosło', 'praet'],
      ['podnieśli', 'praet'],
      ['podniosły', 'praet'],
      ['podnieśliśmy', 'praet'],
      ['podniosłyśmy', 'praet'],
      ['podnieśliście', 'praet'],
      ['podniosłyście', 'praet'],
      ['podniosę', 'fin'],
      ['podniesiesz', 'fin'],
      ['podniesie', 'fin'],
      ['podniesiemy', 'fin'],
      ['podniesiecie', 'fin'],
      ['podniosą', 'fin'],
    ],
  },
  { lemma: 'podnosić' },
  { lemma: 'wystawiać' },
  { lemma: 'wystawić' },
  { lemma: 'przeszkalać' },
  { lemma: 'przeszkolić' },
  { lemma: 'sprawdzać' },
  { lemma: 'sprawdzić' },
  { lemma: 'kończyć' },
  { lemma: 'zakończyć' },
  { lemma: 'zdobywać' },
  {
    // „zdobyć" w czasie teraźniejszym ma temat „zdobęd-" (zdobędę),
    // przeszły idzie regułą (zdobyłem).
    lemma: 'zdobyć',
    skipFinite: true,
    extraForms: [
      ['zdobędę', 'fin'],
      ['zdobędziesz', 'fin'],
      ['zdobędzie', 'fin'],
      ['zdobędziemy', 'fin'],
      ['zdobędziecie', 'fin'],
      ['zdobędą', 'fin'],
    ],
  },
  { lemma: 'ukończyć' },
  { lemma: 'uzyskiwać' },
  { lemma: 'uzyskać' },
  { lemma: 'zabezpieczać' },
  { lemma: 'zabezpieczyć' },
  { lemma: 'odtwarzać' },
  { lemma: 'odtworzyć' },
  { lemma: 'zdiagnozować' },
  { lemma: 'wykonać' },
  { lemma: 'skontrolować' },
  { lemma: 'przyspawać' },
  { lemma: 'ustawiać' },
  { lemma: 'ustawić' },
  { lemma: 'poprowadzić' },
  { lemma: 'zrefaktoryzować' },
  {
    // „ciąć" gubi temat w czasie teraźniejszym (tnę) i miesza ą/ę
    // w przeszłym (ciąłem, cięła) — pełny paradygmat wprost.
    lemma: 'ciąć',
    gerund: 'cięcie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['ciąłem', 'praet'],
      ['ciąłam', 'praet'],
      ['ciąłeś', 'praet'],
      ['ciąłaś', 'praet'],
      ['ciął', 'praet'],
      ['cięła', 'praet'],
      ['cięło', 'praet'],
      ['cięli', 'praet'],
      ['cięły', 'praet'],
      ['cięliśmy', 'praet'],
      ['cięłyśmy', 'praet'],
      ['cięliście', 'praet'],
      ['cięłyście', 'praet'],
      ['tnę', 'fin'],
      ['tniesz', 'fin'],
      ['tnie', 'fin'],
      ['tniemy', 'fin'],
      ['tniecie', 'fin'],
      ['tną', 'fin'],
    ],
  },
  {
    lemma: 'dociąć',
    gerund: 'docięcie',
    skipFinite: true,
    skipPraeteritum: true,
    extraForms: [
      ['docięłem', 'praet'],
      ['docięłam', 'praet'],
      ['docięłeś', 'praet'],
      ['docięłaś', 'praet'],
      ['dociął', 'praet'],
      ['docięła', 'praet'],
      ['docięło', 'praet'],
      ['docięli', 'praet'],
      ['docięły', 'praet'],
      ['docięliśmy', 'praet'],
      ['docięłyśmy', 'praet'],
      ['docięliście', 'praet'],
      ['docięłyście', 'praet'],
      ['dotnę', 'fin'],
      ['dotniesz', 'fin'],
      ['dotnie', 'fin'],
      ['dotniemy', 'fin'],
      ['dotniecie', 'fin'],
      ['dotną', 'fin'],
    ],
  },
];

// ---------------------------------------------------------------------------
// Rzeczowniki
// ---------------------------------------------------------------------------

type NounPattern =
  /** Rodzaj męskorzeczowy twardy: system, projekt, mikroserwis. */
  | 'm3'
  /** Rodzaj męskoosobowy twardy: programista (patrz `m1-a`), klient, inżynier. */
  | 'm1'
  /** Rodzaj męskoosobowy zakończony na -a: programista, specjalista, doradca. */
  | 'm1-a'
  /** Rodzaj żeński twardy: baza, metoda, chmura. */
  | 'f-hard'
  /** Rodzaj żeński miękki: aplikacja, funkcja, wydajność (patrz `f-osc`). */
  | 'f-soft'
  /** Rodzaj żeński na -ość: wydajność, jakość. */
  | 'f-osc'
  /** Rodzaj nijaki twardy: środowisko, źródło. */
  | 'n-hard'
  /** Rodzaj nijaki miękki (także odczasownikowy): rozwiązanie, narzędzie. */
  | 'n-soft';

interface NounSpec {
  lemma: string;
  pattern: NounPattern;
  /** Końcówka dopełniacza l.poj. dla wzorca m3: „-a” (serwera) albo „-u” (systemu). */
  gen?: 'a' | 'u';
  /** Temat przypadków zależnych, gdy zachodzi oboczność (zespół → zespoł-, błąd → błęd-). */
  obliqueStem?: string;
  /** Formy nieregularne dopisywane wprost. */
  extraForms?: string[];
}

/** Miejscownik l.poj. wzorca m3 — zmiękczenie tematu zależne od wygłosu. */
function locativeM3(stem: string): string | null {
  if (/(st)$/.test(stem)) return `${stem.slice(0, -2)}ście`;
  if (/(k|g|ch|c|cz|sz|ż|rz|dz|j|l)$/.test(stem)) return `${stem}u`;
  if (stem.endsWith('t')) return `${stem.slice(0, -1)}cie`;
  if (stem.endsWith('d')) return `${stem.slice(0, -1)}dzie`;
  if (stem.endsWith('r')) return `${stem.slice(0, -1)}rze`;
  if (stem.endsWith('ł')) return `${stem.slice(0, -1)}le`;
  if (/(b|p|w|m|n|s|z|f)$/.test(stem)) return `${stem}ie`;
  return null;
}

/** Mianownik l.mn. wzorca m3 — po tematach na k/g końcówka „-i”, inaczej „-y”. */
function pluralM3(stem: string): string {
  return /(k|g)$/.test(stem) ? `${stem}i` : `${stem}y`;
}

/**
 * Mianownik l.mn. rodzaju męskoosobowego. Wygłos tematu ulega zmiękczeniu:
 * użytkownik → użytkownicy, klient → klienci, inżynier → inżynierowie.
 */
function pluralM1(stem: string): string {
  if (stem.endsWith('st')) return `${stem.slice(0, -2)}ści`; // programista -> programiści
  if (stem.endsWith('k')) return `${stem.slice(0, -1)}cy`;
  if (stem.endsWith('g')) return `${stem.slice(0, -1)}dzy`;
  if (stem.endsWith('t')) return `${stem.slice(0, -1)}ci`;
  if (stem.endsWith('d')) return `${stem.slice(0, -1)}dzi`;
  if (stem.endsWith('r')) return `${stem.slice(0, -1)}rzy`;
  if (stem.endsWith('ec')) return `${stem.slice(0, -2)}cy`;
  return `${stem}i`;
}

function declineNoun(spec: NounSpec): string[] {
  const { lemma, pattern } = spec;
  const forms = new Set<string>([lemma, ...(spec.extraForms ?? [])]);

  switch (pattern) {
    case 'm3': {
      const stem = spec.obliqueStem ?? lemma;
      forms.add(stem + (spec.gen ?? 'u'));
      forms.add(`${stem}owi`);
      forms.add(/(k|g)$/.test(stem) ? `${stem}iem` : `${stem}em`);
      forms.add(`${stem}ów`);
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      forms.add(pluralM3(stem));
      const loc = locativeM3(stem);
      if (loc) forms.add(loc);
      break;
    }
    case 'm1': {
      const stem = spec.obliqueStem ?? lemma;
      forms.add(`${stem}a`); // dopełniacz i biernik l.poj.
      forms.add(`${stem}owi`);
      forms.add(/(k|g)$/.test(stem) ? `${stem}iem` : `${stem}em`);
      forms.add(`${stem}ów`);
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      forms.add(pluralM1(stem));
      const loc = locativeM3(stem);
      if (loc) forms.add(loc);
      break;
    }
    case 'm1-a': {
      const stem = spec.obliqueStem ?? lemma.slice(0, -1); // programista -> programist
      forms.add(`${stem}y`); // dopełniacz l.poj.
      forms.add(`${stem}ę`);
      forms.add(`${stem}ą`);
      forms.add(`${stem}ów`);
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      forms.add(pluralM1(stem));
      // Celownik i miejscownik l.poj. dokładają "e" do mianownika l.mn.:
      // programiści -> programiście, klienci -> kliencie.
      const softened = pluralM1(stem);
      if (softened.endsWith('i')) forms.add(`${softened}e`);
      break;
    }
    case 'f-hard': {
      const stem = spec.obliqueStem ?? lemma.slice(0, -1);
      forms.add(/(k|g)$/.test(stem) ? `${stem}i` : `${stem}y`); // dopełniacz l.poj. + mianownik l.mn.
      forms.add(`${stem}ę`);
      forms.add(`${stem}ą`);
      forms.add(stem); // dopełniacz l.mn.: baz, metod, usług
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      break;
    }
    case 'f-soft': {
      const stem = spec.obliqueStem ?? lemma.slice(0, -1);
      // Tematy stwardniałe (-nica → -nicy, -ica → -icy) biorą w dopełniaczu „y":
      // rozdzielnica → rozdzielnicy, suwnica → suwnicy. Tematy na -cj-/-sj-
      // („funkcja", „tolerancja") zachowują „i": funkcji, tolerancji.
      // Rzeczowniki na -rnia/-elnia gubią końcowe „a" bez dopisywania „i":
      // uczelnia → uczelni (nie „uczelniai"), podczas gdy -inia podwaja „i":
      // linia → linii.
      if (/(c|cz|sz|ż|rz|dz)$/.test(stem)) {
        forms.add(`${stem}y`);
      } else if (/(rni|lni)$/.test(stem)) {
        forms.add(stem);
      } else {
        forms.add(`${stem}i`);
      }
      forms.add(`${stem}ę`);
      forms.add(`${stem}ą`);
      forms.add(`${stem}e`); // mianownik/biernik l.mn.
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      break;
    }
    case 'f-osc': {
      const base = lemma.slice(0, -2); // wydajność -> wydajno
      forms.add(`${base}ści`);
      forms.add(`${base}ścią`);
      forms.add(`${base}ściom`);
      forms.add(`${base}ściami`);
      forms.add(`${base}ściach`);
      break;
    }
    case 'n-hard': {
      const stem = spec.obliqueStem ?? lemma.slice(0, -1);
      forms.add(`${stem}a`);
      forms.add(`${stem}u`);
      forms.add(/(k|g)$/.test(stem) ? `${stem}iem` : `${stem}em`);
      forms.add(stem); // dopełniacz l.mn.: środowisk, źródeł (nieregularne podajemy wprost)
      forms.add(`${stem}om`);
      forms.add(`${stem}ami`);
      forms.add(`${stem}ach`);
      break;
    }
    case 'n-soft': {
      declineGerund(lemma).forEach((f) => forms.add(f));
      break;
    }
  }

  return [...forms];
}

/**
 * Rzeczowniki dziedzinowe: słownictwo IT/biznesowe, którego nie ma w PoliMorf,
 * oraz najczęstsze rzeczowniki opisujące doświadczenie zawodowe.
 */
export const DOMAIN_NOUNS: NounSpec[] = [
  { lemma: 'mikroserwis', pattern: 'm3', gen: 'u' },
  { lemma: 'monolit', pattern: 'm3', gen: 'u' },
  { lemma: 'kontener', pattern: 'm3', gen: 'a' },
  { lemma: 'serwer', pattern: 'm3', gen: 'a' },
  { lemma: 'klaster', pattern: 'm3', gen: 'a', obliqueStem: 'klastr' },
  { lemma: 'system', pattern: 'm3', gen: 'u' },
  { lemma: 'podsystem', pattern: 'm3', gen: 'u' },
  { lemma: 'projekt', pattern: 'm3', gen: 'u' },
  { lemma: 'proces', pattern: 'm3', gen: 'u' },
  { lemma: 'moduł', pattern: 'm3', gen: 'u' },
  { lemma: 'komponent', pattern: 'm3', gen: 'u' },
  { lemma: 'interfejs', pattern: 'm3', gen: 'u' },
  { lemma: 'algorytm', pattern: 'm3', gen: 'u' },
  { lemma: 'program', pattern: 'm3', gen: 'u' },
  { lemma: 'skrypt', pattern: 'm3', gen: 'u' },
  { lemma: 'pakiet', pattern: 'm3', gen: 'u' },
  { lemma: 'plik', pattern: 'm3', gen: 'u' },
  { lemma: 'katalog', pattern: 'm3', gen: 'u' },
  { lemma: 'kod', pattern: 'm3', gen: 'u' },
  { lemma: 'test', pattern: 'm3', gen: 'u' },
  { lemma: 'raport', pattern: 'm3', gen: 'u' },
  { lemma: 'dokument', pattern: 'm3', gen: 'u' },
  { lemma: 'budżet', pattern: 'm3', gen: 'u' },
  { lemma: 'harmonogram', pattern: 'm3', gen: 'u' },
  { lemma: 'standard', pattern: 'm3', gen: 'u' },
  { lemma: 'termin', pattern: 'm3', gen: 'u' },
  { lemma: 'koszt', pattern: 'm3', gen: 'u' },
  { lemma: 'wynik', pattern: 'm3', gen: 'u' },
  { lemma: 'produkt', pattern: 'm3', gen: 'u' },
  { lemma: 'kontrakt', pattern: 'm3', gen: 'u' },
  { lemma: 'backend', pattern: 'm3', gen: 'u' },
  { lemma: 'frontend', pattern: 'm3', gen: 'u' },
  { lemma: 'framework', pattern: 'm3', gen: 'u' },
  { lemma: 'deployment', pattern: 'm3', gen: 'u' },
  { lemma: 'pipeline', pattern: 'm3', gen: 'u' },
  { lemma: 'zespół', pattern: 'm3', gen: 'u', obliqueStem: 'zespoł', extraForms: ['zespole', 'zespoły', 'zespołów'] },
  { lemma: 'błąd', pattern: 'm3', gen: 'u', obliqueStem: 'błęd', extraForms: ['błędzie', 'błędy', 'błędów'] },
  { lemma: 'przychód', pattern: 'm3', gen: 'u', obliqueStem: 'przychod', extraForms: ['przychodzie', 'przychody'] },

  { lemma: 'programista', pattern: 'm1-a' },
  { lemma: 'specjalista', pattern: 'm1-a' },
  { lemma: 'analityk', pattern: 'm1' },
  { lemma: 'architekt', pattern: 'm1' },
  { lemma: 'administrator', pattern: 'm1' },
  { lemma: 'kierownik', pattern: 'm1' },
  { lemma: 'użytkownik', pattern: 'm1' },
  { lemma: 'pracownik', pattern: 'm1' },
  { lemma: 'klient', pattern: 'm1' },
  { lemma: 'inżynier', pattern: 'm1', extraForms: ['inżynierowie'] },
  { lemma: 'tester', pattern: 'm1' },
  { lemma: 'deweloper', pattern: 'm1' },
  { lemma: 'konsultant', pattern: 'm1' },
  { lemma: 'serwisant', pattern: 'm1' },
  { lemma: 'monter', pattern: 'm1' },
  { lemma: 'mechanik', pattern: 'm1' },
  { lemma: 'technik', pattern: 'm1' },
  { lemma: 'operator', pattern: 'm1' },
  { lemma: 'projektant', pattern: 'm1' },
  { lemma: 'spawacz', pattern: 'm1', extraForms: ['spawacze', 'spawaczy', 'spawaczem', 'spawaczu'] },

  { lemma: 'kocioł', pattern: 'm3', gen: 'a', obliqueStem: 'kotł', extraForms: ['kotle', 'kotły', 'kotłów'] },
  { lemma: 'piec', pattern: 'm3', gen: 'a', extraForms: ['piece', 'piecu'] },
  { lemma: 'piecyk', pattern: 'm3', gen: 'a' },
  { lemma: 'grzejnik', pattern: 'm3', gen: 'a' },
  { lemma: 'zawór', pattern: 'm3', gen: 'u', obliqueStem: 'zawor', extraForms: ['zaworze', 'zawory'] },
  { lemma: 'montaż', pattern: 'm3', gen: 'u', extraForms: ['montaże'] },

  { lemma: 'rura', pattern: 'f-hard', extraForms: ['rurze'] },
  { lemma: 'pompa', pattern: 'f-hard', extraForms: ['pompie'] },
  { lemma: 'spawarka', pattern: 'f-hard', extraForms: ['spawarce'] },
  { lemma: 'usterka', pattern: 'f-hard', extraForms: ['usterce'] },
  { lemma: 'baza', pattern: 'f-hard', extraForms: ['bazie'] },
  { lemma: 'chmura', pattern: 'f-hard', extraForms: ['chmurze'] },
  { lemma: 'usługa', pattern: 'f-hard', extraForms: ['usłudze'] },
  { lemma: 'biblioteka', pattern: 'f-hard', extraForms: ['bibliotece'] },
  { lemma: 'metoda', pattern: 'f-hard', extraForms: ['metodzie'] },
  { lemma: 'awaria', pattern: 'f-soft' },
  { lemma: 'aplikacja', pattern: 'f-soft' },
  { lemma: 'funkcja', pattern: 'f-soft' },
  { lemma: 'analiza', pattern: 'f-hard', extraForms: ['analizie'] },
  { lemma: 'architektura', pattern: 'f-hard', extraForms: ['architekturze'] },
  { lemma: 'dokumentacja', pattern: 'f-soft' },
  { lemma: 'automatyzacja', pattern: 'f-soft' },
  { lemma: 'konteneryzacja', pattern: 'f-soft' },
  { lemma: 'wirtualizacja', pattern: 'f-soft' },
  { lemma: 'integracja', pattern: 'f-soft' },
  { lemma: 'migracja', pattern: 'f-soft' },
  { lemma: 'optymalizacja', pattern: 'f-soft' },
  { lemma: 'konfiguracja', pattern: 'f-soft' },
  { lemma: 'księgowość', pattern: 'f-soft' },
  { lemma: 'pielęgnacja', pattern: 'f-soft' },
  { lemma: 'rehabilitacja', pattern: 'f-soft' },
  { lemma: 'koordynacja', pattern: 'f-soft' },
  { lemma: 'orkiestracja', pattern: 'f-soft' },
  { lemma: 'instalacja', pattern: 'f-soft' },
  { lemma: 'konserwacja', pattern: 'f-soft' },
  { lemma: 'rekrutacja', pattern: 'f-soft' },
  { lemma: 'prezentacja', pattern: 'f-soft' },
  { lemma: 'wizualizacja', pattern: 'f-soft' },
  { lemma: 'weryfikacja', pattern: 'f-soft' },
  { lemma: 'walidacja', pattern: 'f-soft' },
  { lemma: 'standaryzacja', pattern: 'f-soft' },
  { lemma: 'modernizacja', pattern: 'f-soft' },
  { lemma: 'archiwizacja', pattern: 'f-soft' },
  { lemma: 'diagnostyka', pattern: 'f-hard', extraForms: ['diagnostyce'] },
  { lemma: 'infrastruktura', pattern: 'f-hard', extraForms: ['infrastrukturze'] },
  { lemma: 'sieć', pattern: 'f-osc', extraForms: ['sieci', 'siecią', 'sieciom', 'sieciami', 'sieciach'] },
  { lemma: 'wydajność', pattern: 'f-osc' },
  { lemma: 'jakość', pattern: 'f-osc' },
  { lemma: 'dostępność', pattern: 'f-osc' },
  { lemma: 'niezawodność', pattern: 'f-osc' },
  { lemma: 'skuteczność', pattern: 'f-osc' },

  { lemma: 'środowisko', pattern: 'n-hard' },
  { lemma: 'ryzyko', pattern: 'n-hard' },
  { lemma: 'źródło', pattern: 'n-hard', extraForms: ['źródeł'] },
  { lemma: 'narzędzie', pattern: 'n-soft' },
  { lemma: 'rozwiązanie', pattern: 'n-soft' },
  { lemma: 'oprogramowanie', pattern: 'n-soft' },
  { lemma: 'doświadczenie', pattern: 'n-soft' },
  { lemma: 'zadanie', pattern: 'n-soft' },
  { lemma: 'szkolenie', pattern: 'n-soft' },

  // --- Narzędzia, aparatura i podzespoły instalacyjno-przemysłowe (m3) -----
  { lemma: 'obwód', pattern: 'm3', gen: 'u', obliqueStem: 'obwod', extraForms: ['obwodzie', 'obwody', 'obwodów'] },
  { lemma: 'przewód', pattern: 'm3', gen: 'u', obliqueStem: 'przewod', extraForms: ['przewodzie', 'przewody', 'przewodów'] },
  { lemma: 'przewóz', pattern: 'm3', gen: 'u', obliqueStem: 'przewoz', extraForms: ['przewozie', 'przewozy', 'przewozów'] },
  { lemma: 'kabel', pattern: 'm3', gen: 'a', obliqueStem: 'kabl', extraForms: ['kablu', 'kable', 'kabli'] },
  { lemma: 'rurociąg', pattern: 'm3', gen: 'u' },
  { lemma: 'filtr', pattern: 'm3', gen: 'a' },
  { lemma: 'reduktor', pattern: 'm3', gen: 'a' },
  { lemma: 'licznik', pattern: 'm3', gen: 'a' },
  { lemma: 'manometr', pattern: 'm3', gen: 'a' },
  { lemma: 'siłownik', pattern: 'm3', gen: 'a' },
  { lemma: 'sterownik', pattern: 'm3', gen: 'a' },
  { lemma: 'falownik', pattern: 'm3', gen: 'a' },
  { lemma: 'transformator', pattern: 'm3', gen: 'a' },
  { lemma: 'agregat', pattern: 'm3', gen: 'u' },
  { lemma: 'kompresor', pattern: 'm3', gen: 'a' },
  { lemma: 'wymiennik', pattern: 'm3', gen: 'a' },
  { lemma: 'parownik', pattern: 'm3', gen: 'a' },
  { lemma: 'skraplacz', pattern: 'm3', gen: 'a', extraForms: ['skraplacze', 'skraplaczy'] },
  { lemma: 'palnik', pattern: 'm3', gen: 'a' },
  { lemma: 'bezpiecznik', pattern: 'm3', gen: 'a' },
  { lemma: 'wyłącznik', pattern: 'm3', gen: 'a' },
  { lemma: 'stycznik', pattern: 'm3', gen: 'a' },
  { lemma: 'przekaźnik', pattern: 'm3', gen: 'a' },
  { lemma: 'peszel', pattern: 'm3', gen: 'a', obliqueStem: 'peszl' },
  { lemma: 'kanał', pattern: 'm3', gen: 'u' },
  { lemma: 'pion', pattern: 'm3', gen: 'u' },
  { lemma: 'kolektor', pattern: 'm3', gen: 'a' },
  { lemma: 'węzeł', pattern: 'm3', gen: 'a', obliqueStem: 'węzł', extraForms: ['węźle', 'węzły'] },
  { lemma: 'czujnik', pattern: 'm3', gen: 'a' },
  { lemma: 'termostat', pattern: 'm3', gen: 'u' },
  { lemma: 'dławik', pattern: 'm3', gen: 'a' },
  { lemma: 'mikrometr', pattern: 'm3', gen: 'a' },
  { lemma: 'niwelator', pattern: 'm3', gen: 'a' },
  { lemma: 'teodolit', pattern: 'm3', gen: 'u' },
  { lemma: 'tachimetr', pattern: 'm3', gen: 'a' },
  { lemma: 'oscyloskop', pattern: 'm3', gen: 'a' },
  { lemma: 'multimetr', pattern: 'm3', gen: 'a' },
  { lemma: 'frez', pattern: 'm3', gen: 'a' },
  { lemma: 'gwintownik', pattern: 'm3', gen: 'a' },
  { lemma: 'rozwiertak', pattern: 'm3', gen: 'a' },
  { lemma: 'brzeszczot', pattern: 'm3', gen: 'a' },
  { lemma: 'uchwyt', pattern: 'm3', gen: 'u' },
  { lemma: 'korpus', pattern: 'm3', gen: 'u' },
  { lemma: 'wał', pattern: 'm3', gen: 'u' },
  { lemma: 'wirnik', pattern: 'm3', gen: 'a' },
  { lemma: 'stojan', pattern: 'm3', gen: 'a' },
  { lemma: 'tłok', pattern: 'm3', gen: 'a' },
  { lemma: 'cylinder', pattern: 'm3', gen: 'a', obliqueStem: 'cylindr' },
  { lemma: 'łańcuch', pattern: 'm3', gen: 'a' },
  { lemma: 'bęben', pattern: 'm3', gen: 'a', obliqueStem: 'bębn' },
  { lemma: 'wózek', pattern: 'm3', gen: 'a', obliqueStem: 'wózk' },
  { lemma: 'regał', pattern: 'm3', gen: 'u' },
  { lemma: 'podnośnik', pattern: 'm3', gen: 'a' },
  { lemma: 'silnik', pattern: 'm3', gen: 'a' },
  { lemma: 'alternator', pattern: 'm3', gen: 'a' },
  { lemma: 'rozrusznik', pattern: 'm3', gen: 'a' },
  { lemma: 'akumulator', pattern: 'm3', gen: 'a' },
  { lemma: 'wtryskiwacz', pattern: 'm3', gen: 'a', extraForms: ['wtryskiwacze'] },
  { lemma: 'tłumik', pattern: 'm3', gen: 'a' },
  { lemma: 'katalizator', pattern: 'm3', gen: 'a' },
  { lemma: 'hamulec', pattern: 'm3', gen: 'a', obliqueStem: 'hamulc', extraForms: ['hamulce', 'hamulców'] },
  { lemma: 'amortyzator', pattern: 'm3', gen: 'a' },
  { lemma: 'wahacz', pattern: 'm3', gen: 'a', extraForms: ['wahacze'] },
  { lemma: 'tachograf', pattern: 'm3', gen: 'u' },
  { lemma: 'ciągnik', pattern: 'm3', gen: 'a' },
  { lemma: 'furgon', pattern: 'm3', gen: 'a' },
  { lemma: 'szalunek', pattern: 'm3', gen: 'u', obliqueStem: 'szalunk' },
  { lemma: 'rysunek', pattern: 'm3', gen: 'u', obliqueStem: 'rysunk' },
  { lemma: 'kosztorys', pattern: 'm3', gen: 'u' },
  { lemma: 'protokół', pattern: 'm3', gen: 'u', obliqueStem: 'protokoł', extraForms: ['protokole', 'protokoły'] },
  { lemma: 'atest', pattern: 'm3', gen: 'u' },
  { lemma: 'certyfikat', pattern: 'm3', gen: 'u' },
  { lemma: 'schemat', pattern: 'm3', gen: 'u' },
  { lemma: 'audyt', pattern: 'm3', gen: 'u' },
  { lemma: 'szablon', pattern: 'm3', gen: 'u' },
  { lemma: 'rekord', pattern: 'm3', gen: 'u' },
  { lemma: 'bufor', pattern: 'm3', gen: 'u' },
  { lemma: 'rejestr', pattern: 'm3', gen: 'u', obliqueStem: 'rejestr' },
  { lemma: 'indeks', pattern: 'm3', gen: 'u' },
  { lemma: 'parametr', pattern: 'm3', gen: 'u', obliqueStem: 'parametr' },
  { lemma: 'format', pattern: 'm3', gen: 'u' },
  { lemma: 'strumień', pattern: 'm3', gen: 'a', obliqueStem: 'strumieni', extraForms: ['strumienie', 'strumieni'] },
  { lemma: 'obiekt', pattern: 'm3', gen: 'u' },
  { lemma: 'port', pattern: 'm3', gen: 'u' },
  { lemma: 'procesor', pattern: 'm3', gen: 'a' },
  { lemma: 'rdzeń', pattern: 'm3', gen: 'a', obliqueStem: 'rdzeni', extraForms: ['rdzenie', 'rdzeni'] },
  { lemma: 'dysk', pattern: 'm3', gen: 'a' },
  { lemma: 'wolumen', pattern: 'm3', gen: 'u' },
  { lemma: 'backup', pattern: 'm3', gen: 'u' },
  { lemma: 'log', pattern: 'm3', gen: 'u' },
  { lemma: 'endpoint', pattern: 'm3', gen: 'u' },
  { lemma: 'webhook', pattern: 'm3', gen: 'u' },
  { lemma: 'wątek', pattern: 'm3', gen: 'u', obliqueStem: 'wątk' },
  { lemma: 'socket', pattern: 'm3', gen: 'u' },
  // „przegląd" ma oboczność tylko w dopełniaczu lp (przeglądu) — miejscownik
  // („przeglądzie") i reszta idą z tematu podstawowego, więc obchodzimy się
  // bez obcego tematu i dopisujemy wyłącznie formy z obocznością.
  { lemma: 'przegląd', pattern: 'm3', gen: 'u', extraForms: ['przeglądu', 'przeglądy', 'przeglądów', 'przeglądem', 'przeglądzie'] },

  // --- Zawody fizyczne, techniczne i specjalistyczne (m1 / m1-a) ------------
  { lemma: 'hydraulik', pattern: 'm1' },
  { lemma: 'dekarz', pattern: 'm1', extraForms: ['dekarze', 'dekarzy', 'dekarzem'] },
  { lemma: 'cieśla', pattern: 'm1-a' },
  { lemma: 'stolarz', pattern: 'm1', extraForms: ['stolarze', 'stolarzy', 'stolarzem'] },
  { lemma: 'zbrojarz', pattern: 'm1', extraForms: ['zbrojarze', 'zbrojarzy', 'zbrojarzem'] },
  { lemma: 'murarz', pattern: 'm1', extraForms: ['murarze', 'murarzy', 'murarzem'] },
  { lemma: 'tynkarz', pattern: 'm1', extraForms: ['tynkarze', 'tynkarzy', 'tynkarzem'] },
  { lemma: 'brukarz', pattern: 'm1', extraForms: ['brukarze', 'brukarzy', 'brukarzem'] },
  { lemma: 'malarz', pattern: 'm1', extraForms: ['malarze', 'malarzy', 'malarzem'] },
  { lemma: 'blacharz', pattern: 'm1', extraForms: ['blacharze', 'blacharzy', 'blacharzem'] },
  { lemma: 'lakiernik', pattern: 'm1' },
  { lemma: 'ślusarz', pattern: 'm1', extraForms: ['ślusarze', 'ślusarzy', 'ślusarzem'] },
  { lemma: 'tokarz', pattern: 'm1', extraForms: ['tokarze', 'tokarzy', 'tokarzem'] },
  { lemma: 'frezarz', pattern: 'm1', extraForms: ['frezarze', 'frezarzy', 'frezarzem'] },
  { lemma: 'szlifierz', pattern: 'm1', extraForms: ['szlifierze', 'szlifierzy', 'szlifierzem'] },
  { lemma: 'instalator', pattern: 'm1' },
  { lemma: 'elektromonter', pattern: 'm1' },
  { lemma: 'elektryk', pattern: 'm1' },
  { lemma: 'automatyk', pattern: 'm1' },
  { lemma: 'mechatronik', pattern: 'm1' },
  { lemma: 'konserwator', pattern: 'm1' },
  { lemma: 'wulkanizator', pattern: 'm1' },
  { lemma: 'suwnicowy', pattern: 'm1', extraForms: ['suwnicowi', 'suwnicowego', 'suwnicowemu', 'suwnicowych', 'suwnicowym'] },
  { lemma: 'hakowy', pattern: 'm1', extraForms: ['hakowi', 'hakowego', 'hakowemu', 'hakowych', 'hakowym'] },
  { lemma: 'brygadzista', pattern: 'm1-a' },
  { lemma: 'mistrz', pattern: 'm1', extraForms: ['mistrzowie', 'mistrza', 'mistrzem'] },
  { lemma: 'kierowca', pattern: 'm1-a' },
  { lemma: 'sprzedawca', pattern: 'm1-a' },
  { lemma: 'dyspozytor', pattern: 'm1' },
  { lemma: 'spedytor', pattern: 'm1' },
  { lemma: 'magazynier', pattern: 'm1' },
  { lemma: 'kurier', pattern: 'm1' },
  { lemma: 'konwojent', pattern: 'm1' },
  { lemma: 'farmaceuta', pattern: 'm1-a' },
  { lemma: 'pielęgniarz', pattern: 'm1', extraForms: ['pielęgniarze', 'pielęgniarzy', 'pielęgniarzem'] },
  { lemma: 'ratownik', pattern: 'm1' },
  { lemma: 'fizjoterapeuta', pattern: 'm1-a' },
  { lemma: 'laborant', pattern: 'm1' },
  { lemma: 'radiolog', pattern: 'm1' },
  { lemma: 'księgowy', pattern: 'm1', extraForms: ['księgowi', 'księgowego', 'księgowemu', 'księgowych', 'księgowym'] },
  { lemma: 'audytor', pattern: 'm1' },
  { lemma: 'rewident', pattern: 'm1' },
  { lemma: 'kontroler', pattern: 'm1' },
  { lemma: 'koordynator', pattern: 'm1' },
  { lemma: 'kosztorysant', pattern: 'm1' },
  { lemma: 'geodeta', pattern: 'm1-a' },
  // Formy żeńskie zawodów: ogłoszenia („zatrudnimy księgową", „szukamy
  // pielęgniarki") i CV kandydatek odmieniają je tak samo często jak męskie.
  { lemma: 'księgowa', pattern: 'f-hard', extraForms: ['księgowej'] },
  { lemma: 'pielęgniarka', pattern: 'f-hard', extraForms: ['pielęgniarce'] },
  { lemma: 'programistka', pattern: 'f-hard', extraForms: ['programistce'] },
  { lemma: 'inżynierka', pattern: 'f-hard', extraForms: ['inżynierce'] },
  { lemma: 'specjalistka', pattern: 'f-hard', extraForms: ['specjalistce'] },
  { lemma: 'kierowniczka', pattern: 'f-hard', extraForms: ['kierowniczce'] },
  { lemma: 'techniczka', pattern: 'f-hard', extraForms: ['techniczce'] },
  { lemma: 'farmaceutka', pattern: 'f-hard', extraForms: ['farmaceutce'] },
  { lemma: 'fizjoterapeutka', pattern: 'f-hard', extraForms: ['fizjoterapeutce'] },

  // --- Uprawnienia, edukacja i formalia z ogłoszeń (ATS: formalReqs) ---------
  // Ekstraktor ogłoszeń (`extractDynamicJdPhrases`) wykrywa te frazy jako
  // wymagania formalne — lematyzacja musi je znać, inaczej pokrycie formalne
  // spada mimo obecności dowodu w tekście.
  { lemma: 'uprawnienie', pattern: 'n-soft' },
  { lemma: 'licencja', pattern: 'f-soft' },
  { lemma: 'kwalifikacja', pattern: 'f-soft' },
  { lemma: 'świadectwo', pattern: 'n-hard' },
  { lemma: 'zaświadczenie', pattern: 'n-soft' },
  { lemma: 'kategoria', pattern: 'f-soft' },
  { lemma: 'jazda', pattern: 'f-hard', extraForms: ['jeździe'] },
  { lemma: 'uczelnia', pattern: 'f-soft' },
  { lemma: 'wydział', pattern: 'm3', gen: 'u' },
  { lemma: 'kierunek', pattern: 'm3', gen: 'u', obliqueStem: 'kierunk' },
  { lemma: 'dyplom', pattern: 'm3', gen: 'u' },
  { lemma: 'magister', pattern: 'm1', obliqueStem: 'magistr', extraForms: ['magistrowie'] },
  { lemma: 'licencjat', pattern: 'm3', gen: 'u' },
  { lemma: 'technikum', pattern: 'n-hard' },
  { lemma: 'szkoła', pattern: 'f-hard', extraForms: ['szkole', 'szkół'] },
  // „studia" to plurale tantum — żaden wzorzec liczby pojedynczej tu nie
  // pasuje, więc bierzemy pusty szkielet (n-soft bez końcowego „e" nie
  // generuje nic) i dopisujemy wyłącznie poświadczone formy liczby mnogiej.
  { lemma: 'studia', pattern: 'n-soft', extraForms: ['studiów', 'studiom', 'studiami', 'studiach'] },
  { lemma: 'kurs', pattern: 'm3', gen: 'u' },
  { lemma: 'egzamin', pattern: 'm3', gen: 'u' },
  { lemma: 'tytuł', pattern: 'm3', gen: 'u' },
  { lemma: 'stopień', pattern: 'm3', gen: 'a', obliqueStem: 'stopni', extraForms: ['stopnie', 'stopni'] },

  // --- Narzędzia, osprzęt, materiały i pojęcia techniczne (f) ---------------
  { lemma: 'suwmiarka', pattern: 'f-hard', extraForms: ['suwmiarce'] },
  { lemma: 'zaciskarka', pattern: 'f-hard', extraForms: ['zaciskarce'] },
  { lemma: 'bruzdownica', pattern: 'f-soft' },
  { lemma: 'zgrzewarka', pattern: 'f-hard', extraForms: ['zgrzewarce'] },
  { lemma: 'giętarka', pattern: 'f-hard', extraForms: ['giętarce'] },
  { lemma: 'wiertarka', pattern: 'f-hard', extraForms: ['wiertarce'] },
  { lemma: 'szlifierka', pattern: 'f-hard', extraForms: ['szlifierce'] },
  { lemma: 'polerka', pattern: 'f-hard', extraForms: ['polerce'] },
  { lemma: 'tokarka', pattern: 'f-hard', extraForms: ['tokarce'] },
  { lemma: 'frezarka', pattern: 'f-hard', extraForms: ['frezarce'] },
  { lemma: 'wkrętarka', pattern: 'f-hard', extraForms: ['wkrętarce'] },
  { lemma: 'nitownica', pattern: 'f-soft' },
  { lemma: 'przecinarka', pattern: 'f-hard', extraForms: ['przecinarce'] },
  { lemma: 'piła', pattern: 'f-hard', extraForms: ['pile'] },
  { lemma: 'drabina', pattern: 'f-hard', extraForms: ['drabinie'] },
  { lemma: 'suwnica', pattern: 'f-soft' },
  { lemma: 'naczepa', pattern: 'f-hard', extraForms: ['naczepie'] },
  { lemma: 'przyczepa', pattern: 'f-hard', extraForms: ['przyczepie'] },
  { lemma: 'sprężarka', pattern: 'f-hard', extraForms: ['sprężarce'] },
  { lemma: 'chłodnica', pattern: 'f-soft' },
  { lemma: 'turbina', pattern: 'f-hard', extraForms: ['turbinie'] },
  { lemma: 'nagrzewnica', pattern: 'f-soft' },
  { lemma: 'klimatyzacja', pattern: 'f-soft' },
  { lemma: 'centrala', pattern: 'f-hard', extraForms: ['centrali'] },
  { lemma: 'rozdzielnica', pattern: 'f-soft' },
  { lemma: 'szafa', pattern: 'f-hard', extraForms: ['szafie'] },
  { lemma: 'puszka', pattern: 'f-hard', extraForms: ['puszce'] },
  { lemma: 'magistrala', pattern: 'f-hard', extraForms: ['magistrali'] },
  { lemma: 'złączka', pattern: 'f-hard', extraForms: ['złączce'] },
  { lemma: 'mufa', pattern: 'f-hard', extraForms: ['mufie'] },
  { lemma: 'kształtka', pattern: 'f-hard', extraForms: ['kształtce'] },
  { lemma: 'taśma', pattern: 'f-hard', extraForms: ['taśmie'] },
  { lemma: 'uszczelka', pattern: 'f-hard', extraForms: ['uszczelce'] },
  { lemma: 'podkładka', pattern: 'f-hard', extraForms: ['podkładce'] },
  { lemma: 'nakrętka', pattern: 'f-hard', extraForms: ['nakrętce'] },
  { lemma: 'śruba', pattern: 'f-hard', extraForms: ['śrubie'] },
  { lemma: 'kotwa', pattern: 'f-hard', extraForms: ['kotwie'] },
  { lemma: 'blacha', pattern: 'f-hard', extraForms: ['blasze'] },
  { lemma: 'belka', pattern: 'f-hard', extraForms: ['belce'] },
  { lemma: 'płyta', pattern: 'f-hard', extraForms: ['płycie'] },
  { lemma: 'kalibracja', pattern: 'f-soft' },
  { lemma: 'renowacja', pattern: 'f-soft' },
  { lemma: 'obróbka', pattern: 'f-hard', extraForms: ['obróbce'] },
  { lemma: 'destylacja', pattern: 'f-soft' },
  { lemma: 'sterylizacja', pattern: 'f-soft' },
  { lemma: 'dezynfekcja', pattern: 'f-soft' },
  { lemma: 'aseptyka', pattern: 'f-hard', extraForms: ['aseptyce'] },
  { lemma: 'inwentaryzacja', pattern: 'f-soft' },
  { lemma: 'kompletacja', pattern: 'f-soft' },
  { lemma: 'paletyzacja', pattern: 'f-soft' },
  { lemma: 'spedycja', pattern: 'f-soft' },
  { lemma: 'logistyka', pattern: 'f-hard', extraForms: ['logistyce'] },
  { lemma: 'dyspozycja', pattern: 'f-soft' },
  { lemma: 'ewidencja', pattern: 'f-soft' },
  { lemma: 'amortyzacja', pattern: 'f-soft' },
  { lemma: 'kalkulacja', pattern: 'f-soft' },
  { lemma: 'wycena', pattern: 'f-hard', extraForms: ['wycenie'] },
  { lemma: 'faktura', pattern: 'f-hard', extraForms: ['fakturze'] },
  { lemma: 'paleta', pattern: 'f-hard' },
  { lemma: 'zamówienie', pattern: 'n-soft' },
  { lemma: 'podatek', pattern: 'm3', gen: 'u', obliqueStem: 'podatk' },
  { lemma: 'kadra', pattern: 'f-hard' },
  { lemma: 'płaca', pattern: 'f-hard' },
  { lemma: 'spoina', pattern: 'f-hard' },
  { lemma: 'element', pattern: 'm3', gen: 'u' },
  { lemma: 'konstrukcja', pattern: 'f-soft' },
  { lemma: 'homologacja', pattern: 'f-soft' },
  { lemma: 'specyfikacja', pattern: 'f-soft' },
  { lemma: 'aparatura', pattern: 'f-hard', extraForms: ['aparaturze'] },
  { lemma: 'tolerancja', pattern: 'f-soft' },
  { lemma: 'szczelność', pattern: 'f-osc' },
  { lemma: 'nośność', pattern: 'f-osc' },
  { lemma: 'trwałość', pattern: 'f-osc' },
  { lemma: 'wytrzymałość', pattern: 'f-osc' },
  { lemma: 'ciągliwość', pattern: 'f-osc' },
  { lemma: 'spawalność', pattern: 'f-osc' },
  { lemma: 'twardość', pattern: 'f-osc' },
  { lemma: 'elastyczność', pattern: 'f-osc' },
  { lemma: 'lepkość', pattern: 'f-osc' },
  { lemma: 'gęstość', pattern: 'f-osc' },
  { lemma: 'precyzja', pattern: 'f-soft' },
  { lemma: 'dokładność', pattern: 'f-osc' },

  // --- Podzespoły, mechanizmy i pojęcia rodzaju nijakiego (n) --------------
  { lemma: 'łożysko', pattern: 'n-hard' },
  { lemma: 'koło', pattern: 'n-hard', extraForms: ['kół'] },
  { lemma: 'sprzęgło', pattern: 'n-hard', extraForms: ['sprzęgieł'] },
  { lemma: 'wrzeciono', pattern: 'n-hard' },
  { lemma: 'podwozie', pattern: 'n-soft' },
  { lemma: 'nadwozie', pattern: 'n-soft' },
  { lemma: 'ogniwo', pattern: 'n-hard' },
  { lemma: 'uzwojenie', pattern: 'n-soft' },
  { lemma: 'zasilanie', pattern: 'n-soft' },
  { lemma: 'sterowanie', pattern: 'n-soft' },
  { lemma: 'chłodzenie', pattern: 'n-soft' },
  { lemma: 'ogrzewanie', pattern: 'n-soft' },
  { lemma: 'smarowanie', pattern: 'n-soft' },
  { lemma: 'ciśnienie', pattern: 'n-soft' },
  { lemma: 'napięcie', pattern: 'n-soft' },
  { lemma: 'natężenie', pattern: 'n-soft' },
  { lemma: 'uziemienie', pattern: 'n-soft' },
  { lemma: 'oznakowanie', pattern: 'n-soft' },
  { lemma: 'zabezpieczenie', pattern: 'n-soft' },
  { lemma: 'rusztowanie', pattern: 'n-soft' },
  { lemma: 'orurowanie', pattern: 'n-soft' },
  { lemma: 'okablowanie', pattern: 'n-soft' },
  { lemma: 'zbrojenie', pattern: 'n-soft' },
  { lemma: 'szalowanie', pattern: 'n-soft' },
  { lemma: 'spawanie', pattern: 'n-soft' },
  { lemma: 'lutowanie', pattern: 'n-soft' },
  { lemma: 'frezowanie', pattern: 'n-soft' },
  { lemma: 'toczenie', pattern: 'n-soft' },
  { lemma: 'wiercenie', pattern: 'n-soft' },
  { lemma: 'szlifowanie', pattern: 'n-soft' },
  { lemma: 'lakierowanie', pattern: 'n-soft' },
  { lemma: 'cynkowanie', pattern: 'n-soft' },
  { lemma: 'piaskowanie', pattern: 'n-soft' },
  { lemma: 'pakowanie', pattern: 'n-soft' },
  { lemma: 'składowanie', pattern: 'n-soft' },
  { lemma: 'wydawanie', pattern: 'n-soft' },
  { lemma: 'przyjmowanie', pattern: 'n-soft' },
];

// ---------------------------------------------------------------------------
// Przymiotniki
// ---------------------------------------------------------------------------

/** Przymiotniki opisujące technologie i kompetencje (odmiana regularna -y/-i). */
export const DOMAIN_ADJECTIVES: string[] = [
  'techniczny',
  'systemowy',
  'produkcyjny',
  'testowy',
  'wydajny',
  'skalowalny',
  'zwinny',
  'chmurowy',
  'dockerowy',
  'kontenerowy',
  'relacyjny',
  'rozproszony',
  'bezpieczny',
  'automatyczny',
  'ciągły',
  'kluczowy',
  'złożony',
  'analityczny',
  'projektowy',
  'zespołowy',
  'wdrożeniowy',
  'serwisowy',
  'gazowy',
  'elektryczny',
  'przemysłowy',
  // Przymiotniki zawodowe: prace fizyczne, rzemiosło, instalacje, transport.
  // Wszystkie na -ski są po spółgłosce, więc reguła miękka daje poprawne
  // „tokarskiego", nie „tokarskego" (patrz ograniczenie w declineAdjective).
  'hydrauliczny',
  'pneumatyczny',
  'spawalniczy',
  'dekarski',
  'stolarski',
  'ciesielski',
  'blacharski',
  'murarski',
  'tynkarski',
  'brukarski',
  'szlifierski',
  'tokarski',
  'frezarski',
  'lakierniczy',
  'montażowy',
  'chłodniczy',
  'sanitarny',
  'wentylacyjny',
  'grzewczy',
  'pomiarowy',
  'kalibracyjny',
  'logistyczny',
  'magazynowy',
  'transportowy',
  'spedycyjny',
  'księgowy',
  'kadrowy',
  'płacowy',
  'budowlany',
  'mechaniczny',
  'elektroenergetyczny',
  'teletechniczny',
  'przeciwpożarowy',
  'izolacyjny',
  'precyzyjny',
  'cyfrowy',
  'analogowy',
  'światłowodowy',
  'wysokoprężny',
  'niskoprężny',
  'akumulatorowy',
  'sieciowy',
  'bezprzewodowy',
  'ciśnieniowy',
  'szczelny',
  'kwasoodporny',
  'nierdzewny',
  'żaroodporny',
  'hartowany',
  'ocynkowany',
  'modułowy',
  'prefabrykowany',
  'zbrojony',
  'szalunkowy',
  'nośny',
  'konstrukcyjny',
  'warsztatowy',
  'narzędziowy',
  'maszynowy',
  'silnikowy',
  'hamulcowy',
  'rozrządowy',
  'spalinowy',
  'hybrydowy',
  // Języki obce z ogłoszeń („angielski B2", „niemieckim") — ekstraktor formalny
  // wykrywa je jako wymagania, więc odmiana musi działać w obu kierunkach.
  'angielski',
  'niemiecki',
  'francuski',
  'hiszpański',
  'włoski',
  'ukraiński',
  'rosyjski',
  'polski',
  // Poziomy zaawansowania i gotowości („zaawansowanym", „biegłej",
  // „dyspozycyjny" — klasyka sekcji wymagań).
  'zaawansowany',
  'średniozaawansowany',
  'podstawowy',
  'biegły',
  'płynny',
  'komunikatywny',
  'samodzielny',
  'dyspozycyjny',
  'mobilny',
  'uprawniony',
  'certyfikowany',
  'kwalifikowany',
  'doświadczony',
  // Materiały i sprzęt z opisów stanowisk fizycznych („konstrukcje stalowe",
  // „wózek widłowy", „szalunki drewniane") — bez nich zdania o tej samej
  // treści nie dają pełnego pokrycia lematów w dopasowaniu CV–ogłoszenie.
  'stalowy',
  'metalowy',
  'miedziany',
  'drewniany',
  'betonowy',
  'ceramiczny',
  'pełny',
  'podatkowy',
  'widłowy',
];

function declineAdjective(lemma: string): string[] {
  const stem = lemma.slice(0, -1);
  // Zmiękczenie przed końcówkami -ego/-emu/-ej po k, g oraz tematach zakończonych na -i
  // Np. tokarski -> tokarskiego, polski -> polskim, tani -> taniego.
  // Ograniczenie: przymiotniki na -ki po samogłosce (taki, wielki, bliski) też
  // dostałyby końcówki miękkie („takiego"), więc takich lematów nie dokładamy
  // do DOMAIN_ADJECTIVES bez rozszerzenia reguły — słownictwo domenowe
  // (tokarski, spawalniczy, elektryczny) jest po spółgłosce i działa poprawnie.
  const soft = stem.endsWith('k') || stem.endsWith('g') || lemma.endsWith('i');
  const eSuffix = soft ? 'i' : '';
  const ySuffix = soft ? 'i' : 'y';
  return [
    lemma,
    `${stem}${eSuffix}ego`,
    `${stem}${eSuffix}emu`,
    `${stem}${ySuffix}m`,
    `${stem}${ySuffix}mi`,
    `${stem}${ySuffix}ch`,
    `${stem}e`,
    `${stem}a`,
    `${stem}${eSuffix}ej`,
    `${stem}ą`,
    `${stem}i`,
  ];
}

// ---------------------------------------------------------------------------
// Budowa korpusu
// ---------------------------------------------------------------------------

/**
 * Usuwa duplikaty form. Przy kolizji wygrywa wpis o wyższym priorytecie części
 * mowy — dzięki temu np. przymiotnikowe „dockerowi” nigdy nie przesłoni
 * rzeczownikowego celownika „dockerowi”, a wynik nie zależy od kolejności tabel.
 */
export function dedupeByPosPriority(entries: MorphEntry[]): MorphEntry[] {
  const best = new Map<string, MorphEntry>();

  for (const entry of entries) {
    const form = entry.form.toLowerCase();
    const current = best.get(form);
    if (!current) {
      best.set(form, { ...entry, form, lemma: entry.lemma.toLowerCase() });
      continue;
    }
    const incomingRank = POS_RANK[entry.posTag as PosTag] ?? 9;
    const currentRank = POS_RANK[current.posTag as PosTag] ?? 9;
    if (incomingRank < currentRank) {
      best.set(form, { ...entry, form, lemma: entry.lemma.toLowerCase() });
    }
  }

  return [...best.values()];
}

/** Rozwija pojedynczy czasownik do pełnego zbioru form. */
export function expandVerb(spec: VerbSpec): MorphEntry[] {
  const cls = classifyVerb(spec.lemma);
  const lemma = spec.lemma;
  const out: MorphEntry[] = [{ form: lemma, lemma, posTag: 'verb' }];

  if (!spec.skipPraeteritum) {
    for (const form of derivePraeteritum(lemma)) {
      out.push({ form, lemma, posTag: 'praet' });
    }
  }

  if (!spec.skipFinite) {
    for (const form of deriveFinite(lemma, cls, spec.finiteOverride)) {
      out.push({ form, lemma, posTag: 'fin' });
    }
  }

  const gerund = spec.gerund === null ? null : (spec.gerund ?? deriveGerund(lemma, cls));
  if (gerund) {
    for (const form of declineGerund(gerund)) {
      out.push({ form, lemma, posTag: 'ger' });
    }
  }

  for (const [form, tag] of spec.extraForms ?? []) {
    out.push({ form, lemma, posTag: tag });
  }

  return out;
}

/** Rozwija pojedynczy rzeczownik do pełnego zbioru form. */
export function expandNoun(spec: NounSpec): MorphEntry[] {
  return declineNoun(spec).map((form) => ({ form, lemma: spec.lemma, posTag: 'subst' }));
}

/**
 * Generuje odmianę męskorzeczową dla nazwy technologii („docker” → „dockerze”,
 * „dockera”, „dockerem”). Pomijamy nazwy nieodmienne w polszczyźnie: skróty,
 * nazwy z interpunkcją oraz bardzo krótkie identyfikatory (`go`, `r`, `c++`).
 */
export function expandTechnologyName(name: string): MorphEntry[] {
  const lemma = name.toLowerCase().trim();
  if (lemma.length < 4) return [];
  if (!/^[a-ząćęłńóśźż][a-ząćęłńóśźż0-9]*$/.test(lemma)) return [];

  return expandNoun({ lemma, pattern: 'm3', gen: 'a' });
}

/**
 * Buduje kompletny kuratorowany korpus morfologiczny.
 *
 * @param technologyNames dodatkowe nazwy technologii z tezaurusa umiejętności.
 */
export function buildOfflineMorphCorpus(technologyNames: string[] = []): MorphEntry[] {
  const entries: MorphEntry[] = [];

  for (const adjective of DOMAIN_ADJECTIVES) {
    for (const form of declineAdjective(adjective)) {
      entries.push({ form, lemma: adjective, posTag: 'adj' });
    }
  }

  for (const name of technologyNames) {
    entries.push(...expandTechnologyName(name));
  }

  for (const noun of DOMAIN_NOUNS) {
    entries.push(...expandNoun(noun));
  }

  for (const verb of ACTION_VERBS) {
    entries.push(...expandVerb(verb));
  }

  return dedupeByPosPriority(entries);
}
