import type { MasterVault } from '../types';

/** Wspolny prog tresci merytorycznej: nie liczy nazw firm, stanowisk ani pustych kart. */
function hasSubstantialCareerText(value: string | undefined): boolean {
  const text = (value ?? '').trim();
  const letters = text.match(/[\p{L}]/gu)?.length ?? 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return letters >= 10 && text.length >= 20 && words >= 2;
}

/** Wpis pracy lub projektu musi zawierac opis; same etykiety nie potwierdzaja doswiadczenia. */
export function hasCareerEvidence(vault: MasterVault): boolean {
  return (vault.history ?? []).some((experience) =>
    hasSubstantialCareerText(experience.description) ||
    (experience.highlights ?? []).some((highlight) => hasSubstantialCareerText(highlight.text))
  ) || (vault.projects ?? []).some((project) => hasSubstantialCareerText(project.description));
}
