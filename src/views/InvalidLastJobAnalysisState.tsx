import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';

/** Widoczny stan uszkodzonej historii — nie miesza jej z pustym stanem startowym. */
export const InvalidLastJobAnalysisState: React.FC = () => (
  <Card tone="flat" className="p-6 text-center space-y-3 border-dashed border-warning/40">
    <AlertCircle className="mx-auto h-8 w-8 text-warning-fg" />
    <div className="space-y-1">
      <p className="text-sm font-semibold text-ink">
        Zapisanej analizy nie można odczytać
      </p>
      <p className="text-xs text-muted max-w-sm mx-auto">
        Dane historyczne są niekompletne lub uszkodzone, dlatego nie pokazujemy ich jako wyniku ani listy dopasowań.
      </p>
    </div>
  </Card>
);
