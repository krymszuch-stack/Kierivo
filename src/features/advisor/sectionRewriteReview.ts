/** Kopiowanie jest dostępne dopiero po sprawdzeniu propozycji przez użytkownika. */
export function canCopySectionRewrite(proposedText: string | undefined, factsVerified: boolean): boolean {
  return Boolean(proposedText?.trim()) && factsVerified;
}
