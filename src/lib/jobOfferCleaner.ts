/**
 * Moduł do oczyszczania i normalizacji tekstu ofert pracy wklejanych ze schowka (Ctrl+A / Ctrl+C)
 * z portali rekrutacyjnych (OLX, Pracuj.pl, itp.).
 *
 * Wykrywa wzorce:
 * 1. Head Noise: skip links, breadcrumbs, linki do czatu/konta, badge promowania/odświeżenia.
 * 2. Tail Cutoff Boundary: odcięcie zbędnych powiązanych ogłoszeń, stopek, ID ogłoszenia, RODO i ciasteczek.
 * 3. Key-Value Harvesting: ekstrakcja bloków dwuliniowych (Lokalizacja, Wynagrodzenie, Typ umowy, Wymiar).
 * 4. Title & Company Detection: separacja tytułu i firmy od treści oferty.
 */

export interface CleanedOfferResult {
  title: string;
  company: string;
  location: string;
  salary: string;
  contract: string;
  workTime: string;
  cleanText: string;
  hasNoiseRemoved: boolean;
  rawLength: number;
  cleanLength: number;
}

export const CRAWLER_META_PATTERNS: RegExp[] = [
  /^##\s+(?:Clipboard|Oferta|Chrome tab|Tab)\b/i,
  /^-\s*(?:[Źz]ródło|Kategoria listy|URL|Szczegóły HTTP|Liczba bajtów)\b/i,
  /^###\s+(?:Surowa karta listowa|Tekst strony szczegółowej)\b/i,
  /^Ctrl\+A,\s*Ctrl\+C;/i,
  /^Akcja:\s*Ctrl\+A/i,
  /^URL:\s*https?:\/\//i,
  /^<browser__document__url>.*<\/browser__document__url>$/i,
  /^<browser__document__title>.*<\/browser__document__title>$/i,
  /^<\/?(?:browser__document__\w+|user__selection)>$/i,
];

export const HEAD_NOISE_PATTERNS: RegExp[] = [
  /^przejdź do (?:głównej części|stopki|treści ogłoszenia|panelu aplikowania|panelu bocznego)/i,
  /^czat(?:\s+z\s+pracodawcą)?$/i,
  /^powiadomienia$/i,
  /^twoje konto$/i,
  /^dodaj ogłoszenie$/i,
  /^dla (?:biznesu|firm|pracowników|pracodawców|kandydatów)\b/i,
  /^asystent pracuj\.pl$/i,
  /^sprawdź,? jak dobrze ta oferta do ciebie pasuje$/i,
  /^podsumowanie oferty$/i,
  /^dodatkowe informacje$/i,
  /^przewiń do profilu firmy$/i,
  /^(?:zobacz|nowość|polecana|popularna)$/i,
  /^(?:samochód|komunikacja(?:\s+miejska)?|rower|pieszo)\s*$/i,
  /^[-–—\s=_*]+$/,
  /^https?:\/\//i,
  /^strona główna\s*praca/i,
  /^odświeżono (?:dzisiaj|dnia|wczoraj)\b/i,
  /^dodane (?:dzisiaj|dnia|wczoraj)\b/i,
  /^ważna jeszcze\b/i,
  /^\(do \d+ [a-ząćęłńóśźż]+\)$/i,
  /^valid for \d+ days/i,
  /^\(to \d+ \w+\)$/i,
  /^static map$/i,
  /^wskazówki dojazdu$/i,
  /^rekrutacja(?:\s+zdalna)?$/i,
  /^praca od zaraz$/i,
  /^szukamy wielu kandydatów$/i,
  /^sprawdź czas dojazdu$/i,
  /^zlokalizuj się lub podaj dokładny adres$/i,
  /^siedziba firmy$/i,
  /^dowiedz się więcej$/i,
  /^pokaż numer pracodawcy$/i,
  /^zaloguj się/i,
  /^(?:aplikuj|aplikuj teraz|aplikuj szybko)$/i,
  /^drukuj$/i,
  /^udostępnij$/i,
  /^zapisz$/i,
  /^(?:pracuj\.pl|aplikuj\.pl|olx\.pl)$/i,
  /^(?:oferty pracy|pracodawcy|porady|porady dla pracowników|porady dla pracodawców|narzędzia|pобота|profile pracodawców|porady i narzędzia|moje konto)$/i,
  /^(?:kreator cv|wzory cv|wzory dokumentów|kalkulator wynagrodzeń|profil pracodawcy 360°?|aplikuj check|aplikuj connect|konto kandydata|menu)$/i,
  /^oferta pracy\s+.*,\s+.*(?:aplikuj\.pl|pracuj\.pl|olx\.pl)$/i,
];

export const TAIL_CUTOFF_PATTERNS: RegExp[] = [
  /^id:\s*\d+/i,
  /^zgłoś(?:\s+naruszenie|\s+błąd)?\b/i,
  /^wyświetlenia:\s*\d+/i,
  /^więcej (?:od tego ogłoszeniodawcy|ofert od tego pracodawcy)\b/i,
  /^(?:sprawdź\s+)?podobne (?:ogłoszenia|oferty)\b/i,
  /^zobacz (?:także|też|pełny profil firmy)\b/i,
  /^inne oferty (?:tego|pracy)\b/i,
  /^(?:chcesz )?dowiedzieć się więcej o firmie\?/i,
  /^pokaż więcej podobnych\b/i,
  /^włącz powiadomienie\b/i,
  /^rekruter\b/i,
  /^osoba do kontaktu\b/i,
  /^(?:masz )?pytanie do pracodawcy\b/i,
  /^zadaj pytanie\b/i,
  /^na olx od\b/i,
  /^ostatnio online\b/i,
  /^darmowa aplikacja na twój telefon\b/i,
  /^(?:aplikacje mobilne|pobierz aplikację)\b/i,
  /^(?:google play|app store|download on the app store|get it on google play)\b/i,
  /^olx\.(?:pl|bg|ro|ua|pt)\b/i,
  /^otodom\.pl\b/i,
  /^otomoto\.pl\b/i,
  /^obido\.pl\b/i,
  /^(?:©|&copy;)?\s*grupa pracuj s\.a\./i,
  /^(?:the network|the protocol|erecruiter|robota\.ua|kadromierz|absence|softgarden)\b/i,
  /^tak się u nas pracuje\b/i,
  /^polityka prywatności\b/i,
  /^polityka plików cookies\b/i,
  /^akt o usługach cyfrowych\b/i,
  /^ustawienia plików cookies?\b/i,
  /^(?:regulamin|regulamin serwisu)\b/i,
  /^zasady bezpieczeństwa\b/i,
  /^mapa (?:kategorii|miejscowości|ministron)\b/i,
  /^popularne wyszukiwania\b/i,
  /^zawodowo olx\b/i,
  /^dla (?:kandydatów|firm)\b/i,
  /^konto pracodawcy\b/i,
  /^festiwal pracy\b/i,
  /^dziękujemy za przesłanie aplikacji\. informujemy/i,
  /^informujemy, że skontaktujemy się tylko z wybranymi/i,
  /^zastrzegamy sobie prawo do kontaktu/i,
  /^prosimy o dopisanie następującej klauzuli/i,
  /^wyrażam zgodę na przetwarzanie (?:moich )?danych osobowych/i,
  /^klikając w przycisk „aplikuj”/i,
  /^aplikacje powinny zawierać klauzulę/i,
  /^współadministratorami twoich danych osobowych są/i,
  /^pełną informację odnośnie przetwarzania twoich danych/i,
  /^wszystkie informacje o przetwarzaniu danych osobowych/i,
  /^aplikuj na to ogłoszenie\b/i,
];

const ATTACHED_VOIVODESHIP_RE = /^(Warszawa|Kraków|Wrocław|Poznań|Gdańsk|Gdynia|Sopot|Łódź|Katowice|Szczecin|Lublin|Białystok|Bydgoszcz|Toruń|Rzeszów|Kielce|Olsztyn|Opole|Zielona Góra|Gorzów)(mazowieckie|małopolskie|dolnośląskie|wielkopolskie|pomorskie|łódzkie|śląskie|zachodniopomorskie|lubelskie|podlaskie|kujawsko-pomorskie|podkarpackie|świętokrzyskie|warmińsko-mazurskie|opolskie|lubuskie)$/i;

function stripHtmlAndEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#39|#039);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Czyści wklejony tekst ogłoszenia z portalu ze zbędnych elementów i szumu.
 */
export function cleanPastedJobOffer(rawText: string): CleanedOfferResult {
  if (!rawText || !rawText.trim()) {
    return {
      title: '',
      company: '',
      location: '',
      salary: '',
      contract: '',
      workTime: '',
      cleanText: '',
      hasNoiseRemoved: false,
      rawLength: 0,
      cleanLength: 0,
    };
  }

  const sanitized = stripHtmlAndEntities(rawText);
  const rawLines = sanitized.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.filter((line) => !CRAWLER_META_PATTERNS.some((p) => p.test(line)));

  // Krok 1: Odetnij nagłówki portalowe od góry
  let startIdx = 0;
  while (startIdx < lines.length) {
    const line = lines[startIdx];
    if (HEAD_NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
      startIdx += 1;
    } else {
      break;
    }
  }

  const filtered = lines.slice(startIdx);

  // Krok 2: Odetnij ogon od dołu przy pierwszym wystąpieniu markera ogona
  let cutoffIdx = filtered.length;
  for (let idx = 0; idx < filtered.length; idx += 1) {
    const line = filtered[idx];
    if (TAIL_CUTOFF_PATTERNS.some((pattern) => pattern.test(line))) {
      cutoffIdx = idx;
      break;
    }
  }

  const bodyLines = filtered.slice(0, cutoffIdx);

  // Usuń pojedyncze 'Aplikuj' / 'Aplikuj teraz' na końcu, jeśli zostało
  while (bodyLines.length > 0 && /^(?:aplikuj|aplikuj teraz|aplikuj szybko)\s*$/i.test(bodyLines[bodyLines.length - 1])) {
    bodyLines.pop();
  }

  // Krok 3: Wyciągnij metadane portalowe dwuliniowe (OLX / Pracuj.pl)
  let title = '';
  let company = '';
  let location = '';
  let salary = '';
  let contract = '';
  let workTime = '';

  const remainingBody: string[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];

    // Odrzuć ewentualny szum nagłówkowy, który pojawił się głębiej w ofercie
    if (HEAD_NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
      i += 1;
      continue;
    }

    // Wykrywanie sklejonych miast Pracuj.pl (np. "Warszawamazowieckie")
    const voivodeshipMatch = line.match(ATTACHED_VOIVODESHIP_RE);
    if (voivodeshipMatch && !location) {
      location = voivodeshipMatch[1];
      i += 1;
      continue;
    }

    // Klucze dwuliniowe OLX
    if (/^wynagrodzenie:?$/i.test(line) && i + 1 < bodyLines.length) {
      salary = bodyLines[i + 1];
      i += 2;
      continue;
    }
    if (/^lokalizacja:?$/i.test(line) && i + 1 < bodyLines.length) {
      if (!location) {
        location = bodyLines[i + 1];
      }
      i += 2;
      continue;
    }
    if (/^wymiar pracy:?$/i.test(line) && i + 1 < bodyLines.length) {
      workTime = bodyLines[i + 1];
      i += 2;
      continue;
    }
    if (/^typ umowy:?$/i.test(line) && i + 1 < bodyLines.length) {
      contract = bodyLines[i + 1];
      i += 2;
      continue;
    }

    remainingBody.push(line);
    i += 1;
  }

  // Krok 4: Wykrywanie tytułu i firmy z pierwszych linii remainingBody
  if (remainingBody.length > 0) {
    const first = remainingBody[0];
    const second = remainingBody[1] || '';
    const third = remainingBody[2] || '';

    // Wariant Pracuj.pl:
    // Linia 1: Firma
    // Linia 2: Stanowisko
    // Linia 3: FirmaO firmie
    const thirdHasCompanyHeader = /^(?:o firmie|about the company)$/i.test(third) ||
      /(?:o firmie|about the company)\s*$/i.test(third);

    if (thirdHasCompanyHeader && third.toLocaleLowerCase('pl-PL').includes(first.toLocaleLowerCase('pl-PL').slice(0, 10))) {
      company = first.replace(/\s*(?:o firmie|about the company)\s*$/i, '').trim();
      title = second;
      remainingBody.splice(0, 3);
    } else {
      // Czy pierwsza linia to "Firma O firmie"?
      const firstCompanyMatch = first.match(/^(.{2,100}?)\s*(?:o firmie|about the company)\s*$/i);
      if (firstCompanyMatch) {
        company = firstCompanyMatch[1].trim();
        if (remainingBody.length > 1) {
          title = remainingBody[1];
          remainingBody.splice(0, 2);
        } else {
          remainingBody.splice(0, 1);
        }
      } else if (remainingBody.length > 1 && /(?:o firmie|about the company)\s*$/i.test(second)) {
        // Druga linia to "Firma O firmie"
        company = second.replace(/\s*(?:o firmie|about the company)\s*$/i, '').trim();
        title = first;
        remainingBody.splice(0, 2);
      } else {
        // Pierwsza linia to tytuł stanowiska (np. OLX)
        title = first;
        remainingBody.splice(0, 1);

        // Czy kolejna linia to nazwa firmy (np. "SVBL Tomasz Ziemiński", "JobmanGroup...")?
        if (remainingBody.length > 0) {
          const nextCandidate = remainingBody[0];
          const isSectionStart = /^(?:opis|o nas|oferujemy|wymagania|zakres|obowiązki|twoje|nasze|co oferujemy|czego oczekujemy)\b/i.test(nextCandidate);
          const isNoise = HEAD_NOISE_PATTERNS.some((p) => p.test(nextCandidate));
          if (!isSectionStart && !isNoise && nextCandidate.length < 80) {
            company = nextCandidate.replace(/\s*dowiedz się więcej\s*$/i, '').trim();
            remainingBody.splice(0, 1);
          }
        }
      }
    }
  }

  // Oczyszczenie ciała oferty z pozostałości technicznych (np. "Opis", "Static Map", adresy mapy)
  const cleanBodyLines = remainingBody.filter((line) => {
    if (/^(?:static map|wskazówki dojazdu)$/i.test(line)) return false;
    if (/^(?:opis|opis stanowiska)\s*$/i.test(line)) return false;
    if (/^(?:aplikuj|aplikuj teraz|aplikuj szybko|pokaż numer pracodawcy|zapisz|drukuj|udostępnij)\s*$/i.test(line)) return false;
    return true;
  });

  const headerParts: string[] = [];
  if (title) headerParts.push(title);
  if (company) headerParts.push(`${company} O firmie`);
  if (location) headerParts.push(`Lokalizacja: ${location}`);
  if (salary) headerParts.push(`Wynagrodzenie: ${salary}`);
  if (contract) headerParts.push(`Typ umowy: ${contract}`);
  if (workTime) headerParts.push(`Wymiar pracy: ${workTime}`);

  const fullCleanLines = [...headerParts, ...cleanBodyLines];
  const cleanText = fullCleanLines.join('\n').trim();
  const hasNoiseRemoved = lines.length !== fullCleanLines.length || cutoffIdx < filtered.length;

  return {
    title: title.trim(),
    company: company.trim(),
    location: location.trim(),
    salary: salary.trim(),
    contract: contract.trim(),
    workTime: workTime.trim(),
    cleanText,
    hasNoiseRemoved,
    rawLength: rawText.length,
    cleanLength: cleanText.length,
  };
}
