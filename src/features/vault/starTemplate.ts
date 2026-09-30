// Przykłady w słowniczku są fikcyjne. Do CV wolno przenieść tylko szablon,
// żeby metryki, narzędzia i uprawnienia z przykładu nie stały się faktami kandydata.
export function starTemplateForVerb(verb: string): string {
  return `[Jeśli wykonano: ${verb}] [opisz rzeczywistą czynność i kontekst]. [Dodaj potwierdzony rezultat, jeżeli go znasz].`;
}

export function starTemplateForExample(): string {
  return '[Opisz rzeczywistą czynność] [podaj użyte narzędzie lub metodę, jeśli dotyczy]. [Dodaj potwierdzony rezultat, jeśli go znasz].';
}
