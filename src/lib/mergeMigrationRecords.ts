import { stableStringify } from './audit-core/hash';

/** ID pozwala pominąć wyłącznie identyczną kopię, nie inną wersję danych. */
export function mergeMigrationRecords<T>(target: T[], source: T[]): T[] | null {
  const records = new Map<string, T>();
  const merged: T[] = [];
  for (const item of [...target, ...source]) {
    const id = typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
      ? item.id : null;
    if (id !== null && records.has(id)) {
      if (stableStringify(records.get(id)) !== stableStringify(item)) return null;
      continue;
    }
    if (id !== null) records.set(id, item);
    // Wadliwy rekord bez ID zachowujemy jako surowe dane do odzyskania.
    merged.push(item);
  }
  return merged;
}
