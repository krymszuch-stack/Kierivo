export type AccountPresentationInput = {
  isAuthenticated: boolean;
  authMode: 'local' | 'cloud' | null;
  userEmail?: string;
  cloudAvailable: boolean;
};

export function getAccountPresentation({
  isAuthenticated,
  authMode,
  userEmail,
  cloudAvailable,
}: AccountPresentationInput) {
  const accountLabel = cloudAvailable ? 'Zaloguj lub załóż konto' : 'Utwórz profil lokalny';

  if (!isAuthenticated) {
    return { label: accountLabel, tooltip: accountLabel, showProtectionShield: false };
  }

  if (authMode === 'cloud') {
    const cloudLabel = userEmail || 'Konto w chmurze';
    return {
      label: cloudLabel,
      tooltip: `${cloudLabel} · Dane konta są chronione`,
      showProtectionShield: true,
    };
  }

  return {
    label: userEmail || 'Profil lokalny',
    tooltip: 'Profil lokalny · dane zapisane na tym urządzeniu',
    showProtectionShield: false,
  };
}
