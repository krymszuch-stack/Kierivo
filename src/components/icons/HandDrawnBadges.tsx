import React from 'react';

/**
 * Rysowane odznaki benefitów — lekkie SVG, zero zależności.
 *
 * Estetyka „doodle" jest tu celowa: matryca benefitów to najbardziej ludzka
 * część kokpitu. Kreska jest organiczna, a akcenty pochodzą z brand booka.
 *
 * Wszystkie znaki towarowe i nazwy handlowe (m.in. MultiSport, PZU, Lux Med,
 * Medicover, MyBenefit, Sodexo, Edenred) należą do ich prawnych właścicieli.
 */

const ACCENT = '#155EEF';
const MEDICAL = '#38BDF8';
const BRAND_PZU = '#0055A5';
const BRAND_MEDICOVER = '#007A3D';
const BRAND_GOLD = '#F59E0B';
const BRAND_PURPLE = '#A855F7';
const BRAND_GREEN = '#10B981';

export interface BadgeIconProps {
  className?: string;
}

const svgProps = {
  viewBox: '0 0 48 48',
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
  'aria-hidden': true,
  focusable: false,
};

/** Karta MultiSport (Benefit Systems): hantel ze wstęgą energii. */
export const BadgeMultiSport: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M7 20.5c-.6 2.4-.5 5 .2 7.3" />
    <path d="M11 16.8c-1.2 4.7-1.2 9.6.1 14.3" />
    <path d="M41 20.4c.7 2.4.7 5 .1 7.4" />
    <path d="M37 16.6c1.4 4.8 1.4 9.8.1 14.6" />
    <path d="M13 24.2c6.6-.7 15.3-.8 22 .1" stroke={ACCENT} strokeWidth="3" />
    {/* Iskry energii */}
    <g stroke={ACCENT} strokeWidth="2.2">
      <path d="M24 8.4v4.6" />
      <path d="M19.6 10.4l2 3.1" />
      <path d="M28.4 10.4l-2 3.1" />
    </g>
    <path d="M16.5 37.5c5-1.2 10.4-1.2 15.4.2" strokeDasharray="2 3" />
  </svg>
);

/** PZU Sport: charakterystyczna tarcza PZU ze skrzydłami aktywności. */
export const BadgePzuSport: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <circle cx="24" cy="24" r="16" stroke={BRAND_PZU} strokeWidth="2.4" />
    <path d="M18 16h12v16H18z" stroke={BRAND_PZU} strokeWidth="2" />
    <path d="M14 24h20" stroke={ACCENT} strokeWidth="3" />
    <circle cx="12" cy="24" r="2.5" fill={ACCENT} />
    <circle cx="36" cy="24" r="2.5" fill={ACCENT} />
    <path d="M21 12l3-4 3 4" stroke={ACCENT} strokeWidth="2.2" />
  </svg>
);

/** PZU Zdrowie / Ubezpieczenie PZU: tarcza ochronna z krzyżem i monogramem. */
export const BadgePzuZdrowie: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <circle cx="24" cy="24" r="17" stroke={BRAND_PZU} strokeWidth="2.2" />
    <circle cx="24" cy="24" r="13" stroke={MEDICAL} strokeDasharray="2 3" />
    <path d="M24 16v16M16 24h16" stroke={ACCENT} strokeWidth="3.2" />
    <path d="M21 39c2-1 4-1 6 0" stroke={BRAND_PZU} strokeWidth="2" />
  </svg>
);

/** Lux Med: szkicowana tarcza z krzyżem i sercem opieki. */
export const BadgeLuxmed: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path
      d="M24 5.5c5 2.7 9.4 4 14 4.2.6 9.8-1 20.7-13.7 26.6C11.4 30.5 9.6 19.6 10.2 9.7c4.6-.2 8.9-1.5 13.8-4.2Z"
      stroke={MEDICAL}
      strokeWidth="2.1"
    />
    <path d="M24 13.4v11.4" stroke={ACCENT} strokeWidth="3.2" />
    <path d="M18.3 19.1h11.4" stroke={ACCENT} strokeWidth="3.2" />
    <path
      d="M24 44c-3.4-2.5-6-4.8-6-7.4 0-1.9 1.5-3.2 3.2-3.2 1.2 0 2.2.6 2.8 1.6.6-1 1.6-1.6 2.8-1.6 1.7 0 3.2 1.3 3.2 3.2 0 2.6-2.6 4.9-6 7.4Z"
      stroke={ACCENT}
      strokeWidth="2"
    />
  </svg>
);

/** Medicover: liście / podwójna tarcza zielono-niebieska z pulsem zdrowia. */
export const BadgeMedicover: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path
      d="M12 28C12 18 20 10 24 6c4 4 12 12 12 22 0 8-6 14-12 14s-12-6-12-14Z"
      stroke={BRAND_MEDICOVER}
      strokeWidth="2.2"
    />
    {/* EKG puls */}
    <path
      d="M16 26h4l2.5-6 3 12 2.5-6h4"
      stroke={ACCENT}
      strokeWidth="2.4"
    />
  </svg>
);

/** MyBenefit / Kafeteria: pudełko z prezentem, punktami i wstążką. */
export const BadgeMyBenefit: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <rect x="10" y="18" width="28" height="22" rx="3" strokeWidth="2" />
    <path d="M8 18h32" strokeWidth="2.4" stroke={BRAND_PURPLE} />
    <path d="M24 18v22" strokeWidth="2.4" stroke={BRAND_PURPLE} />
    {/* Kokarda */}
    <path
      d="M24 18c-3-5-7-7-9-5s0 7 9 5c9 2 11-3 9-5s-6 0-9 5Z"
      stroke={ACCENT}
      strokeWidth="2.2"
    />
    {/* Gwiazdki punktów */}
    <circle cx="16" cy="28" r="1.5" fill={BRAND_GOLD} />
    <circle cx="32" cy="28" r="1.5" fill={BRAND_GOLD} />
  </svg>
);

/** Karta Lunch (Sodexo / Edenred): karta zbliżeniowa ze sztućcami. */
export const BadgeFoodLunch: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <rect x="8" y="12" width="32" height="24" rx="4" strokeWidth="2" />
    <path d="M8 20h32" strokeWidth="2.5" stroke={ACCENT} />
    <circle cx="16" cy="28" r="3" stroke={BRAND_GOLD} strokeWidth="1.8" />
    {/* Sztućce */}
    <path d="M30 25v6M28 25v3h4v-3" stroke={ACCENT} strokeWidth="1.6" />
    <path d="M34 25v6" stroke={ACCENT} strokeWidth="1.6" />
  </svg>
);

/** Świeże owoce / Owocowe czwartki: jabłko z listkiem i cytrus. */
export const BadgeFruits: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    {/* Jabłko */}
    <path
      d="M24 16c-3-4-8-4-11-1-3.5 3.5-3.5 10 0 14.5 3 4 8 5.5 11 2.5 3 3 8 1.5 11-2.5 3.5-4.5 3.5-11 0-14.5-3-3-8-3-11 1Z"
      stroke={BRAND_GREEN}
      strokeWidth="2.2"
    />
    <path d="M24 16c0-5 2-8 5-9" stroke={ACCENT} strokeWidth="2" />
    <path d="M26 10c3-1 6 0 7 2-1 2-4 2-7-2Z" fill={BRAND_GREEN} stroke={BRAND_GREEN} />
  </svg>
);

/** Kawa Specialty & Herbata: parujący kubek i ziarna kawy. */
export const BadgeCoffee: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M12 18h20v14c0 4-3 7-7 7h-6c-4 0-7-3-7-7V18Z" strokeWidth="2.2" />
    <path d="M32 21h4c2.5 0 4.5 2 4.5 4.5S38.5 30 36 30h-4" strokeWidth="2" />
    <path d="M10 43h24" strokeWidth="2.2" stroke={ACCENT} />
    {/* Para */}
    <path d="M18 13c0-3 2-4 2-7M24 14c0-3 2-4 2-7M30 13c0-3 2-4 2-7" stroke={ACCENT} strokeWidth="2" />
  </svg>
);

/** Wsparcie Psychologiczne / Wellbeing (Mindgram): umysł, serce i balans. */
export const BadgeWellbeing: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path
      d="M24 7c-6 0-11 4.5-11 10.5 0 3.5 1.5 6.5 4 8.5v5c0 1.5 1.5 3 3 3h8c1.5 0 3-1.5 3-3v-5c2.5-2 4-5 4-8.5C35 11.5 30 7 24 7Z"
      stroke={BRAND_PURPLE}
      strokeWidth="2.2"
    />
    <path
      d="M24 22c-2-1.5-3.5-3-3.5-4.5 0-1 1-2 2-2 .8 0 1.2.4 1.5 1 .3-.6.7-1 1.5-1 1 0 2 1 2 2 0 1.5-1.5 3-3.5 4.5Z"
      stroke={ACCENT}
      strokeWidth="1.8"
      fill={ACCENT}
    />
    <path d="M20 38h8M22 41h4" stroke={BRAND_PURPLE} strokeWidth="2" />
  </svg>
);

/** Budżet Szkoleniowy / Certyfikaty: toga doktorska / certyfikat z gwiazdą. */
export const BadgeTraining: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M6 18l18-8 18 8-18 8-18-8Z" stroke={BRAND_GOLD} strokeWidth="2.2" />
    <path d="M12 21v11c0 4 6 7 12 7s12-3 12-7V21" strokeWidth="2" />
    <path d="M38 20v14" stroke={ACCENT} strokeWidth="2" />
    <circle cx="38" cy="35" r="2" fill={ACCENT} />
  </svg>
);

/** Ubezpieczenie Grupowe na Życie: parasol ochronny z kroplami. */
export const BadgeInsurance: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path
      d="M8 24c0-8.8 7.2-16 16-16s16 7.2 16 16c-3-2-7-3-11-2-3 1-7 1-10 0-4-1-8 0-11 2Z"
      stroke={BRAND_PZU}
      strokeWidth="2.2"
    />
    <path d="M24 8v28c0 2.5-2 4-4 4s-4-1.5-4-3.5" stroke={ACCENT} strokeWidth="2.2" />
  </svg>
);

export interface DrivingLicenseProps extends BadgeIconProps {
  category?: string;
}

/** Uprawnienia: kierownica i plakietka z kategorią (B / C / UDT / SEP). */
export const BadgeDrivingLicense: React.FC<DrivingLicenseProps> = ({
  className = '',
  category = 'B',
}) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M6.5 12.4c11.7-1 23.4-1 35 .2.7 7.6.6 15.2-.2 22.8-11.6 1-23.2 1-34.7-.1-.8-7.6-.8-15.2-.1-22.9Z" />
    <circle cx="17.4" cy="24" r="7" strokeWidth="2.1" />
    <circle cx="17.4" cy="24" r="2.3" strokeWidth="2.1" />
    <path d="M17.4 17.1v4.6M11.7 27.3l3.6-2.1M23.1 27.3l-3.6-2.1" strokeWidth="2.1" />
    <rect
      x="27.2"
      y="17.6"
      width="12.6"
      height="12.8"
      rx="3"
      stroke={ACCENT}
      strokeWidth="2.1"
      transform="rotate(-2 33.5 24)"
    />
    <text
      x="33.5"
      y="28.4"
      textAnchor="middle"
      fill={ACCENT}
      stroke="none"
      fontSize={category.length > 1 ? 7 : 10}
      fontWeight="800"
      fontFamily="ui-monospace, SFMono-Regular, monospace"
    >
      {category}
    </text>
  </svg>
);

/** Dojazd: auto w korku i zegar. */
export const BadgeCommute: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M6.6 29.4c-.4-3.3.4-5.1 2.6-5.7 1.6-3.3 3-5.6 4.3-6.6 5.3-1 10.6-1 15.9.1 1.4 1 2.8 3.2 4.2 6.5 2.2.6 3.1 2.4 2.7 5.7-9.9.9-19.8.9-29.7 0Z" />
    <circle cx="13.6" cy="31.9" r="2.5" />
    <circle cx="29.9" cy="31.9" r="2.5" />
    <circle cx="38.6" cy="14.2" r="6.4" stroke={ACCENT} strokeWidth="2.2" />
    <path d="M38.6 10.6v3.8l2.6 1.6" stroke={ACCENT} strokeWidth="2.2" />
  </svg>
);

/** Sprzęt: monitor i stanowisko pracy. */
export const BadgeEquipment: React.FC<BadgeIconProps> = ({ className = '' }) => (
  <svg {...svgProps} className={className} stroke="currentColor">
    <path d="M11.4 9.6c8.5-.9 17-.9 25.4.1.8 5.4.7 10.9-.2 16.3-8.4.9-16.8.9-25.1-.1-.8-5.4-.9-10.8-.1-16.3Z" />
    <path d="M15.6 14.2c4.6-.5 9.2-.5 13.8.1" stroke={ACCENT} strokeWidth="2.2" />
    <path d="M24 26.2v3.6M19.8 30.4c2.9-.4 5.7-.4 8.6 0" />
    <path d="M9.2 40.2c.3-3.6.7-6.4 1.3-8.3 2.6-.5 5.2-.5 7.8 0 .6 1.9 1 4.7 1.2 8.3" opacity="0.85" />
  </svg>
);

/** Rejestr ikon powiązanych z kluczami benefitów. */
export const BADGE_ICONS = {
  // Podstawowe i marki sportowe
  SPORT: BadgeMultiSport,
  SPORT_MULTISPORT: BadgeMultiSport,
  SPORT_PZU: BadgePzuSport,
  SPORT_MEDICOVER: BadgeMedicover,

  // Opieka medyczna i pakiety
  MEDICAL: BadgeLuxmed,
  MEDICAL_LUXMED: BadgeLuxmed,
  MEDICAL_MEDICOVER: BadgeMedicover,
  MEDICAL_PZU: BadgePzuZdrowie,
  MEDICAL_ENELMED: BadgeLuxmed,

  // Kafeteria i żywienie
  MYBENEFIT: BadgeMyBenefit,
  FOOD: BadgeFoodLunch,
  FOOD_LUNCH: BadgeFoodLunch,
  FRUITS: BadgeFruits,
  COFFEE: BadgeCoffee,

  // Rozwój, wellbeing, bezpieczeństwo
  WELLBEING: BadgeWellbeing,
  TRAINING: BadgeTraining,
  INSURANCE: BadgeInsurance,

  // Mobilność i stanowisko
  COMMUTE: BadgeCommute,
  EQUIPMENT: BadgeEquipment,
  DRIVING_LICENSE: BadgeDrivingLicense,
} as const;

export type BadgeKey = keyof typeof BADGE_ICONS;
