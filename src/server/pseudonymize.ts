import type { MasterVault } from '../types';

/**
 * Pseudonimizacja na granicy modelu.
 *
 * Google jest podmiotem przetwarzającym, więc im mniej danych identyfikujących
 * przekroczy tę granicę, tym mniejszy zakres powierzenia. Dane, których nie
 * wysłaliśmy, nie wyciekną i nie trafią do żadnego logu po drugiej stronie.
 *
 * Zamiana jest odwracalna **tylko w pamięci jednego żądania**: mapa
 * placeholderów nigdzie się nie zapisuje, a `rehydrate` podstawia prawdziwe
 * wartości dopiero w wyniku wracającym do użytkownika — inaczej list
 * motywacyjny wyszedłby zaadresowany do `[KANDYDAT]`.
 */

export type PlaceholderMap = Map<string, string>;

export interface PseudonymizedText {
  text: string;
  map: PlaceholderMap;
}

/**
 * Kolejność ma znaczenie: dłuższe i bardziej szczegółowe wzorce idą pierwsze,
 * inaczej `[EMAIL]` zjadłby fragment, który miał trafić do `[LINK]`.
 */
const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'EMAIL', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // PESEL: 11 cyfr pod rząd. Sprawdzany przed telefonem, bo telefon też jest cyfrowy.
  { label: 'ID', regex: /\b\d{11}\b/g },
  { label: 'LINK', regex: /\bhttps?:\/\/[^\s<>"']+/g },
  {
    label: 'TELEFON',
    // Polskie i międzynarodowe formaty: +48 600 700 800, 600-700-800, (12) 345 67 89
    regex: /(?:\+\d{1,3}[\s-]?)?(?:\(\d{1,4}\)[\s-]?)?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,4}\b/g,
  },
];

function makePlaceholder(label: string, index: number): string {
  return `[${label}${index > 0 ? `_${index + 1}` : ''}]`;
}

/**
 * Zastępuje dane identyfikujące placeholderami.
 *
 * `extraValues` to wartości znane z profilu (imię, miasto), których nie da się
 * złapać wyrażeniem regularnym — nazwisko wygląda jak każde inne słowo.
 */
export function pseudonymize(input: string, extraValues: string[] = []): PseudonymizedText {
  const map: PlaceholderMap = new Map();
  let text = input ?? '';

  // Najpierw wartości znane wprost — imię i nazwisko trzeba usunąć, zanim
  // cokolwiek innego przetnie tekst.
  const named: Array<{ label: string; value: string }> = [];
  for (const value of extraValues) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length >= 3) named.push({ label: 'KANDYDAT', value: trimmed });
  }

  // Dłuższe najpierw: „Jan Kowalski" przed „Jan".
  named.sort((a, b) => b.value.length - a.value.length);

  let namedIndex = 0;
  for (const { label, value } of named) {
    if (!text.includes(value)) continue;
    const placeholder = makePlaceholder(label, namedIndex);
    text = text.split(value).join(placeholder);
    map.set(placeholder, value);
    namedIndex += 1;
  }

  for (const { label, regex } of PATTERNS) {
    const seen = new Map<string, string>();
    text = text.replace(regex, (match) => {
      if (label === 'TELEFON') {
        // Krotkie daty i identyfikatory nie sa numerami telefonu.
        const digits = match.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 15) return match;
      }

      const existing = seen.get(match);
      if (existing) return existing;

      const placeholder = makePlaceholder(label, seen.size);
      seen.set(match, placeholder);
      map.set(placeholder, match);
      return placeholder;
    });
  }

  return { text, map };
}

/** Ostatnia wspolna bramka: pseudonimizuje caly prompt, a potem odrzuca wykryte PII. */
export function preparePromptForModel(input: string, extraValues: string[] = []): PseudonymizedText {
  const prepared = pseudonymize(input, extraValues);
  assertNoPii(prepared.text);
  return prepared;
}

/** Podstawia prawdziwe wartości z powrotem — wyłącznie w wyniku dla użytkownika. */
export function rehydrate(text: string, map: PlaceholderMap): string {
  let result = text ?? '';
  // Od najdłuższych placeholderów, żeby `[EMAIL_2]` nie został zjedzony przez `[EMAIL]`.
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [placeholder, value] of entries) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

/**
 * Usuwa z profilu pola, które nie mają prawa dotrzeć do modelu.
 *
 * `photoUrl` znika **całkowicie**, bez placeholdera: wizerunek to dane
 * szczególnej kategorii (art. 9 RODO), a do wygenerowania treści CV nie jest
 * potrzebny w żadnej formie.
 */
export function stripSensitiveFields(vault: Partial<MasterVault>): Partial<MasterVault> {
  if (!vault?.personalInfo) return vault;

  const { photoUrl: _removed, ...safePersonalInfo } = vault.personalInfo;
  return { ...vault, personalInfo: safePersonalInfo };
}

/** Wartości z profilu, których nie złapie żadne wyrażenie regularne. */
export function identifyingValues(vault: Partial<MasterVault>): string[] {
  const info = vault?.personalInfo;
  if (!info) return [];
  return [info.fullName, info.location].filter((value): value is string => Boolean(value?.trim()));
}

export class PiiLeakError extends Error {
  constructor(public readonly kind: string) {
    super(`Zablokowano wysyłkę do modelu: w ładunku wykryto dane osobowe (${kind}).`);
    this.name = 'PiiLeakError';
  }
}

/**
 * Ostatnia bramka przed wysłaniem.
 *
 * Nie zastępuje pseudonimizacji — jest siatką bezpieczeństwa na wypadek
 * ścieżki dodanej w przyszłości, która ją ominie. Lepiej, żeby taka ścieżka
 * wywróciła się głośno na etapie testów, niż po cichu wysłała czyjeś CV.
 *
 */
export function assertNoPii(payload: string): void {
  const checks: Array<{ kind: string; regex: RegExp }> = [
    { kind: 'adres e-mail', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
    { kind: 'numer PESEL', regex: /\b\d{11}\b/ },
    { kind: 'numer telefonu', regex: /(?:\+\d{1,3}[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/ },
  ];

  for (const { kind, regex } of checks) {
    if (kind === 'numer telefonu') {
      const validPhone = [...payload.matchAll(new RegExp(regex.source, 'g'))]
        .some(([match]) => match.replace(/\D/g, '').length >= 9);
      if (validPhone) throw new PiiLeakError(kind);
      continue;
    }
    if (regex.test(payload)) throw new PiiLeakError(kind);
  }
}
