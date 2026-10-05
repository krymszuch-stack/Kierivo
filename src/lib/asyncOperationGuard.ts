/** Spóźnione zakończenie nie może zmienić wyniku ani blokady nowej operacji. */
export function createAsyncOperationGuard() {
  let active: symbol | null = null;
  return {
    begin(): symbol | null {
      if (active) return null;
      active = Symbol('async-operation');
      return active;
    },
    isCurrent(token: symbol): boolean { return active === token; },
    isBusy(): boolean { return active !== null; },
    invalidate(): void { active = null; },
    finish(token: symbol): boolean {
      if (active !== token) return false;
      active = null;
      return true;
    },
  };
}
