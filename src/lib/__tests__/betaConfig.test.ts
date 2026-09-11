import { describe, it, expect } from 'vitest';
import {
  IS_BETA,
  BETA_VERSION,
  BETA_LABEL,
  BETA_BADGE,
  BETA_NOTICE,
  PURCHASES_DISABLED_REASON,
  OUT_OF_SCOPE_NOTICE,
} from '../betaConfig';

describe('betaConfig — jedno źródło prawdy o bezpłatnej wersji beta', () => {
  it('oznacza aplikację jako wersję beta z wyłączonymi zakupami', () => {
    expect(IS_BETA).toBe(true);
    expect(BETA_VERSION).toContain('beta');
    expect(BETA_LABEL).toBe('Bezpłatna Beta');
    expect(BETA_BADGE).toBe('BETA');
  });

  it('zawiera czytelne komunikaty o wyłączeniu zakupów i funkcjach poza zakresem', () => {
    expect(BETA_NOTICE).toContain('bezpłatnych testów beta');
    expect(PURCHASES_DISABLED_REASON).toContain('wyłączone');
    expect(OUT_OF_SCOPE_NOTICE).toContain('poza zakresem');
  });
});
