import { describe, expect, it } from 'vitest';
import { createEntitlementRefreshGuard } from '../entitlementRefreshGuard';

describe('ochrona odświeżania limitów przed nieaktualną odpowiedzią', () => {
  it('odrzuca odpowiedź poprzedniego konta po zmianie sesji', () => {
    const guard = createEntitlementRefreshGuard();
    const kontoA = guard.begin();

    guard.invalidateSession();
    const kontoB = guard.begin();

    expect(guard.isCurrent(kontoA)).toBe(false);
    expect(guard.isCurrent(kontoB)).toBe(true);
  });

  it('odrzuca starsze równoległe odświeżenie w tej samej sesji', () => {
    const guard = createEntitlementRefreshGuard();
    const pierwsze = guard.begin();
    const nowsze = guard.begin();

    expect(guard.isCurrent(pierwsze)).toBe(false);
    expect(guard.isCurrent(nowsze)).toBe(true);
  });

  it('unieważnia oczekujące odświeżenie także po wylogowaniu', () => {
    const guard = createEntitlementRefreshGuard();
    const oczekujące = guard.begin();

    guard.invalidateSession();

    expect(guard.isCurrent(oczekujące)).toBe(false);
  });
});
