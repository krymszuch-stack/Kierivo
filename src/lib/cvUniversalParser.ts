import { WorkExperience, Education, Certification, LanguageProficiency, Project, HighlightMetric } from '../types';
import { normalizeDocumentText } from './textNormalization';
import * as mammoth from 'mammoth';

/**
 * PDF.js is loaded on demand: importing it at module scope pulls in browser-only globals
 * (DOMMatrix) that break Node-based tests, and keeps the large library out of the initial bundle.
 */
async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjsLib;
}

export interface ParsedCVResult {
  personalInfo: {
    fullName: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  hardSkills: string[];
  softSkills: string[];
  toolsAndTech: string[];
  certifications: Certification[];
  history: WorkExperience[];
  education: Education[];
  languages?: LanguageProficiency[];
  projects?: Project[];
  rawText: string;
  detectedFormat: string;
  hasCyrillicScript?: boolean;
  warnings?: string[];
}

/**
 * Universal Multi-Format Text Extractor
 * Supports: .pdf, .docx, .doc, .rtf, .txt, .json, .csv
 */
export async function extractTextFromAnyFile(file: File): Promise<{ text: string; format: string }> {
  const fileName = file.name.toLowerCase();

  // 1. JSON Format
  if (fileName.endsWith('.json')) {
    const rawJson = await file.text();
    return { text: rawJson, format: 'JSON' };
  }

  // 2. CSV Format
  if (fileName.endsWith('.csv')) {
    const rawCsv = await file.text();
    return { text: rawCsv, format: 'CSV' };
  }

  // 3. RTF Format
  if (fileName.endsWith('.rtf')) {
    const rawRtf = await file.text();
    const cleanText = stripRtfControlWords(rawRtf);
    return { text: cleanText, format: 'RTF' };
  }

  // 4. DOCX / DOC Format
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 20) {
        return { text: result.value, format: 'DOCX' };
      }
    } catch {
      // Fallback to text reading
    }
    const txt = await file.text();
    return { text: txt, format: 'DOC/TXT' };
  }

  // 5. PDF Format
  if (fileName.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let pdfText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Odtwarzamy podział na wiersze na podstawie pozycji Y elementów.
      // PDF.js dzieli tekst na spany (TextItem) — każdy ma macierz transformacji
      // [scaleX, skewY, skewX, scaleY, translateX, translateY].
      // Elementy z tą samą pozycją Y (z tolerancją 2px) należą do jednego wiersza.
      // Bez tego cała strona ląduje w jednym bloku tekstu i parser nie rozpoznaje sekcji.
      interface PdfLineItem { y: number; x: number; str: string }
      const items: PdfLineItem[] = [];
      for (const item of textContent.items) {
        if (!('str' in item) || !item.str) continue;
        const tx = item.transform;
        // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
        const x = tx ? tx[4] : 0;
        const y = tx ? tx[5] : 0;
        items.push({ y, x, str: item.str });
      }

      if (items.length === 0) continue;

      // Grupowanie elementów w wiersze na podstawie pozycji Y (tolerancja 2px)
      const LINE_Y_TOLERANCE = 2;
      const lines: { y: number; fragments: PdfLineItem[] }[] = [];

      for (const item of items) {
        const existingLine = lines.find((l) => Math.abs(l.y - item.y) < LINE_Y_TOLERANCE);
        if (existingLine) {
          existingLine.fragments.push(item);
        } else {
          lines.push({ y: item.y, fragments: [item] });
        }
      }

      // Sortowanie wierszy od góry do dołu (PDF ma oś Y odwróconą — wyższa wartość = wyżej)
      lines.sort((a, b) => b.y - a.y);

      for (const line of lines) {
        // Sortowanie fragmentów w wierszu od lewej do prawej
        line.fragments.sort((a, b) => a.x - b.x);
        const lineText = line.fragments.map((f) => f.str).join(' ').trim();
        if (lineText) {
          pdfText += lineText + '\n';
        }
      }

      // Separator między stronami
      pdfText += '\n';
    }
    if (pdfText.trim().length < 20) {
      throw new Error(
        'Nie udało się odczytać tekstu z tego pliku PDF. Prawdopodobnie jest to skan lub dokument zabezpieczony — wklej treść CV ręcznie.'
      );
    }
    return { text: pdfText, format: 'PDF' };
  }

  // 6. Plain Text (.txt, .md, .text)
  const plainText = await file.text();
  return { text: plainText, format: 'TXT' };
}

/**
 * Strips RTF control words and decodes Rich Text content
 */
function stripRtfControlWords(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\[a-z0-9]+\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Wzorce sekcji dokumentu CV.
 * Dopasowanie jest niewrażliwe na numerację (1., I.), punktor (*, -, •),
 * znaczniki Markdown (#, ##), obramowania (===, ---) oraz dwukropek z treścią w tej samej linii.
 */
const SECTION_DEFS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'experience',
    pattern: /^(?:doświadczenie(?:\s+zawodowe)?|doswiadczenie(?:\s+zawodowe)?|historia\s+(?:zatrudnienia|pracy(?:\s+zawodowej)?|zawodowa)|przebieg\s+(?:pracy(?:\s+zawodowej)?|kariery(?:\s+zawodowej)?|zatrudnienia)|gdzie\s+pracowa[lł][eę]m|miejsca\s+(?:pracy|zatrudnienia)|kariera(?:\s+zawodowa)?|zatrudnienie|praktyka\s+zawodowa|staże\s+i\s+praktyki|staze\s+i\s+praktyki|work\s+experience|employment(?:\s+history)?|professional\s+experience|experience|career\s+history)$/i,
  },
  {
    name: 'education',
    pattern: /^(?:wykształcenie(?:\s+i\s+(?:szkolenia|kursy|kwalifikacje))?|wyksztalcenie(?:\s+i\s+(?:szkolenia|kursy|kwalifikacje))?|edukacja(?:\s+i\s+(?:szkolenia|kursy|szkoły|szkoly))?|historia\s+edukacji|przebieg\s+edukacji|szkoły(?:\s+i\s+(?:uczelnie|edukacja))?|szkoly(?:\s+i\s+(?:uczelnie|edukacja))?|szkoły|szkoly|studia|co\s+uko[nń]czy[lł]em|co\s+sko[nń]czy[lł]em|education(?:\s+&\s+(?:training|qualifications))?|academic\s+background|qualifications)$/i,
  },
  {
    name: 'certifications',
    pattern: /^(?:certyfikaty(?:\s*(?:i|\/|&|\||\+)\s*(?:uprawnienia|kursy|szkolenia))?|certyfikacje|uprawnienia(?:\s*(?:i|\/|&|\||\+)\s*(?:certyfikaty|kwalifikacje))?|uprawnienia(?:\s+(?:zawodowe|sep|udt))?|kursy(?:\s*(?:i|\/|&|\||\+)\s*(?:szkolenia|certyfikaty))?|szkolenia(?:\s*(?:i|\/|&|\||\+)\s*(?:kursy|certyfikaty))?|licencje|dyplomy|certifications?(?:\s*(?:&|\/|and)\s*(?:licenses|courses))?|licenses?|courses|training)$/i,
  },
  {
    name: 'skills',
    pattern: /^(?:umiejętności(?:\s+(?:twarde|zawodowe|techniczne|kluczowe|i\s+uprawnienia|i\s+kompetencje|i\s+kwalifikacje|i\s+programy|i\s+narzędzia|i\s+technologie))?|umiejetnosci(?:\s+(?:twarde|zawodowe|techniczne|kluczowe|i\s+uprawnienia|i\s+kompetencje|i\s+kwalifikacje|i\s+programy|i\s+narzedzia|i\s+technologie))?|kluczowe\s+umiejętności|kluczowe\s+umiejetnosci|kompetencje(?:\s+(?:zawodowe|techniczne|twarde|kluczowe))?|kwalifikacje(?:\s*(?:i|\/|&)\s*(?:umiejętności|umiejetnosci|uprawnienia|kwalifikacje))?|kwalifikacje(?:\s+(?:zawodowe|kluczowe|techniczne))?|znajomość\s+(?:narzędzi|programów|technologii|narzędzi\s+i\s+technologii)|znajomosc\s+(?:narzedzi|programow|technologii|narzedzi\s+i\s+technologii)|co\s+potrafi[eę]|czym\s+si[eę]\s+zajmuj[eę]|technologie(?:\s*(?:i|\/|&)\s*narzędzia)?|narzędzia(?:\s*(?:i|\/|&)\s*technologie)?|programy|skills(?:\s*(&|and|\+)\s*(?:tools|technologies))?|technical\s+skills|hard\s+skills|core\s+competencies|technologies|tools)$/i,
  },
  {
    name: 'softSkills',
    pattern: /^(?:umiejętności\s+miękkie|umiejetnosci\s+miekkie|kompetencje\s+miękkie|kompetencje\s+miekkie|kompetencje\s+interpersonalne|cechy(?:\s+osobowości)?|predyspozycje|soft\s+skills|personal\s+skills)$/i,
  },
  {
    name: 'languages',
    pattern: /^(?:języki(?:\s+obce)?|jezyki(?:\s+obce)?|znajomość\s+języków(?:\s+obcych)?|znajomosc\s+jezykow(?:\s+obcych)?|languages?|foreign\s+languages?|language\s+skills)$/i,
  },
  {
    name: 'projects',
    pattern: /^(?:projekty(?:\s+(?:komercyjne|open\s*source|indywidualne))?|portfolio|realizacje|wybrane\s+projekty|projects?|portfolio\s+projects?)$/i,
  },
  {
    name: 'summary',
    pattern: /^(?:podsumowanie(?:\s+zawodowe)?|o\s+mnie|o\s+sobie|profil(?:\s+(?:zawodowy|osobowy|kandydata))?|cel\s+zawodowy|summary|professional\s+summary|about(?:\s+me)?|profile)$/i,
  },
  {
    name: 'clause',
    pattern: /^(?:klauzula(?:\s+rodo)?|rodo|zgoda\s+na\s+przetwarzanie(?:\s+danych)?|wyrażam\s+zgodę\s+na\s+przetwarzanie|data\s+processing\s+consent|gdpr)$/i,
  },
];

/**
 * Wykrywa i rozwija układ dwukolumnowy "side-by-side" rozdzielony separatorem pionowym (| lub tabulatorami).
 */
export function unwrapTwoColumnText(text: string): string {
  const rawLines = text.split('\n');
  const nonEmptyLines = rawLines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length < 4) return text;

  // Sprawdzamy czy dokument zawiera kolumny połączone kreską | (np. lewa kolumna | prawa kolumna)
  const pipeLines = nonEmptyLines.filter((l) => {
    const parts = l.split('|');
    return parts.length >= 2 && parts[0].trim().length > 0 && parts[1].trim().length > 0;
  });

  if (pipeLines.length / nonEmptyLines.length >= 0.28) {
    const leftCol: string[] = [];
    const rightCol: string[] = [];

    for (const line of rawLines) {
      if (line.includes('|')) {
        const parts = line.split('|');
        const left = parts[0]?.trim();
        const right = parts.slice(1).join('|').trim();
        if (left) leftCol.push(left);
        if (right) rightCol.push(right);
      } else {
        const trimmed = line.trim();
        if (trimmed) leftCol.push(trimmed);
      }
    }

    return [...leftCol, '', ...rightCol].join('\n');
  }

  return text;
}

/**
 * Rozpoznaje, czy dana linia tekstu jest nagłówkiem sekcji CV.
 */
function matchSectionHeading(rawLine: string): { section: string; inlineContent: string } | null {
  const trimmed = rawLine
    .replace(/<[^>]+>/g, '')
    .trim();
  if (!trimmed || trimmed.length > 90) return null;

  // Filtrujemy nagłówki paginacji typu "Strona 1 z 2", "Page 2 of 3"
  if (/^(?:strona\s+\d+(?:\s+z\s+\d+)?|page\s+\d+(?:\s+of\s+\d+)?)$/i.test(trimmed)) return null;

  // Odcinamy numerację, punktor, markdown, ukośniki, kropki, ramki, emoji i symbole specjalne
  const cleaned = trimmed
    .replace(/[\p{Extended_Pictographic}\u{FE00}-\u{FE0F}§¤»«¬▪►●•]/gu, '')
    .replace(/^[\s#*•►▪●–—_>[\]()=~/.-]+/, '')
    .replace(/^(?:\d{1,2}[.)]|[IVXLCDM]+[.)]|[a-zA-Z][.)])\s*/, '')
    .replace(/[\s#*•►▪●–—_<[\]()=~/.-]+$/, '')
    .trim();

  // Sprawdzamy czy linia zawiera separator z treścią inline (np. "Umiejętności: React, Node.js")
  let headingPart = cleaned;
  let inlinePart = '';

  const colonIdx = cleaned.indexOf(':');
  if (colonIdx > 0 && colonIdx < 60) {
    headingPart = cleaned.slice(0, colonIdx).trim();
    inlinePart = cleaned.slice(colonIdx + 1).trim();
  }

  for (const def of SECTION_DEFS) {
    if (def.pattern.test(headingPart)) {
      return { section: def.name, inlineContent: inlinePart };
    }
  }

  return null;
}

/**
 * Dzieli tekst CV na sekcje.
 */
function splitIntoSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = { header: [] };
  let current = 'header';

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Całkowicie pomijamy linie paginacji PDF oraz puste znaczniki blokowe HTML
    if (
      /^(?:strona\s+\d+(?:\s+z\s+\d+)?|page\s+\d+(?:\s+of\s+\d+)?)$/i.test(trimmedLine) ||
      /^<\/?(?:experience|skills|education|certifications|languages|projects|summary|clause|div|section|article|p|br|hr)>$/i.test(trimmedLine)
    ) {
      continue;
    }

    const headingMatch = matchSectionHeading(line);
    if (headingMatch) {
      current = headingMatch.section;
      if (current === 'clause') {
        current = 'ignored_clause';
      }
      if (!sections[current]) sections[current] = [];
      if (headingMatch.inlineContent) {
        sections[current].push(headingMatch.inlineContent);
      }
      continue;
    }

    if (current === 'ignored_clause') {
      const isConsentText = /(?:zgod[eę]|przetwarzan|danyc|rekrutac|rodo|gdpr|art\.|ustaw|rozporz[aą]dzen)/i.test(line);
      if (isConsentText) {
        continue;
      }
      current = 'header';
    }

    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }

  return sections;
}

// Słownik polskich i angielskich nazw miesięcy -> numer dwucyfrowy
const MONTH_MAP: Record<string, string> = {
  styczeń: '01', stycznia: '01', sty: '01', styczen: '01', jan: '01', january: '01',
  luty: '02', lutego: '02', lut: '02', feb: '02', february: '02',
  marzec: '03', marca: '03', mar: '03', marz: '03', march: '03',
  kwiecień: '04', kwietnia: '04', kwi: '04', kwiecien: '04', apr: '04', april: '04',
  maj: '05', maja: '05', may: '05',
  czerwiec: '06', czerwca: '06', cze: '06', jun: '06', june: '06',
  lipiec: '07', lipca: '07', lip: '07', jul: '07', july: '07',
  sierpień: '08', sierpnia: '08', sie: '08', sierpien: '08', aug: '08', august: '08',
  wrzesień: '09', września: '09', wrz: '09', wrzesien: '09', sep: '09', sept: '09', september: '09',
  październik: '10', października: '10', paź: '10', paz: '10', pazdziernik: '10', oct: '10', october: '10',
  listopad: '11', listopada: '11', lis: '11', nov: '11', november: '11',
  grudzień: '12', grudnia: '12', gru: '12', grudz: '12', grudzien: '12', dec: '12', december: '12',
};

const MONTH_PATTERN_PART = Object.keys(MONTH_MAP).join('|');

/**
 * Rozpoznaje pojedynczą datę (np. "05.2021", "maj 2021", "2021-05", "2021", "obecnie", "2021 r.").
 */
function parseSingleDate(raw: string): string {
  const trimmed = raw
    .trim()
    .toLowerCase()
    .replace(/(?:\s*r\.|\s*roku|\s*r)$/i, '')
    .replace(/\s*([./-])\s*/g, '$1');

  if (/^(obecnie|present|nadal|teraz|do\s+teraz|current|ongoing|dziś|dzisiaj|now)$/i.test(trimmed)) {
    return 'Obecnie';
  }

  // 1. Format YYYY-MM lub YYYY.MM (np. 2021-02, 2021.05)
  const yyyyMmMatch = trimmed.match(/^((?:19|20)\d{2})[./-](\d{1,2})$/);
  if (yyyyMmMatch) {
    const m = yyyyMmMatch[2].padStart(2, '0');
    return `${m}-${yyyyMmMatch[1]}`;
  }

  // 2. Nazwa miesiąca + rok: "maj 2021" lub "may 2021"
  const monthNameMatch = trimmed.match(new RegExp(`(${MONTH_PATTERN_PART})\\s+((?:19|20)\\d{2})`, 'i'));
  if (monthNameMatch) {
    const monthNum = MONTH_MAP[monthNameMatch[1].toLowerCase()] || '01';
    return `${monthNum}-${monthNameMatch[2]}`;
  }

  // 3. Format MM.YYYY lub MM/YYYY lub MM-YYYY
  const mmYyyyMatch = trimmed.match(/^(\d{1,2})[./-]((?:19|20)\d{2})$/);
  if (mmYyyyMatch) {
    const m = mmYyyyMatch[1].padStart(2, '0');
    return `${m}-${mmYyyyMatch[2]}`;
  }

  // 4. Sam rok YYYY
  const yearMatch = trimmed.match(/((?:19|20)\d{2})/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return raw.trim();
}

/**
 * Szuka przedziału dat w tekście linii (kolejność wzorców od najdłuższego YYYY-MM / MM-YYYY do samego YYYY).
 */
const DATE_SINGLE_EXPR = `(?:(?:19|20)\\d{2}\\s*[./-]\\s*(?:0?[1-9]|1[0-2])|(?:(?:0?[1-9]|1[0-2])\\s*[./-]\\s*|(?:${MONTH_PATTERN_PART})\\s+)(?:19|20)\\d{2}|(?:19|20)\\d{2})(?:\\s*r\\.?|\\s*roku)?`;

export const DATE_RANGE_REGEX = new RegExp(
  `(?:\\b(?:od|from)\\s+)?(${DATE_SINGLE_EXPR})\\s*(?:[-–—]|\\b(?:do|to)\\b)\\s*(${DATE_SINGLE_EXPR}|obecnie|present|nadal|teraz|ongoing|current|dziś|dzisiaj|now)`,
  'i'
);

interface ExtractedDateRange {
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  rawMatched: string;
}

function extractDateRange(text: string): ExtractedDateRange | null {
  const match = text.match(DATE_RANGE_REGEX);
  if (!match || !match[1] || !match[2]) return null;

  const rawMatched = match[0];
  const start = parseSingleDate(match[1]);
  const end = parseSingleDate(match[2]);

  return {
    startDate: start,
    endDate: end,
    isCurrent: end === 'Obecnie',
    rawMatched,
  };
}

const ROLE_KEYWORDS = new RegExp(
  '\\b(?:inżynier|programista|developer|monter|spawacz|elektryk|mechanik|kierowca|magazynier|' +
    'operator|technik|specjalista|kierownik|manager|dyrektor|konsultant|analityk|koordynator|' +
    'pracownik|asystent|lektor|sprzedawca|doradca|serwisant|tokarz|ślusarz|murarz|cieśla|' +
    'hydraulik|lekarz|pielęgniarka|księgowa|księgowy|grafik|architekt|lead|senior|junior|' +
    'mid|head|director|tester|qa|devops|administrator|brygadzista|mistrz|automatyk|laborant|' +
    'stażysta|praktykant|handlowiec|spedytor|magazynier-kierowca|operator\\s+cnc|elektromonter|ślusarz\\s*-\\s*spawacz|' +
    'inspektor|konserwator|audytor|dyspozytor|agent|wsparcie\\s+techniczne|it\\s+support|helpdesk|service\\s+desk)\\b',
  'i'
);

const COMPANY_KEYWORDS = new RegExp(
  '\\b(?:sp\\.\\s*z\\s*o\\.o\\.|s\\.a\\.|gmbh|llc|inc\\.|sp\\.k\\.|p\\.h\\.u\\.|firma|zakład|' +
    'przedsiębiorstwo|agencja|centrum|grupa|group|solutions|tech|systems|logistics|studio|' +
    'polska|poland|szpital|urząd|politechnika|uniwersytet|biuro|fabryka|huta|kopalnia|spółka|' +
    'fulfillment|softwarehouse|transport|fintech|dhl|amazon|abb|bank|pekao|pko|santander|ing|mbank|auchan|interia|stocznia)\\b',
  'i'
);

export function isLocationLine(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return (
    // Mianownik (Kraków) + miejscownik (Krakowie) + inne formy gramatyczne
    // Dlaczego: CV zawierają zarówno "Kraków" jak i "Szpital w Krakowie" czy "Lokalizacja: Kraków"
    /^(?:kraków|krakow|krakowie|krakowa|warszawa|warszawie|warszawy|wrocław|wroclaw|wrocławiu|wrocławia|gdańsk|gdansk|gdańsku|gdańska|poznań|poznan|poznaniu|poznania|katowice|katowicach|katowic|łódź|lodz|łodzi|szczecin|szczecinie|szczecina|lublin|lublinie|lublina|bydgoszcz|bydgoszczy|białystok|białymstoku|białegostoku|gdynia|gdyni|częstochowa|częstochowie|częstochowy|radom|radomiu|radomia|toruń|toruniu|torunia|sosnowiec|sosnowcu|sosnowca|kielce|kielcach|kielc|rzeszów|rzeszowie|rzeszowa|gliwice|gliwicach|gliwic|zabrze|zabrzu|olsztyn|olsztynie|olsztyna|bielsko-biała|opole|opolu|opola|tychy|tychach|dąbrowa górnicza|dąbrowie górniczej|elbląg|elblągu|płock|płocku|tarnów|tarnowie|tarnowa|chorzów|chorzowie|koszalin|koszalinie|legnica|legnicy|mielec|mielcu|przemyśl|przemyślu|polska|poland|remote|zdalnie|hybrydowo|stacjonarnie)\b/i.test(t) ||
    /(?:lokalizacja|miejscowość|adres|location|miejsce\s+zamieszkania):/i.test(t) ||
    /\b\d{2}-\d{3}\b/.test(t) ||
    /^(?:ul\.|al\.|os\.|pl\.)\s+[a-ząćęłńóśźż]/i.test(t)
  );
}

export function extractLocationString(text: string): string {
  if (!text) return '';
  const parts = text.split(/\s*[·•|,]\s*|\s+[-–—]\s+/);
  for (const p of parts) {
    if (isLocationLine(p)) return p.trim();
  }
  return text.trim();
}

/**
 * Rozdziela linię lub fragment na Stanowisko i Firmę.
 */
function disambiguateRoleAndCompany(text: string): { role: string; company: string } {
  const cleaned = text.replace(DATE_RANGE_REGEX, '').replace(/[()|;,·•]+$/, '').trim();
  const separators = /\s+[-–—]\s+|\s*[·•|]\s*|\s+w\s+|\s+at\s+/i;
  const parts = cleaned.split(separators).map((p) => p.trim()).filter(Boolean);

  if (parts.length === 0) return { role: '', company: '' };
  if (parts.length === 1) {
    const single = parts[0];
    if (ROLE_KEYWORDS.test(single) && !COMPANY_KEYWORDS.test(single)) {
      return { role: single, company: '' };
    }
    return { role: '', company: single };
  }

  const [p1, p2] = parts;
  const p1IsRole = ROLE_KEYWORDS.test(p1);
  const p2IsRole = ROLE_KEYWORDS.test(p2);
  const p1IsCompany = COMPANY_KEYWORDS.test(p1);
  const p2IsCompany = COMPANY_KEYWORDS.test(p2);

  if (p1IsRole && !p2IsRole) {
    if (isLocationLine(p2)) {
      return { role: p1, company: '' };
    }
    return { role: p1, company: p2 };
  }
  if (p2IsRole && !p1IsRole) {
    return { role: p2, company: p1 };
  }
  if (p1IsCompany && !p2IsCompany) {
    if (isLocationLine(p2)) {
      return { company: p1, role: '' };
    }
    return { company: p1, role: p2 };
  }
  if (p2IsCompany && !p1IsCompany) {
    return { company: p2, role: p1 };
  }

  return { company: p1, role: p2 };
}

/**
 * Grupuje linie sekcji doświadczenia w spójne bloki wpisów.
 */
function parseExperienceEntries(sectionLines: string[]): WorkExperience[] {
  const entries: WorkExperience[] = [];
  if (!sectionLines || sectionLines.length === 0) return entries;

  interface RawExpBlock {
    headerLines: string[];
    dateRange?: ExtractedDateRange;
    bulletLines: string[];
    otherLines: string[];
  }

  const blocks: RawExpBlock[] = [];
  let currentBlock: RawExpBlock | null = null;

  for (let i = 0; i < sectionLines.length; i++) {
    const line = sectionLines[i].trim();
    if (!line) continue;

    const isBullet = /^[-•*►▪●–—+]\s*|^\d+\.\s+/.test(line);
    const dateRange = extractDateRange(line);
    const hasEntrySeparator = /\s+[-–—]\s+|\s*[·•|]\s*/.test(line);

    let startsNewBlock = false;

    if (!currentBlock) {
      startsNewBlock = true;
    } else if (isBullet) {
      startsNewBlock = false;
    } else if (dateRange && currentBlock.dateRange) {
      // Zakres dat w linii oznacza start nowego wpisu pracy
      startsNewBlock = true;
    } else if (
      (ROLE_KEYWORDS.test(line) || COMPANY_KEYWORDS.test(line)) &&
      !/^[a-ząćęłńóśźż]/.test(line) &&
      line.length < 90 &&
      !line.endsWith('.')
    ) {
      const currentHasRole = currentBlock.headerLines.some((hl) => disambiguateRoleAndCompany(hl).role);
      const currentHasCompany = currentBlock.headerLines.some((hl) => disambiguateRoleAndCompany(hl).company);
      if (currentBlock.bulletLines.length > 0 || (currentHasRole && currentHasCompany)) {
        startsNewBlock = true;
      }
    }

    if (startsNewBlock) {
      currentBlock = {
        headerLines: [line],
        dateRange: dateRange || undefined,
        bulletLines: [],
        otherLines: [],
      };
      blocks.push(currentBlock);
      continue;
    }

    if (!currentBlock) continue;

    if (isBullet) {
      const cleanBullet = line.replace(/^[-•*►▪●–—+]\s*|^\d+\.\s+/, '').trim();
      if (cleanBullet) currentBlock.bulletLines.push(cleanBullet);
    } else if (currentBlock.bulletLines.length > 0) {
      // Zawinięta linia poprzedniego punktora
      currentBlock.bulletLines[currentBlock.bulletLines.length - 1] += ' ' + line;
    } else if (dateRange && !currentBlock.dateRange) {
      currentBlock.dateRange = dateRange;
      currentBlock.headerLines.push(line);
    } else if (hasEntrySeparator || ROLE_KEYWORDS.test(line) || COMPANY_KEYWORDS.test(line)) {
      currentBlock.headerLines.push(line);
    } else {
      currentBlock.otherLines.push(line);
    }
  }

  // Przetwarzanie zebranych bloków na obiekty WorkExperience
  for (const block of blocks) {
    let company = '';
    let role = '';
    let location = '';

    // Parsujemy nagłówek
    for (const hLine of block.headerLines) {
      const { role: r, company: c } = disambiguateRoleAndCompany(hLine);
      if (r && !role) role = r;
      if (c && !company) company = c;
    }

    // Jeśli brak roli lub firmy w headerLines, szukamy w otherLines
    if (!role || !company) {
      for (const oLine of block.otherLines.slice(0, 2)) {
        if (!isLocationLine(oLine)) {
          const { role: r, company: c } = disambiguateRoleAndCompany(oLine);
          if (r && !role) role = r;
          if (c && !company) company = c;
        }
      }
    }

    // Szukamy lokalizacji
    for (const line of [...block.headerLines, ...block.otherLines.slice(0, 2)]) {
      if (isLocationLine(line)) {
        location = extractLocationString(line);
      }
    }

    if (!company && !role) {
      const fallback = block.headerLines[0]?.replace(DATE_RANGE_REGEX, '').trim();
      if (fallback) company = fallback;
    }

    const startDate = block.dateRange?.startDate || '';
    const endDate = block.dateRange?.endDate || '';
    const isCurrent = block.dateRange?.isCurrent || endDate === 'Obecnie';

    const highlights: HighlightMetric[] = block.bulletLines.map((text, idx) => ({
      id: `hl_parsed_${Date.now()}_${entries.length}_${idx}`,
      text,
      action: '',
      target: '',
      tool: '',
      metric: '',
      keywords: [],
    }));

    const description = block.otherLines.filter((l) => !isLocationLine(l)).join('\n').trim() || undefined;

    entries.push({
      id: `exp_parsed_${Date.now()}_${entries.length}`,
      company: company || role || 'Firma',
      role: role || company || 'Stanowisko',
      location,
      startDate,
      endDate,
      isCurrent,
      description,
      highlights,
    });
  }

  return entries;
}

const DEGREE_KEYWORDS = new RegExp(
  '\\b(?:inżynier|inż\\.|magister|mgr|licencjat|lic\\.|technik|doktor|dr|bachelor|master|bsc|msc|phd|' +
    'wykształcenie\\s+(?:wyższe|średnie|zawodowe|podstawowe)|zawód|dyplom)\\b',
  'i'
);

const INSTITUTION_KEYWORDS = new RegExp(
  '\\b(?:politechnika|uniwersytet|akademia|szkoła\\s+główna|wyższa\\s+szkoła|zespół\\s+szkół|' +
    'technikum|liceum|zasadnicza\\s+szkoła|branżowa\\s+szkoła|kolegium|centrum\\s+kształcenia|' +
    'university|college|academy|school|institute|instytut)\\b',
  'i'
);

/**
 * Parsuje wpisy wykształcenia z sekcji edukacji.
 */
function parseEducationEntries(sectionLines: string[]): Education[] {
  const entries: Education[] = [];
  if (!sectionLines || sectionLines.length === 0) return entries;

  interface RawEduBlock {
    lines: string[];
    dateRange?: ExtractedDateRange;
  }

  const blocks: RawEduBlock[] = [];
  let currentBlock: RawEduBlock | null = null;

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateRange = extractDateRange(trimmed);
    const hasInst = INSTITUTION_KEYWORDS.test(trimmed);
    const hasDegree = DEGREE_KEYWORDS.test(trimmed);

    if (dateRange || hasInst || (hasDegree && !currentBlock)) {
      if (currentBlock && currentBlock.lines.length === 1 && !currentBlock.dateRange && dateRange) {
        currentBlock.lines.push(trimmed);
        currentBlock.dateRange = dateRange;
        continue;
      }
      currentBlock = {
        lines: [trimmed],
        dateRange: dateRange || undefined,
      };
      blocks.push(currentBlock);
    } else if (currentBlock) {
      currentBlock.lines.push(trimmed);
      if (!currentBlock.dateRange && dateRange) {
        currentBlock.dateRange = dateRange;
      }
    } else {
      currentBlock = {
        lines: [trimmed],
        dateRange: dateRange || undefined,
      };
      blocks.push(currentBlock);
    }
  }

  for (const block of blocks) {
    let institution = '';
    let degree = '';
    let fieldOfStudy = '';

    for (const l of block.lines) {
      const withoutDates = l.replace(DATE_RANGE_REGEX, '').replace(/[()|;,]+$/, '').trim();
      const parts = withoutDates.split(/\s+[-–—]\s+|\s*\|\s*|\s*,\s*/).map((p) => p.trim()).filter(Boolean);

      for (const part of parts) {
        if (INSTITUTION_KEYWORDS.test(part) && !institution) {
          institution = part;
        } else if (DEGREE_KEYWORDS.test(part) && !degree) {
          degree = part;
        } else if (!fieldOfStudy && part.length > 2 && part !== institution && part !== degree) {
          fieldOfStudy = part.replace(/^(?:kierunek|specjalność|profil):\s*/i, '');
        }
      }
    }

    if (!institution && block.lines.length > 0) {
      institution = block.lines[0].replace(DATE_RANGE_REGEX, '').trim();
    }

    entries.push({
      id: `edu_parsed_${Date.now()}_${entries.length}`,
      institution: institution || 'Uczelnia / Szkoła',
      degree: degree || '',
      fieldOfStudy: fieldOfStudy || '',
      startDate: block.dateRange?.startDate || '',
      endDate: block.dateRange?.endDate || '',
    });
  }

  return entries;
}

/**
 * Parsuje sekcję certyfikatów i uprawnień.
 */
function parseCertificationEntries(sectionLines: string[]): Certification[] {
  if (!sectionLines || sectionLines.length === 0) return [];

  return sectionLines
    .map((line) => line.replace(/^[\s#*•►▪●–—_[\]()=~-]+/, '').replace(/^(?:\d{1,2}[.)])\s*/, '').trim())
    .filter((line) => line.length > 2)
    .map((line, index) => {
      const yearMatch = line.match(/(?:19|20)\d{2}/);
      const withoutYear = line.replace(/[(,|-]?\s*(?:19|20)\d{2}\s*[),|]?/, '').trim();
      const parts = withoutYear.split(/\s+[-–—]\s+|\s*\|\s*|\s*,\s*/).map((p) => p.trim()).filter(Boolean);

      return {
        id: `cert_parsed_${Date.now()}_${index}`,
        name: parts[0] ?? withoutYear,
        issuer: parts[1] ?? '',
        date: yearMatch ? yearMatch[0] : undefined,
      };
    });
}

/**
 * Parsuje sekcję języków obcych.
 */
function parseLanguages(sectionLines: string[]): LanguageProficiency[] {
  if (!sectionLines || sectionLines.length === 0) return [];

  const languages: LanguageProficiency[] = [];
  const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2|ojczysty|native|biegły|zaawansowany|średniozaawansowany|podstawowy|komunikatywny)\b/i;

  for (const line of sectionLines) {
    const clean = line.replace(/^[\s#*•►▪●–—_[\]()=~-]+/, '').trim();
    if (!clean || clean.length < 3) continue;

    const parts = clean.split(/\s*[-–—:|]\s*|\s*\(([^)]+)\)/).map((p) => p?.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    const langName = parts[0].replace(/^(?:język|jezyk)\s+/i, '');
    let level: LanguageProficiency['level'] = 'B2';
    let context = '';

    const cefrMatch = clean.match(CEFR_PATTERN);
    if (cefrMatch) {
      const matched = cefrMatch[1].toUpperCase();
      if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(matched)) {
        level = matched as LanguageProficiency['level'];
      } else if (/ojczysty|native/i.test(matched)) {
        level = 'Native';
      } else if (/zaawansowany|biegły/i.test(matched)) {
        level = 'C1';
      } else if (/średniozaawansowany/i.test(matched)) {
        level = 'B2';
      } else if (/podstawowy/i.test(matched)) {
        level = 'A2';
      } else if (/komunikatywny/i.test(matched)) {
        level = 'B1';
      }
      context = clean;
    }

    languages.push({
      id: `lang_parsed_${Date.now()}_${languages.length}`,
      language: langName,
      level,
      context: context || clean,
    });
  }

  return languages;
}

/**
 * Parsuje sekcję projektów.
 */
function parseProjects(sectionLines: string[]): Project[] {
  if (!sectionLines || sectionLines.length === 0) return [];

  const projects: Project[] = [];
  let currentProj: Partial<Project> | null = null;

  for (const line of sectionLines) {
    const clean = line.trim();
    if (!clean) continue;

    const isBullet = /^[-•*►▪●–—+]\s*/.test(clean);
    if (!isBullet && (clean.includes('-') || clean.includes(':') || !currentProj)) {
      if (currentProj?.name) {
        projects.push({
          id: `proj_parsed_${Date.now()}_${projects.length}`,
          name: currentProj.name,
          role: currentProj.role || 'Główny wykonawca',
          description: currentProj.description || '',
          techStack: currentProj.techStack || [],
        });
      }
      const parts = clean.split(/\s*[-–—:|]\s*/).map((p) => p.trim()).filter(Boolean);
      currentProj = {
        name: parts[0],
        role: parts[1] || '',
        description: '',
        techStack: [],
      };
    } else if (currentProj) {
      const bulletText = clean.replace(/^[-•*►▪●–—+]\s*/, '');
      currentProj.description = (currentProj.description ? currentProj.description + '\n' : '') + bulletText;
    }
  }

  if (currentProj?.name) {
    projects.push({
      id: `proj_parsed_${Date.now()}_${projects.length}`,
      name: currentProj.name,
      role: currentProj.role || 'Główny wykonawca',
      description: currentProj.description || '',
      techStack: currentProj.techStack || [],
    });
  }

  return projects;
}

/**
 * Dzieli listę umiejętności na pojedyncze wpisy (po przecinku, średniku, slashu lub punktorach).
 */
/**
 * Zaprzeczenia i puste znaczniki to nie umiejętności: `Brak` w sekcji skills
 * lądował w `hardSkills` i krążył dalej jako „kompetencja" (F13).
 * Porównanie na formie znormalizowanej (bez diakrytyków, `ł` → `l`).
 */
const NON_SKILL_MARKERS = new Set(
  [
    'brak', 'brak danych', 'brak doswiadczenia', 'brak umiejetnosci', 'brak kompetencji',
    'nie dotyczy', 'nd', 'n/a', 'none', 'brak opisu',
  ].map((s) => s.toLowerCase())
);

function isNonSkillMarker(item: string): boolean {
  const norm = item
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim();
  return NON_SKILL_MARKERS.has(norm);
}

function parseSkillList(sectionLines: string[]): string[] {
  if (!sectionLines || sectionLines.length === 0) return [];

  const skills: string[] = [];

  for (const line of sectionLines) {
    const cleanLine = line.replace(/^[\s#*•►▪●–—_[\]()=~-]+/, '').replace(/^(?:\d{1,2}[.)])\s*/, '').trim();
    if (!cleanLine) continue;

    const content = cleanLine.includes(':') ? cleanLine.split(':')[1].trim() : cleanLine;
    const items = content.split(/[,;/|•►▪●\n]/).map((s) => s.trim()).filter(Boolean);

    for (const item of items) {
      if (item.length >= 2 && item.length <= 60 && !item.toLowerCase().startsWith('np.') && !isNonSkillMarker(item)) {
        skills.push(item);
      }
    }
  }

  return Array.from(new Set(skills));
}

/**
 * Uniwersalny leksykon słów kluczowych i narzędzi (IT, branże techniczne, zawody fizyczne, biurowe).
 */
const COMPREHENSIVE_SKILL_LEXICON = [
  // IT & Software
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'SQL', 'PostgreSQL', 'Docker', 'AWS', 'Tailwind',
  'HTML', 'CSS', 'Git', 'REST API', 'GraphQL', 'Next.js', 'Vue.js', 'Angular', 'Java', 'Spring Boot', 'C#',
  '.NET', 'PHP', 'Laravel', 'Django', 'FastAPI', 'Kubernetes', 'Linux', 'GCP', 'Azure', 'MongoDB', 'Redis',
  'Jira', 'Figma', 'CI/CD', 'Jenkins', 'Terraform', 'Microservices', 'Webpack', 'Vite', 'Postman',
  // Blue-collar, Techniczne, HVAC, Budownictwo, Spawalnictwo
  'Spawanie TIG', 'Spawanie MIG/MAG', 'Spawanie MMA', 'TIG 141', 'MIG 131', 'MAG 135', 'Uprawnienia SEP',
  'SEP E+D', 'SEP do 1kV', 'F-Gazy', 'UDT', 'Wózki widłowe', 'Wózek widłowy UDT', 'Obsługa suwnic',
  'Montaż instalacji sanitarnych', 'Montaż rurociągów', 'Pomiary elektryczne', 'Prefabrykacja szaf',
  'Automatyka przemysłowa', 'Programowanie PLC', 'Rysunek techniczny', 'Obsługa maszyn CNC',
  'Tokarka CNC', 'Frezarka CNC', 'Analizator spalin', 'Próby ciśnieniowe', 'Lutowanie twarde',
  'Diagnostyka HVAC', 'Kocioł gazowy', 'Pompy ciepła', 'Klimatyzacja', 'Wentylacja',
  // Transport, Magazyn, Logistyka
  'Prawo jazdy kat. B', 'Prawo jazdy kat. C', 'Prawo jazdy kat. C+E', 'KOD 95', 'Karta kierowcy',
  'ADR', 'System WMS', 'Inwentaryzacja', 'Kompletacja zamówień', 'Obsługa skanera',
  // Finanse, Administracja, Sprzedaż, Zarządzanie
  'Płatnik', 'Enova', 'Symfonia', 'SAP', 'Excel', 'Optima', 'Księgowość pełna', 'Kadry i płace',
  'Deklaracje ZUS', 'Deklaracje VAT', 'Negocjacje handlowe', 'Obsługa CRM', 'Scrum', 'Agile',
  'Zarządzanie projektami', 'Budżetowanie', 'Zarządzanie ryzykiem',
];

const TOOLS_AND_TECH_PATTERNS = [
  /git/i, /docker/i, /kubernetes/i, /aws/i, /azure/i, /gcp/i, /jira/i, /figma/i, /postman/i,
  /enova/i, /płatnik/i, /platnik/i, /symfonia/i, /sap/i, /excel/i, /autocad/i, /solidworks/i,
  /wms/i, /plc/i, /cnc/i, /sep/i, /udt/i, /f-gaz/i, /analizator/i, /suwmiarka/i, /oscyloskop/i,
];

/**
 * Sprawdza czy tekst dokumentu zawiera alfabet cyrylicki (np. ukraińskie, białoruskie lub rosyjskie CV).
 * Pozwala zidentyfikować sytuację, w której użytkownik wkleił CV w cyrylicy na polskim rynku pracy.
 */
export function detectCyrillicScript(text: string): {
  hasCyrillic: boolean;
  count: number;
  ratio: number;
  message?: string;
} {
  const cyrillicMatches = text.match(/[\u0400-\u04FF\u0500-\u052F]/g);
  const count = cyrillicMatches ? cyrillicMatches.length : 0;
  const letters = text.replace(/[^a-zA-Z\u0400-\u04FF\u0500-\u052F\u0100-\u017F]/g, '');
  const ratio = letters.length > 0 ? count / letters.length : 0;

  const hasCyrillic = count >= 6 || ratio > 0.04;
  const message = hasCyrillic
    ? 'Wykryto alfabet cyrylicki (cyrylicę). Parser CV obsługuje wyłącznie dokumenty sporządzone w alfabecie łacińskim (polski i angielski). Wprowadź dane ręcznie lub wklej wersję przetłumaczoną.'
    : undefined;

  return {
    hasCyrillic,
    count,
    ratio,
    message,
  };
}

/**
 * Główna funkcja parsowania tekstu CV do struktury MasterVault.
 */
export function parseTextToMasterVault(text: string | undefined | null, format: string = 'TXT'): ParsedCVResult {
  const safeText = typeof text === 'string' ? text : String(text || '');
  if (!safeText.trim()) {
    return {
      personalInfo: {
        fullName: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        summary: '',
      },
      hardSkills: [],
      softSkills: [],
      toolsAndTech: [],
      certifications: [],
      history: [],
      education: [],
      languages: [],
      projects: [],
      rawText: safeText,
      detectedFormat: format,
      hasCyrillicScript: false,
      warnings: [],
    };
  }

  const cyrillicInfo = detectCyrillicScript(safeText);
  const warnings: string[] = [];
  if (cyrillicInfo.hasCyrillic && cyrillicInfo.message) {
    warnings.push(cyrillicInfo.message);
  }

  const unwrapped = unwrapTwoColumnText(safeText);
  const clean = normalizeDocumentText(unwrapped);
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. Ekstrakcja Emaila
  const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // 2. Ekstrakcja Telefonu (unikanie mylenia z latami w datach np. 2018-2022)
  const phoneMatch = clean.match(/(?:(?:\+48|0048)\s*)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\b\d{9}\b)/);
  const phone = phoneMatch && !phoneMatch[0].includes('201') && !phoneMatch[0].includes('202') ? phoneMatch[0].trim() : '';

  // 3. Podział na sekcje
  const sections = splitIntoSections(lines);

  // 4. Ekstrakcja Imienia i Nazwiska (z nagłówka, ignorując maile, telefony, linki i szum)
  let fullName = '';
  const headerLines = (sections.header && sections.header.length > 0) ? sections.header : lines.slice(0, 8);
  for (const line of headerLines) {
    if (/(?:curriculum|życiorys|resume|klauzula|zgoda\s+na\s+przetwarzanie|here\s+is|system:|assistant|bot|```|[{}]|ignore\s+previous|drop\s+table)/i.test(line)) continue;
    const cleanedLine = line
      .replace(/<[^>]+>/g, '')
      .replace(/[\p{Extended_Pictographic}\u{FE00}-\u{FE0F}§¤»«¬▪►●•]/gu, '')
      .replace(/^[\s#*•►▪●–—_>`[\]()=~/.-]+/, '')
      .replace(/[\s#*•►▪●–—_`<[\]()=~/.-]+$/, '')
      .trim();

    const candidate = cleanedLine
      .split(/\s*[\t|(;]|(?:\b(?:email|e-mail|mail|tel|telefon|kontakt|adres|miejscowość|lokalizacja|location|city):\s*)/i)[0]
      .replace(/<[^>]+>/g, '')
      .replace(/[\p{Extended_Pictographic}\u{FE00}-\u{FE0F}§¤»«¬▪►●•]/gu, '')
      .replace(/[(),:;`]+$/, '')
      .trim();

    const words = candidate.split(/\s+/).filter(Boolean);

    if (
      candidate.length >= 3 &&
      candidate.length <= 45 &&
      words.length >= 1 &&
      words.length <= 4 &&
      !candidate.includes('@') &&
      !candidate.includes('http') &&
      !candidate.includes('www.') &&
      !candidate.startsWith('{') &&
      !candidate.startsWith('[') &&
      !candidate.match(/\d{3,}/) &&
      !/(?:cv|curriculum|życiorys|resume|kandydat|dane\s+osobowe|informacje|here\s+is|json|system:|assistant|bot|fake|lokalizacja|location|adres)/i.test(candidate) &&
      !/^(?:senior|junior|lead|mid|staff|principal)?\s*(?:full\s*stack|frontend|backend|devops|python|java|react|cloud|inżynier|programista)\s*(?:developer|engineer|architekt)?$/i.test(candidate)
    ) {
      fullName = candidate;
      break;
    }
  }

  // 5. Ekstrakcja Historii, Edukacji, Certyfikatów, Języków, Projektów
  const history = parseExperienceEntries(sections.experience ?? []);
  // Kwarantanna dat: odwrócone i przyszłe zakresy zostają we wpisie (żeby nic
  // nie ginęło po cichu), ale z ostrzeżeniem i poza stażem — liczenie stażu
  // (`lib/experience.ts`, telemetria, HUD) takie wpisy pomija (F5/F13).
  const currentYear = new Date().getFullYear();
  for (const exp of history) {
    const startYear = /((?:19|20)\d{2})/.exec(exp.startDate || '')?.[1];
    const endYear = /((?:19|20)\d{2})/.exec(exp.endDate || '')?.[1];
    if (startYear && endYear && Number(startYear) > Number(endYear)) {
      warnings.push(
        `Odwrócony zakres dat w "${exp.company}": ${exp.startDate} – ${exp.endDate}. Wpis wykluczony ze stażu.`
      );
    } else if (startYear && Number(startYear) > currentYear) {
      warnings.push(
        `Przyszła data początkowa w "${exp.company}": ${exp.startDate}. Wpis wykluczony ze stażu.`
      );
    }
  }
  const education = parseEducationEntries(sections.education ?? []);
  const certLines = [...(sections.certifications ?? [])];

  if (sections.skills) {
    for (const sLine of sections.skills) {
      if (/(?:certyfikat|świadectwo|swiadectwo|uprawnienia|licencja|kurs|prawo\s+jazdy|sep|udt|f-gaz).*(?:19|20)\d{2}/i.test(sLine)) {
        if (!certLines.includes(sLine)) {
          certLines.push(sLine);
        }
      }
    }
  }

  const certifications = parseCertificationEntries(certLines);
  const languages = parseLanguages(sections.languages ?? []);
  const projects = parseProjects(sections.projects ?? []);

  // 6. Ekstrakcja Stanowiska (Title)
  const explicitTitleMatch = clean.match(/(?:stanowisko|tytuł|specjalność|rola|job\s+title):\s*([^\n]+)/i);
  const title = explicitTitleMatch
    ? explicitTitleMatch[1].trim()
    : history.length > 0 && history[0].role
    ? history[0].role
    : (clean.match(ROLE_KEYWORDS)?.[0]?.trim() || '');

  // 7. Ekstrakcja Lokalizacji
  const explicitLocMatch = clean.match(/(?:lokalizacja|miejscowość|adres|location|miejsce\s+zamieszkania):\s*([^\n,]+)/i);
  let location = explicitLocMatch ? explicitLocMatch[1].trim() : '';
  if (!location) {
    // Szukamy nazwy miasta w częściach linii nagłówka rozdzielonych separatorami.
    // Wiele CV ma format: "Telefon: ... | E-mail: ... | Kraków" — wtedy
    // `isLocationLine` na pełnej linii zwraca false, ale na fragmencie "Kraków" — true.
    for (const hLine of headerLines) {
      if (isLocationLine(hLine)) {
        location = extractLocationString(hLine);
        break;
      }
      const parts = hLine.split(/\s*[|·•]\s*|\s+[-–—]\s+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && isLocationLine(trimmed)) {
          location = trimmed;
          break;
        }
      }
      if (location) break;
    }
  }

  // 8. Ekstrakcja Podsumowania (Summary)
  const summaryMatch = clean.match(/(?:podsumowanie(?:\s+zawodowe)?|o\s+sobie|o\s+mnie|profil(?:\s+(?:zawodowy|osobowy|kandydata))?|summary):\s*([^\n]+(?:\n[^\n]+){0,4})/i);
  const summary = summaryMatch
    ? summaryMatch[1].trim()
    : (sections.summary ?? []).join('\n').trim();

  // 9. Ekstrakcja Umiejętności (Twarde, Miękkie, Narzędzia)
  const extractedSkillsFromSection = parseSkillList(sections.skills ?? []);
  const hardSkillsSet = new Set<string>(extractedSkillsFromSection);
  const toolsAndTechSet = new Set<string>();

  // Dodatkowe skanowanie leksykonu po tekście, by nie zgubić technologii
  for (const kw of COMPREHENSIVE_SKILL_LEXICON) {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(clean)) {
      hardSkillsSet.add(kw);
    }
  }

  for (const skill of Array.from(hardSkillsSet)) {
    if (TOOLS_AND_TECH_PATTERNS.some((pattern) => pattern.test(skill))) {
      toolsAndTechSet.add(skill);
    }
  }

  const softSkills = parseSkillList(sections.softSkills ?? []);

  return {
    personalInfo: {
      fullName,
      title,
      email,
      phone,
      location,
      summary,
    },
    hardSkills: Array.from(hardSkillsSet),
    softSkills,
    toolsAndTech: Array.from(toolsAndTechSet),
    certifications,
    history,
    education,
    languages: languages.length > 0 ? languages : undefined,
    projects: projects.length > 0 ? projects : undefined,
    rawText: clean,
    detectedFormat: format,
    hasCyrillicScript: cyrillicInfo.hasCyrillic,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
