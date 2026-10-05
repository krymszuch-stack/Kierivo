// Czyszczenie obejmuje kilka magazynów i await. Wspólna blokada zapobiega
// odtworzeniu danych przez autosave pomiędzy usunięciem LS a zatwierdzeniem IDB.
const deletingKeys = new Map<string, number>();
let deletingAll = 0;

export function isStorageWriteBlocked(key: string): boolean {
  return deletingAll > 0 || deletingKeys.has(key);
}

export function beginStorageDeletion(keys?: readonly string[]): () => void {
  if (keys === undefined) deletingAll += 1;
  else for (const key of keys) deletingKeys.set(key, (deletingKeys.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (keys === undefined) deletingAll -= 1;
    else for (const key of keys) {
      const remaining = (deletingKeys.get(key) ?? 1) - 1;
      if (remaining === 0) deletingKeys.delete(key);
      else deletingKeys.set(key, remaining);
    }
  };
}
