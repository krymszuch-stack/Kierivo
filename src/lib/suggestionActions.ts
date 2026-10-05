/** Odrzucenie sugestii nie może usunąć jedynego widocznego sposobu jej cofnięcia. */
export function dismissUnappliedSuggestion(
  dismissedIds: Set<string>,
  appliedIds: { has(value: string): boolean },
  id: string,
): Set<string> {
  if (appliedIds.has(id)) return dismissedIds;
  return new Set(dismissedIds).add(id);
}
