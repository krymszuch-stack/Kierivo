/**
 * Wynik diagnostyki tekstowej wymaga przynajmniej jednej tresci kandydata.
 * Dane identyfikacyjne i kontaktowe sa metadanymi, nie tekstem CV do pomiaru.
 */
export function hasAtsDiagnosticContent(contentParts: readonly string[]): boolean {
  return contentParts.some((part) => /[\p{L}\p{N}]/u.test(part));
}
