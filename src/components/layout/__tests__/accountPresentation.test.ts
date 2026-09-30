import { describe, expect, it } from 'vitest';
import { getAccountPresentation } from '../accountPresentation';

describe('Etykieta statusu konta w pasku bocznym', () => {
  it('nie sugeruje ochrony konta dla profilu lokalnego', () => {
    expect(getAccountPresentation({
      isAuthenticated: true,
      authMode: 'local',
      userEmail: 'alicja@example.test',
      cloudAvailable: true,
    })).toEqual({
      label: 'alicja@example.test',
      tooltip: 'Profil lokalny · dane zapisane na tym urządzeniu',
      showProtectionShield: false,
    });
  });

  it('pokazuje informację o ochronie wyłącznie dla konta chmurowego', () => {
    expect(getAccountPresentation({
      isAuthenticated: true,
      authMode: 'cloud',
      userEmail: 'alicja@example.test',
      cloudAvailable: true,
    })).toEqual({
      label: 'alicja@example.test',
      tooltip: 'alicja@example.test · Dane konta są chronione',
      showProtectionShield: true,
    });
  });

  it('nie pokazuje tarczy przed zalogowaniem', () => {
    expect(getAccountPresentation({
      isAuthenticated: false,
      authMode: null,
      cloudAvailable: false,
    })).toEqual({
      label: 'Utwórz profil lokalny',
      tooltip: 'Utwórz profil lokalny',
      showProtectionShield: false,
    });
  });
});
