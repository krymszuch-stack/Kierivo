/** Używa wzoru przerywanego dla braku wyniku, aby pusty pierścień nie oznaczał 0%. */
export function getScoreRingTrackDashArray(score: number | null): string | undefined {
  return score === null ? '4 5' : undefined;
}
