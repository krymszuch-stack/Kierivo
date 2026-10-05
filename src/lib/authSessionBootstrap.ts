/** Pilnuje, by spóźniony wynik operacji nie nadpisał późniejszej zmiany sesji. */
export function createAuthSessionBootstrapGuard() {
  let authEventRevision = 0;

  return {
    begin(): number {
      return authEventRevision;
    },

    noteAuthEvent(): void {
      authEventRevision += 1;
    },

    canApply(snapshotRevision: number): boolean {
      return snapshotRevision === authEventRevision;
    },
  };
}
