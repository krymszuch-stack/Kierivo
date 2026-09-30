/**
 * Odtworzenie awaryjnych danych z IndexedDB musi zakończyć się przed
 * migracjami i pierwszym renderem. Inicjalizatory Reacta czytają profil
 * synchronicznie; render przed odtworzeniem wyglądałby jak brak CV i mógłby
 * pozwolić zapisać pusty profil na miejsce danych czekających w IndexedDB.
 */
export async function mountAfterStorageRestore(
  storageRestore: Promise<unknown>,
  prepare: () => void,
  mount: () => void,
): Promise<void> {
  await storageRestore;
  prepare();
  mount();
}
