import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { isValidAtsScore } from '../../lib/canonicalAts';

/** Stara ocena nie może nadal podsuwać bieżących rekomendacji lub akcji eksportu. */
export function AnalysisTimeNotice({ score, onRefresh }: { score: unknown; onRefresh: () => void }) {
  return (
    <Card tone="flat" className="p-5 space-y-3 border-warning/40" role="status">
      <p className="font-semibold text-warning-fg">Analiza wymaga odświeżenia</p>
      {isValidAtsScore(score) && <p className="text-sm text-muted">Wynik historyczny: {score}%</p>}
      <p className="text-sm text-muted">Zmienił się miesiąc lub nie można potwierdzić czasu obliczenia. Staż bieżącego zatrudnienia może być już inny. Uruchom analizę ponownie, aby otrzymać aktualny wynik.</p>
      <Button variant="outline" onClick={onRefresh}>Przelicz analizę</Button>
    </Card>
  );
}
