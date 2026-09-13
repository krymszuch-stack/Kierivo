import React from 'react';

/**
 * Autorski zestaw ikon Kierivo.
 *
 * Po co własne, skoro Lucide jest w projekcie i działa? Bo Lucide rysuje
 * pojęcia ogólne — teczkę, oko, wykres — a te ikony rysują *nasze* pojęcia:
 * skarbiec z pętlą „C", celownik z wektorem prędkości, ścieżkę Kanbanu z
 * turkusowym punktem postępu. Znak marki (`public/brand/kierivo-mark.svg`)
 * ma dwa niepodważalne elementy: skos -10° i chevron V. Cały zestaw poniżej
 * powtarza je świadomie, żeby ikona w menu i logo nad nią pochodziły z jednego
 * języka rysunkowego.
 *
 * Reguły wspólne dla wszystkich ikon — łamanie ich rozjeżdża zestaw:
 * - `viewBox="0 0 24 24"`, `stroke-width="1.75"`, `linecap`/`linejoin="round"`,
 * - kontur idzie `currentColor` (dziedziczy kolor tekstu, więc działa w obu
 *   motywach i w stanie aktywnym menu),
 * - akcent turkusowy `#19C3E6` jest **jedynym** kolorem wpisanym na sztywno.
 *   To kolor marki, nie kolor motywu — w trybie ciemnym ma być identyczny,
 *   dlatego nie przechodzi przez token motywu.
 *
 * Lucide zostaje tam, gdzie chodzi o czynność ogólną (zamknij, pobierz,
 * strzałka). Podmieniamy tylko ikony pojęć produktowych — mieszanie obu
 * języków w jednym rzędzie przycisków wygląda gorzej niż konsekwentny Lucide.
 */

export interface CvelIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  /** Kolor akcentu. Domyślnie turkus marki; `currentColor` daje wersję mono. */
  accent?: string;
}

const BRAND_ACCENT = '#19C3E6';

/** Wspólna obudowa: jedno miejsce na `viewBox`, grubość konturu i domknięcia. */
const IconBase: React.FC<CvelIconProps & { children: React.ReactNode }> = ({
  size = 18,
  accent: _accent,
  children,
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

/** 1. Skarbiec — pętla „C" z turkusowym rdzeniem. Profil i dane użytkownika. */
export const IconVault: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <g transform="skewX(-10) translate(2 0)">
      <path d="M16 6.6A6.6 6.6 0 1 0 16 17.4" />
      <path d="M13.4 9.6A3.2 3.2 0 1 0 13.4 14.4" opacity="0.55" />
      <circle cx="9.4" cy="12" r="1.5" fill={accent} stroke="none" />
    </g>
  </IconBase>
);

/** 2. Dopasowanie / ATS Lab — podwójny celownik z wektorem prędkości V. */
export const IconMatcher: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <circle cx="11" cy="12" r="8" opacity="0.9" />
    <circle cx="11" cy="12" r="4" opacity="0.5" />
    <g transform="skewX(-10) translate(2 0)">
      <path d="M9.6 8.4 13.2 12l-3.6 3.6" stroke={accent} />
    </g>
  </IconBase>
);

/** 3. Trening rozmowy — mikrofon/dymek z błyskawicą decyzyjną. */
export const IconTrainer: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <g transform="skewX(-10) translate(2 0)">
      <path d="M11 3.2h1.6a3 3 0 0 1 3 3v4.2a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V6.2a3 3 0 0 1 3-3Z" />
      <path d="M5.4 11.4a6.4 6.4 0 0 0 12.8 0" opacity="0.5" />
      <path d="M11.8 17.8V21" opacity="0.5" />
      <path d="M12.6 5.6 10.6 8.9h2.6l-1.9 3.3" stroke={accent} strokeWidth="1.6" />
    </g>
  </IconBase>
);

/** 4. Pipeline — trzy aerodynamiczne kolumny, turkusowy punkt postępu. */
export const IconPipeline: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <g transform="skewX(-10) translate(2 0)">
      <rect x="3.2" y="6" width="4.4" height="12" rx="1.6" />
      <rect x="9.6" y="6" width="4.4" height="8.6" rx="1.6" opacity="0.75" />
      <rect x="16" y="6" width="4.4" height="5.2" rx="1.6" opacity="0.5" />
      <circle cx="18.2" cy="16.6" r="1.7" fill={accent} stroke="none" />
    </g>
  </IconBase>
);

/** 5. Mapa ciepła — oko z termowizyjnym rdzeniem. */
export const IconHeatmap: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.4" opacity="0.55" />
    <circle cx="12" cy="12" r="1.5" fill={accent} stroke="none" />
  </IconBase>
);

/** 7. Baza wiedzy o pracodawcy — budynek spięty z węzłem grafu. */
export const IconCompanyIntel: React.FC<CvelIconProps> = ({ accent = BRAND_ACCENT, ...props }) => (
  <IconBase {...props}>
    <g transform="skewX(-10) translate(2 0)">
      <path d="M4 20.4V5.6a1.6 1.6 0 0 1 1.6-1.6h6.2a1.6 1.6 0 0 1 1.6 1.6v14.8" />
      <path d="M2.6 20.4h12.4" opacity="0.6" />
      <path d="M7 8.2h3.4M7 12h3.4M7 15.8h3.4" opacity="0.5" />
      <path d="M13.4 9.4 18 7.2M13.4 13.6 18 15.8" opacity="0.6" />
      <circle cx="19.2" cy="6.6" r="1.5" fill={accent} stroke="none" />
      <circle cx="19.2" cy="16.4" r="1.5" stroke={accent} />
    </g>
  </IconBase>
);

/**
 * Aliasy dla starych nazw z `ui/icons/ModernIcons`. Dzięki nim podmiana ikony
 * w menu nie wymaga przepisywania każdego importu z osobna — reguła 4
 * w `AGENTS.md` mówi, żeby poprawiać klasę, a nie wystąpienie.
 */
export { IconTrainer as IconBrain, IconPipeline as IconApplications };
