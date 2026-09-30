import React from 'react';
import { BADGE_ICONS, BadgeKey } from '../icons/HandDrawnBadges';

export interface BrandBenefitLogoProps {
  benefitKey: BadgeKey;
  brandKey?: string;
  className?: string;
  altText?: string;
}

export const BrandBenefitLogo: React.FC<BrandBenefitLogoProps> = ({
  benefitKey,
  className = 'h-10 w-10',
}) => {
  const FallbackIcon = BADGE_ICONS[benefitKey] || BADGE_ICONS.SPORT;
  // Ikona jest dekoracyjna: nazwa benefitu występuje obok, a pobieranie logo
  // z zewnętrznej usługi łamało CSP i ujawniało jej dostawcy odwiedzane benefity.
  return (
    <div className={`flex items-center justify-center ${className}`} aria-hidden="true">
      <FallbackIcon className="h-full w-full" />
    </div>
  );
};
