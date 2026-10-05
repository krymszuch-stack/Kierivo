/**
 * Kanoniczny matcher dowodów na umiejętności — jedno źródło prawdy (reguła 3).
 *
 * Wcześniej to samo pytanie („czy CV zawiera X?") liczyły cztery różne
 * mechanizmy: `isLemmatizedMatch` (podciąg + prefiksy), `countOccurrences`
 * (granice słów), `scoreTextAgainstKeywords` (`String.includes`) i licznik
 * telemetrii (równość rdzeni). Wynikowo `Java` == `JavaScript` w jednym
 * silniku i `Java` != `JavaScript` w drugim, a `go` pasowało do `good`
 * i `ai` do `pain`/`air`.
 *
 * Ten moduł jest kanoniczny: granice słów w Unicode, jawny graf aliasów
 * (bez zgadywania z podciągu), wykrywanie negacji, intencji nauki
 * i wycieku wymagań z ogłoszenia. Każdy inny moduł ma go używać zamiast
 * własnego `includes`.
 */

/** Jawne grupy aliasów — równoważność tylko z danych, nigdy z podciągu. */
const ALIAS_GROUPS: Array<{ canonical: string; variants: string[] }> = [
  { canonical: 'javascript', variants: ['js', 'ecmascript', 'es6', 'es2015+'] },
  { canonical: 'typescript', variants: ['ts'] },
  { canonical: 'postgresql', variants: ['postgres', 'psql'] },
  { canonical: 'kubernetes', variants: ['k8s'] },
  { canonical: 'aws', variants: ['amazon web services'] },
  { canonical: 'gcp', variants: ['google cloud', 'google cloud platform'] },
  { canonical: 'node.js', variants: ['node', 'nodejs'] },
  { canonical: 'react.js', variants: ['react'] },
  { canonical: 'vue.js', variants: ['vue'] },
  { canonical: '.net', variants: ['dotnet'] },
  { canonical: 'c#', variants: ['csharp'] },
  { canonical: 'github actions', variants: ['gh actions'] },
  { canonical: 'entra id', variants: ['azure ad'] },
  { canonical: 'microsoft 365', variants: ['m365', 'office 365'] },
  // Obsługa zgłoszeń, ich priorytetyzacja i eskalacja opisują triage incydentów;
  // alias działa tylko dla tej frazy i zachowuje granice słów oraz kontrolę negacji.
  { canonical: 'incident triage', variants: ['triage incydentów', 'triage incydentow', 'incident prioritization and escalation', 'kategoryzowanie ustalanie priorytetu przekazywanie incydentow'] },
  { canonical: 'customer-facing technical support', variants: ['customer-facing support', 'customer facing technical support', 'customer facing support'] },
];

/**
 * Rdzeniowanie polskie — przeniesione z `atsSimulator.ts` bez zmian
 * semantycznych, żeby morfologia miała jedno źródło prawdy. Zachowuje krótkie
 * terminy techniczne (sql, aws, git) w całości.
 */
export function getPolishStem(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;

  if (/^[a-z0-9#+.-]+$/i.test(w) && !/[ąćęłńóśźż]/.test(w) && w.length <= 6) {
    return w;
  }

  return w
    .replace(/(nościami|nościach|nością|ności|stwem|stwach|stwu)$/i, '')
    .replace(/(eniach|eniom|eniem|enie|enia|eniu)$/i, '')
    .replace(/(aniach|aniom|aniem|anie|ania|aniu)$/i, '')
    .replace(/(owałem|owałeś|owaliśmy|owali|ować|uję|ujesz|ują)$/i, '')
    .replace(/(ałem|ałeś|aliśmy|ałam|ałaś)$/i, '')
    .replace(/(owali|owały|owało)$/i, '')
    .replace(/(ami|ach|owi|ego|emu|ich|ych|iej|iem|ym)$/i, '')
    .replace(/(em|ie|om|ów|ej|ey)$/i, '')
    .replace(/(a|e|i|o|u|y|ę|ą)$/i, '');
}

/**
 * Niższa rejestr + NFD bez diakrytyków — `księgowość` ≡ `ksiegowosc`.
 * `ł` nie ma dekompozycji NFD (U+0142 zostaje), więc mapujemy je jawnie —
 * bez tego `pracowałem` nigdy nie zrównałoby się z `pracowalem` w słowniku
 * negacji i filtrze prawdy.
 */
export function stripDiacriticsLower(input: string): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Warianty frazy z grafu aliasów (w obie strony). Zwraca co najmniej samą
 * frazę znormalizowaną. Bez tego `JS` nie znalazłoby `JavaScript` po
 * uszczelnieniu granic — a to jest równoważność jawna, nie podciąg.
 */
export function expandWithAliases(phrase: string): string[] {
  const norm = stripDiacriticsLower(phrase).trim().replace(/\s+/g, ' ');
  if (!norm) return [];
  for (const group of ALIAS_GROUPS) {
    const canon = stripDiacriticsLower(group.canonical);
    const vars = group.variants.map((v) => stripDiacriticsLower(v));
    if (norm === canon || vars.includes(norm)) {
      return [group.canonical, ...group.variants];
    }
  }
  return [phrase.trim()];
}

// Znaczniki unieważniające dowód — testowane na znormalizowanym tekście
// (małe litery, bez diakrytyków), okno przed trafieniem w obrębie klauzuli.
const NEGATION_SOURCE = [
  'do not know',
  "don't know",
  'does not know',
  'never worked with',
  'never used',
  'no experience with',
  'no knowledge of',
  'have not used',
  'has not used',
  'not familiar with',
  'lack of',
  'without experience',
  'nie znam',
  'nie znamy',
  'nie umiem',
  'nie umie',
  'nie pracowalem',
  'nie pracowalam',
  'nie pracowal',
  'nigdy nie',
  'brak doswiadczenia',
  'brak znajomosci',
  'nie posiadam',
  'nie mam',
  'nie jestem',
  'nie mam doswiadczenia',
  'nie uzywalem',
  'nie uzywalam',
  'bez doswiadczenia',
  'bez znajomosci',
].map(escapeRegExp).join('|');

const LEARNING_SOURCE = [
  'currently learning',
  'learning',
  'studying',
  'interested in',
  'want to learn',
  'plan to learn',
  'eager to learn',
  'beginner in',
  'starting with',
  'ucze sie',
  'uczenie',
  'w trakcie nauki',
  'zainteresowany',
  'zainteresowana',
  'interesuje sie',
  'chce nauczyc',
  'chcialbym poznac',
  'poczatkujacy',
  'dopiero zaczynam',
].map(escapeRegExp).join('|');

const LEAKAGE_SOURCE = [
  'job requires',
  'position requires',
  'offer requires',
  'we require',
  'we are looking for',
  'required skills?\\s*:',
  'requirements?\\s*:',
  'oferta wymaga',
  'ogloszenie wymaga',
  'pracodawca wymaga',
  'stanowisko wymaga',
  'wymagania pracodawcy',
  'wymagania oferty',
].map((s) => s).join('|');

const NEGATION_RE = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${NEGATION_SOURCE})(?=[^\\p{L}\\p{N}_]|$)`, 'iu');
const LEARNING_RE = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${LEARNING_SOURCE})(?=[^\\p{L}\\p{N}_]|$)`, 'iu');
const LEAKAGE_RE = new RegExp(`(${LEAKAGE_SOURCE})`, 'iu');
const POSTFIXED_TAINT_RE = new RegExp(`^(?:\\d+(?:\\.\\d+)*)?[ \\t]*(?:[—–:-][ \\t]*)?(?:${LEARNING_SOURCE}|${NEGATION_SOURCE})(?=[^\\p{L}\\p{N}_]|$)`, 'iu');

/** Skróty z kropką nie kończą klauzuli (`kat. B`, `np.`, `tzw.`). */
const ABBREV_BEFORE_DOT = /(kat|np|tzw|mgr|inz|dr|al|ul|godz|godziny|nr|r)$/i;

function clauseStart(text: string, index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '\n' || ch === ';' || ch === '!' || ch === '?' || ch === '•' || ch === '·') return i + 1;
    if (ch === '.') {
      const before = text.slice(Math.max(0, i - 6), i).split(/\s+/).pop() ?? '';
      if (ABBREV_BEFORE_DOT.test(before)) continue;
      return i + 1;
    }
  }
  return 0;
}

function buildPhraseSource(phrase: string): string {
  return stripDiacriticsLower(phrase)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join('\\s+');
}

/**
 * Cache fraz — ranking 250 punktorów × N słów kluczowych kompilował ten sam
 * regex tysiące razy (test wydajnościowy 15 ms). Mapy z limitem, bez wycieków.
 */
const REGEX_CACHE = new Map<string, RegExp>();
const STEM_TOKENS_CACHE = new Map<string, Array<{ stem: string; index: number }>>();
const CACHE_CAP = 2000;

function cachedPhraseRegex(src: string, allowVersionSuffix: boolean): RegExp {
  const cacheKey = `${src}\u0000${allowVersionSuffix ? 'version' : 'plain'}`;
  let re = REGEX_CACHE.get(cacheKey);
  if (!re) {
    // CV często zapisuje wersje bez spacji (`C++17`, `Python3`, `Go1.22`).
    // Dopuszczamy cyfry tylko jako kompletny sufiks wersji, nigdy jako początek
    // dalszego identyfikatora, np. `Python3x`.
    const rightBoundary = allowVersionSuffix
      ? '(?=(?:\\d+(?:\\.\\d+)*)(?:[^\\p{L}\\p{N}_#+]|$)|[^\\p{L}\\p{N}_#+]|$)'
      : '(?![\\p{L}\\p{N}_#+])';
    re = new RegExp(`(?<![\\p{L}\\p{N}_#+])${src}${rightBoundary}`, 'giu');
    if (REGEX_CACHE.size >= CACHE_CAP) {
      const oldest = REGEX_CACHE.keys().next();
      if (!oldest.done) REGEX_CACHE.delete(oldest.value);
    }
    REGEX_CACHE.set(cacheKey, re);
  }
  re.lastIndex = 0;
  return re;
}

function cachedStemTokens(normalizedHaystack: string): Array<{ stem: string; index: number }> {
  let cached = STEM_TOKENS_CACHE.get(normalizedHaystack);
  if (!cached) {
    cached = [];
    const tokenRe = /[\p{L}\p{N}#+.]+/giu;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(normalizedHaystack)) !== null) {
      cached.push({ stem: getPolishStem(m[0]), index: m.index });
      if (cached.length > 2000) break;
    }
    if (STEM_TOKENS_CACHE.size >= 500) {
      const oldest = STEM_TOKENS_CACHE.keys().next();
      if (!oldest.done) STEM_TOKENS_CACHE.delete(oldest.value);
    }
    STEM_TOKENS_CACHE.set(normalizedHaystack, cached);
  }
  return cached;
}

/**
 * Surowe wystąpienia frazy z granicami Unicode. Otacza całość
 * lookaroundami, więc `java` nie wchodzi w `javascript`, `go` w `good`,
 * `ai` w `air`, a `c` w `c++`/`c#`.
 */
function findRawOccurrences(normalizedHaystack: string, phrase: string): number[] {
  const src = buildPhraseSource(phrase);
  if (!src) return [];
  const allowVersionSuffix = !/\d\s*$/u.test(stripDiacriticsLower(phrase).trim());
  const re = cachedPhraseRegex(src, allowVersionSuffix);
  const out: number[] = [];
  let m: RegExpExecArray | null;
  // Zabezpieczenie przed pustym dopasowaniem i zapętleniem.
  while ((m = re.exec(normalizedHaystack)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out.push(m.index);
    if (out.length > 500) break;
  }
  re.lastIndex = 0;
  return out;
}

/**
 * Odmienione wystąpienia jednowyrazowe (`pythona` → `python`).
 * Tylko równość rdzeni — prefiksy (`jav` ⊂ `javascript`) nie liczą się.
 */
function findStemOccurrences(normalizedHaystack: string, phrase: string): number[] {
  const words = stripDiacriticsLower(phrase).trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return [];
  const single = words[0];
  if (single.length <= 3) return [];
  const targetStem = getPolishStem(single);
  if (!targetStem) return [];
  const out: number[] = [];
  for (const tok of cachedStemTokens(normalizedHaystack)) {
    if (tok.stem === targetStem) out.push(tok.index);
    if (out.length > 500) break;
  }
  return out;
}

const PERSONAL_DECLARATION_SOURCE = '(?:znam|umiem|mam|posiadam|obsluguje|obslugiwalem|obslugiwalam|uzywam|uzywalem|uzywalam|konfiguruje|konfigurowalem|konfigurowalam|wdrazam|wdrozylem|wdrozylam|spawam|spawalem|spawalam|montuje|montowalem|montowalam|kompletuje|kompletowalem|kompletowalam|(?:i|we)\\s+(?:used|use|configured|configure|implemented|implement|operated|operate|have|managed|manage|know))';
const PERSONAL_CLAUSE_SEPARATOR_RE = /(?:,\s*(?:(?:ale|lecz|natomiast|but|yet|a)\s+)?|\s+(?:ale|lecz|natomiast|but|yet)\s+)/giu;
const PERSONAL_CLAUSE_PREFIX_RE = new RegExp(`^(?:ja\\s+)?(?:nie\\s+)?${PERSONAL_DECLARATION_SOURCE}(?![\\p{L}\\p{N}])`, 'u');

/** Granice osobistej czynności zachowują indeksy oryginalnego tekstu. */
export function getPersonalClaimBounds(text: string, index: number): { start: number; end: number } {
  let start = 0;
  let end = text.length;
  for (const separator of text.matchAll(PERSONAL_CLAUSE_SEPARATOR_RE)) {
    const next = separator.index + separator[0].length;
    if (!PERSONAL_CLAUSE_PREFIX_RE.test(stripDiacriticsLower(text.slice(next)))) continue;
    if (next <= index) start = next;
    else { end = separator.index; break; }
  }
  return { start, end };
}

function evidenceClauseStart(text: string, index: number): number {
  const start = clauseStart(text, index);
  const prefix = text.slice(start, index);
  // Przecinek w liście narzędzi nie kończy negacji. Nowa osobista czynność
  // po przecinku lub spójniku ma własny kontekst, także przy ponownej negacji.
  return start + getPersonalClaimBounds(prefix, prefix.length).start;
}

const OTHER_ACTOR_SOURCE = '(?:kolega|kolezanka|koledzy|kolezanki|wspolpracownik|wspolpracownicy|zespol|dostawca|podwykonawca|(?:my|our|the)\\s+(?:colleague|team|vendor|coworker))';
const OTHER_ACTION_SOURCE = '(?:obslugiwal(?:a|i|y)?|uzywal(?:a|i|y)?|konfigurowal(?:a|i|y)?|posiada(?:ja)?|wdrazal(?:a|i|y)?|wykonywal(?:a|i|y)?|obsluguje|obsluguja|uzywa|uzywaja|konfiguruje|wdraza|used|operated|configured|implemented|has|uses)';
const OTHER_ACTOR_PREFIX_RE = new RegExp(`(?<![\\p{L}\\p{N}])${OTHER_ACTOR_SOURCE}\\s+(?:\\p{L}+\\s+){0,3}${OTHER_ACTION_SOURCE}(?![\\p{L}\\p{N}])`, 'gu');
const OTHER_ACTOR_SUFFIX_RE = new RegExp(`^[ \\t]*(?:[—–:-][ \\t]*)?(?:${OTHER_ACTION_SOURCE}\\s+(?:(?:moj|moja|nasz|nasza)\\s+)?${OTHER_ACTOR_SOURCE}|(?:was|is|were|are)\\s+(?:used|operated|configured|implemented)\\s+by\\s+${OTHER_ACTOR_SOURCE})(?![\\p{L}\\p{N}])`, 'u');

function describesAnotherActor(prefix: string): boolean {
  // Podmiot cudzej czynności nie potwierdza praktyki kandydata. Instrumentalne
  // „z zespołem” nie pasuje do podmiotu; późniejsze „ja/I” zmienia właściciela.
  const own = new RegExp(`(?<![\\p{L}\\p{N}])(?:ja|${PERSONAL_DECLARATION_SOURCE})(?![\\p{L}\\p{N}])`, 'gu');
  const other = [...prefix.matchAll(OTHER_ACTOR_PREFIX_RE)].at(-1);
  // Po normalizacji „obsługuje” i „obsługuję” mają tę samą postać. Jawny
  // podmiot rozstrzyga właściciela; resetem może być dopiero późniejsza czynność.
  return Boolean(other && !own.test(prefix.slice(other.index + other[0].length)));
}

function isTainted(normalizedHaystack: string, matchIndex: number, phrase?: string): boolean {
  const start = evidenceClauseStart(normalizedHaystack, matchIndex);
  if (describesAnotherActor(normalizedHaystack.slice(start, matchIndex))) return true;
  // Negacja i nauka dotyczą najbliższego kontekstu przed frazą;
  // wyciek wymagań (nagłówek ogłoszenia) sięga dalej w tej samej klauzuli.
  const near = normalizedHaystack.slice(start, matchIndex).slice(-70);
  if (NEGATION_RE.test(near) || LEARNING_RE.test(near)) return true;
  const far = normalizedHaystack.slice(start, matchIndex).slice(-140);
  if (LEAKAGE_RE.test(far)) return true;
  if (phrase) {
    // Listy profilu zapisują także „RabbitMQ — w trakcie nauki”. Oceniaj tylko
    // bezpośredni dopisek, aby nauka kolejnego narzędzia nie negowała poprzedniego.
    const tail = normalizedHaystack.slice(matchIndex);
    const match = cachedPhraseRegex(buildPhraseSource(phrase), true).exec(tail);
    const length = match?.index === 0 ? match[0].length : tail.match(/^[\p{L}\p{N}#+.]+/u)?.[0].length;
    if (length) {
      const suffix = tail.slice(length);
      if (POSTFIXED_TAINT_RE.test(suffix)) return true;
      if (OTHER_ACTOR_SUFFIX_RE.test(suffix)) return true;
    }
  }
  return false;
}

/** Normalizacja korpusu do wielokrotnego przesiewu (ranking wsadowy). */
export function normalizeHaystackText(text: string): string {
  return stripDiacriticsLower(text ?? '');
}

const VARIANTS_CACHE = new Map<string, string[]>();

function cachedVariants(raw: string): string[] {
  let v = VARIANTS_CACHE.get(raw);
  if (!v) {
    v = expandWithAliases(raw);
    if (VARIANTS_CACHE.size >= CACHE_CAP) {
      const oldest = VARIANTS_CACHE.keys().next();
      if (!oldest.done) VARIANTS_CACHE.delete(oldest.value);
    }
    VARIANTS_CACHE.set(raw, v);
  }
  return v;
}

/**
 * Wariant wsadowy: korpus już znormalizowany (`normalizeHaystackText`) —
 * ranking 250 punktorów normalizuje każdy raz zamiast razy liczba fraz.
 */
export function hasPositiveSkillEvidenceNormalized(normalizedHaystack: string, phrase: string): boolean {
  const raw = (phrase ?? '').trim();
  if (!normalizedHaystack || !raw || raw.length < 1) return false;
  if (!/[\p{L}\p{N}]/u.test(raw)) return false;

  const variants = cachedVariants(raw);
  // Wymóg po angielsku może być udowodniony przez opisaną po polsku czynność;
  // zachowujemy zdanie źródłowe i nie dopisujemy terminu do profilu.
  if (stripDiacriticsLower(raw) === 'incident triage') {
    const clauses = normalizedHaystack.split(/(?<=[.!?;\n])/u);
    let offset = 0;
    for (const clause of clauses) {
      const categorization = /kategoryz\p{L}*/u.exec(clause);
      const hasPriority = /(?:ustal\p{L}*\s+priorytet|prioryt\p{L}*)/u.test(clause);
      const hasEscalation = /(?:przekaz\p{L}*|eskal\p{L}*)/u.test(clause);
      if (categorization?.index !== undefined && hasPriority && hasEscalation &&
        !isTainted(normalizedHaystack, offset + categorization.index)) return true;
      offset += clause.length;
    }
  }
  const normalizedPhrase = stripDiacriticsLower(raw);
  if (normalizedPhrase === 'customer-facing technical support' || normalizedPhrase === 'customer-facing support') {
    const supportTask = /(?:wsparc\p{L}*|obslu\p{L}*)[^.!?;\n]{0,80}(?:uzytkownik\p{L}*|klient\p{L}*|zgloszen\p{L}*)/u.exec(normalizedHaystack);
    if (
      supportTask?.index !== undefined &&
      /(?:uzytkownik\p{L}*|klient\p{L}*)/u.test(supportTask[0]) &&
      !isTainted(normalizedHaystack, supportTask.index)
    ) return true;
  }
  const seen = new Set<number>();
  for (const variant of variants) {
    for (const idx of findRawOccurrences(normalizedHaystack, variant)) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      if (!isTainted(normalizedHaystack, idx, variant)) return true;
    }
    if (variant === variants[0]) {
      for (const idx of findStemOccurrences(normalizedHaystack, variant)) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        if (!isTainted(normalizedHaystack, idx, variant)) return true;
      }
    }
  }
  return false;
}

/**
 * Kanoniczne pytanie: czy tekst zawiera POZYTYWNY dowód na frazę.
 * Odrzuca wystąpienia zanegowane, deklaracje nauki/chęci i wyciek wymagań.
 */
export function hasPositiveSkillEvidence(haystack: string, phrase: string): boolean {
  // Śmieci interpunkcyjne (`---`, `...`) nie są dowodem na nic.
  if (!/[\p{L}\p{N}]/u.test(phrase ?? '')) return false;
  return hasPositiveSkillEvidenceNormalized(normalizeHaystackText(haystack), phrase);
}

/**
 * Obecność frazy bez oceny intencji — strona OGŁOSZENIA.
 * Ogłoszenie *jest* wymaganiem, więc `Job requires Python` w JD to trafienie;
 * negacja ogłoszenia (`nie wymagamy X`) należy do `knockouts.ts`, nie tutaj.
 * Granice + aliasy + odmiana jak wyżej, ale bez klauzuli taint.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const text = stripDiacriticsLower(haystack ?? '');
  const raw = (phrase ?? '').trim();
  if (!text || !raw || !/[\p{L}\p{N}]/u.test(raw)) return false;
  for (const variant of expandWithAliases(raw)) {
    if (findRawOccurrences(text, variant).length > 0) return true;
    if (findStemOccurrences(text, variant).length > 0) return true;
  }
  return false;
}

/** Zliczanie wystąpień z granicami (mianownik gęstości, nie punktacji). */
export function countPhraseOccurrences(haystack: string, phrase: string): number {
  const text = stripDiacriticsLower(haystack ?? '');
  const raw = (phrase ?? '').trim();
  if (!text || !raw || !/[\p{L}\p{N}]/u.test(raw)) return 0;
  const seen = new Set<number>();
  for (const variant of expandWithAliases(raw)) {
    for (const idx of findRawOccurrences(text, variant)) seen.add(idx);
    for (const idx of findStemOccurrences(text, variant)) seen.add(idx);
  }
  return seen.size;
}

/** Wariant zliczający — do testów i diagnostyki (nie do punktacji częstością). */
export function countPositiveSkillEvidence(haystack: string, phrase: string): number {
  const text = stripDiacriticsLower(haystack ?? '');
  const raw = (phrase ?? '').trim();
  if (!text || !raw || !/[\p{L}\p{N}]/u.test(raw)) return 0;
  let count = 0;
  const seen = new Set<number>();
  for (const variant of expandWithAliases(raw)) {
    for (const idx of findRawOccurrences(text, variant)) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      if (!isTainted(text, idx, variant)) count++;
    }
  }
  return count;
}
