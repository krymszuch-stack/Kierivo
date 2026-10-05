export type CloudConflictResolution<T> =
  | { applied: true; result: T }
  | { applied: false };

export function isCloudOperationForCurrentOwner(
  activeOwnerId: string | null,
  operationOwnerId: string,
): boolean {
  return activeOwnerId === operationOwnerId;
}

/**
 * Wynik zapisu konfliktu wolno podpiąć do widoku tylko wtedy, gdy użytkownik
 * nadal należy do tego samego konta. Sam zapis pozostaje przypisany do ownerId;
 * ten test chroni wspólny stan interfejsu przed spóźnioną odpowiedzią sieciową.
 */
export async function applyCloudConflictResultForCurrentOwner<T>(
  ownerId: string,
  getCurrentOwnerId: () => string | null,
  resolve: () => Promise<T>,
  apply: () => void,
): Promise<CloudConflictResolution<T>> {
  const result = await resolve();
  if (!isCloudOperationForCurrentOwner(getCurrentOwnerId(), ownerId)) return { applied: false };
  apply();
  return { applied: true, result };
}
