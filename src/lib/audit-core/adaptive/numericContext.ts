export type NumericContextClass =
  | 'IMPACT_METRIC'
  | 'SCALE_METRIC'
  | 'DURATION'
  | 'DATE_OR_YEAR'
  | 'VERSION_OR_MODEL'
  | 'PRICE_OR_NAME_FRAGMENT'
  | 'UNKNOWN_NUMBER';

export interface NumericContextResult {
  raw: string;
  classification: NumericContextClass;
  confidence: number;
  reason: string;
}

const YEAR_RE = /^(?:19|20)\d{2}$/;
const DATE_CONTEXT_RE = /(?:^|\b)(?:od|do|since|from|until|obecnie|present|styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;
const DURATION_RE = /\b(?:rok|lata|lat|miesiąc|miesiące|miesięcy|tydzień|tygodnie|years?|months?|weeks?)\b/i;
const VERSION_RE = /\b(?:windows|office|m365|o365|s7|v\.?\s*\d|version|wersja|release|model|iso|iatf|wcag|http|tls)\b/i;
const IMPACT_VERB_RE = /\b(?:zwiększ|wzrost|obniż|zmniejsz|redukc|skróc|oszczęd|popraw|podnies|utrzym|osiągn|pozysk|wdroż|zrealiz|processed|increased|reduced|saved|improved|grew|cut|delivered|achieved)\w*/i;
const SCALE_NOUN_RE = /\b(?:klient|użytkownik|pracownik|projekt|transakcj|faktur|zgłosze|ticket|zapyt|rynk|kraj|oddział|lokalizacj|rekord|dokument|zamówie|users?|clients?|employees?|projects?|transactions?|tickets?|requests?)\w*/i;
const MONEY_RE = /\b(?:pln|zł|zl|eur|usd|gbp|rub|tys\.?|mln|mld|k|million|billion)\b/i;
const PERCENT_RE = /%|procent/i;

function normalize(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function classifyNumericContext(rawNumber: string, context: string): NumericContextResult {
  const raw = normalize(rawNumber);
  const ctx = normalize(context);
  const numeric = raw.replace(/\s/g, '').replace(',', '.');

  if (YEAR_RE.test(numeric) && (DATE_CONTEXT_RE.test(ctx) || /[-–—/]\s*(?:19|20)\d{2}/.test(ctx))) {
    return { raw, classification: 'DATE_OR_YEAR', confidence: 0.98, reason: 'Liczba zachowuje się jak rok lub element zakresu dat.' };
  }
  if (DURATION_RE.test(ctx) && !IMPACT_VERB_RE.test(ctx)) {
    return { raw, classification: 'DURATION', confidence: 0.93, reason: 'Liczba opisuje staż lub czas trwania, nie rezultat.' };
  }
  if (VERSION_RE.test(ctx) && !IMPACT_VERB_RE.test(ctx)) {
    return { raw, classification: 'VERSION_OR_MODEL', confidence: 0.9, reason: 'Liczba występuje przy wersji, modelu lub standardzie technicznym.' };
  }
  if (IMPACT_VERB_RE.test(ctx) && (PERCENT_RE.test(ctx) || MONEY_RE.test(ctx))) {
    return { raw, classification: 'IMPACT_METRIC', confidence: 0.97, reason: 'Kontekst łączy działanie/rezultat z procentem lub wartością ekonomiczną.' };
  }
  if (IMPACT_VERB_RE.test(ctx) && SCALE_NOUN_RE.test(ctx)) {
    return { raw, classification: 'IMPACT_METRIC', confidence: 0.88, reason: 'Kontekst łączy rezultat z mierzalną skalą działania.' };
  }
  if (SCALE_NOUN_RE.test(ctx)) {
    return { raw, classification: 'SCALE_METRIC', confidence: 0.86, reason: 'Liczba opisuje skalę odpowiedzialności lub wolumen.' };
  }
  if (MONEY_RE.test(ctx)) {
    const brandedPrice = /\b(?:99|24|7)\s*(?:zł|zl)\b/i.test(ctx) && !IMPACT_VERB_RE.test(ctx);
    if (brandedPrice) {
      return { raw, classification: 'PRICE_OR_NAME_FRAGMENT', confidence: 0.82, reason: 'Kwota bez kontekstu rezultatu może być ceną lub fragmentem nazwy własnej.' };
    }
    return { raw, classification: 'SCALE_METRIC', confidence: 0.78, reason: 'Kwota opisuje skalę finansową, ale brak wystarczającego dowodu rezultatu.' };
  }
  if (YEAR_RE.test(numeric)) {
    return { raw, classification: 'DATE_OR_YEAR', confidence: 0.82, reason: 'Czterocyfrowa liczba w zakresie lat jest domyślnie traktowana jako rok.' };
  }
  return { raw, classification: 'UNKNOWN_NUMBER', confidence: 0.45, reason: 'Brak wystarczającego kontekstu do uznania liczby za metrykę wpływu.' };
}

export function numericContextWeight(result: NumericContextResult): number {
  switch (result.classification) {
    case 'IMPACT_METRIC': return 1;
    case 'SCALE_METRIC': return 0.55;
    case 'UNKNOWN_NUMBER': return 0.1;
    default: return 0;
  }
}
