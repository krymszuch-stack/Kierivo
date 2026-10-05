import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ApplicationStatus } from '../../types';
import { StatTile } from '../../components/ui/StatTile';
import { calculateCurrentApplicationStageShare } from './applicationMetrics';

export interface ApplicationProgressTileProps {
  statuses: readonly ApplicationStatus[];
}

/** Kafelek opisuje biezace statusy, bo Tracker nie archiwizuje pelnej historii etapow. */
export const ApplicationProgressTile: React.FC<ApplicationProgressTileProps> = ({ statuses }) => {
  const share = calculateCurrentApplicationStageShare(statuses);

  return (
    <StatTile
      label="Aktualnie w rozmowie/ofercie"
      value={share.percent === null ? '\u2014' : `${share.percent}%`}
      icon={CheckCircle2}
      subtext={share.submittedCount === 0
        ? 'Brak wys\u0142anych aplikacji'
        : `${share.currentAdvancedStageCount} z ${share.submittedCount} wys\u0142anych aplikacji`}
    />
  );
};
