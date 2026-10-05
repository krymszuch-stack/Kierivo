/** Token rozstrzyga, czy odpowiedź `/api/me` nadal należy do bieżącego stanu sesji. */
export interface EntitlementRefreshToken {
  sessionRevision: number;
  requestId: number;
}

/**
 * Odrzuca odpowiedzi po zmianie sesji i starsze odpowiedzi z równoległych odświeżeń.
 * Sam magazyn nie zna Reacta ani Supabase, więc tę regułę można sprawdzić deterministycznie.
 */
export function createEntitlementRefreshGuard() {
  let sessionRevision = 0;
  let latestRequestId = 0;

  return {
    begin(): EntitlementRefreshToken {
      latestRequestId += 1;
      return { sessionRevision, requestId: latestRequestId };
    },

    invalidateSession(): void {
      sessionRevision += 1;
      latestRequestId += 1;
    },

    isCurrent(token: EntitlementRefreshToken): boolean {
      return token.sessionRevision === sessionRevision && token.requestId === latestRequestId;
    },
  };
}
