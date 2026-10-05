/** Nie formatujemy braku oceny jako liczby ani jako zera punktow. */
export function formatDrillOverallScore(_score: number | null, _unit: 'percent' | 'points'): string {
  // Starsze wpisy zawierają niekalibrowane wartości regexowego heurystycznego wyniku.
  return 'nie jest mierzony';
}
