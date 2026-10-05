import React from 'react';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { getRenderableAtsResultSnapshot } from '../../lib/atsResultSnapshot';
import { AtsSimulatorView } from '../matcher/AtsSimulatorView';

export interface HistoricalAtsReportProps {
  snapshot: unknown;
}

/** Bezpieczna granica odczytu niezweryfikowanych, historycznych wyników ATS. */
export const HistoricalAtsReport: React.FC<HistoricalAtsReportProps> = ({ snapshot }) => {
  const result = getRenderableAtsResultSnapshot(snapshot);

  if (!result) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Zapisany raport ATS jest niekompletny"
        description="Nie można bezpiecznie odtworzyć tego historycznego wyniku. Migawka została zachowana, ale niepełne dane nie będą przedstawiane jako brak wykrytych wymagań."
      />
    );
  }

  return <AtsSimulatorView result={result} />;
};
