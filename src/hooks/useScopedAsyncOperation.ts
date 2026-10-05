import { useLayoutEffect, useMemo, useState } from 'react';
import { createAsyncOperationGuard } from '../lib/asyncOperationGuard';

/** Zmiana właściciela lub odmontowanie unieważnia wynik i blokadę operacji UI. */
export function useScopedAsyncOperation(scope: unknown) {
  const operation = useMemo(() => ({ scope, guard: createAsyncOperationGuard() }), [scope]);
  const guard = operation.guard;
  const [active, setActive] = useState<typeof operation | null>(null);
  useLayoutEffect(() => () => guard.invalidate(), [guard]);
  return {
    isBusy: active?.scope === scope && active?.guard === guard && guard.isBusy(),
    begin() {
      const token = guard.begin();
      if (token) setActive(operation);
      return token;
    },
    isCurrent: guard.isCurrent,
    finish(token: symbol) {
      if (guard.finish(token)) setActive(current => current?.guard === guard ? null : current);
    },
  };
}
