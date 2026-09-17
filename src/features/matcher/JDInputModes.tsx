import React, { useState } from 'react';
import {
  Globe,
  FileCode,
  Sparkles,
  Building2,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';
import { JobOffer } from '../../types';
import { SAMPLE_MANUAL_JD } from '../../lib/exampleJd';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { Tabs } from '../../components/ui/Tabs';

export type InputMode = 'url' | 'manual';

export interface JDInputModesProps {
  onMatchManual: (offer: Partial<JobOffer>) => void;
  onMatchUrl: (url: string) => void;
  isFetchingUrl?: boolean;
  urlError?: string | null;
  className?: string;
}

export const JDInputModes: React.FC<JDInputModesProps> = ({
  onMatchManual,
  onMatchUrl,
  isFetchingUrl = false,
  urlError = null,
  className = '',
}) => {
  const [activeMode, setActiveMode] = useState<InputMode>('url');
  const [jobUrl, setJobUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualText, setManualText] = useState('');

  const modeTabs = [
    { id: 'url' as InputMode, label: 'Wklej Link do Oferty', icon: Globe },
    { id: 'manual' as InputMode, label: 'Wpisz Ręcznie / Wklej Treść', icon: FileCode },
  ];

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobUrl.trim()) return;
    onMatchUrl(jobUrl.trim());
  };

  /**
   * Przekazuje wyłącznie to, co użytkownik faktycznie podał.
   *
   * Poprzednia wersja dorabiała tu wartości domyślne: `requirements`
   * `['React','TypeScript','Node.js']`, `salary` „22 000 - 28 000 PLN netto B2B",
   * `location` „Warszawa / Zdalnie" i `remote: true`, a brakujący tytuł i firmę
   * zastępowała literałami „Stanowisko Docelowe" i „Firma Rekrutująca". Trafiało
   * to dalej jako `requirements` i `techStack`, więc po wklejeniu ogłoszenia dla
   * hydraulika aplikacja pokazywała stack React/TypeScript/Node.js i widełki
   * z sufitu. Puste pole jest uczciwe; wymyślona wartość nie.
   */
  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    onMatchManual({
      id: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      company: manualCompany.trim(),
      description: manualText.trim(),
      portal: 'Ręczne',
    });
  };

  return (
    <Card tone="raised" className={`space-y-5 ${className}`}>
      <div className="flex justify-center border-b border-line pb-4">
        <Tabs<InputMode>
          items={modeTabs}
          active={activeMode}
          onChange={setActiveMode}
          className="max-w-xl"
        />
      </div>

      {activeMode === 'url' && (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="Adres URL Ogłoszenia Rekrutacyjnego"
              icon={Globe}
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://justjoin.it/job-offer/..."
              containerClassName="flex-1"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Globe}
              loading={isFetchingUrl}
              className="mb-0.5"
            >
              Pobierz i Dopasuj Ofertę
            </Button>
          </div>

          {urlError && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-xs text-danger-fg">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{urlError}</span>
            </div>
          )}

          <p className="text-xs text-muted">
            Serwer pobierze treść ogłoszenia, odczyta wymagania i wyliczy Twój wskaźnik dopasowania
            ATS. Część portali — m.in. Pracuj.pl, NoFluffJobs, LinkedIn i theprotocol.it — blokuje
            automatyczne pobieranie albo zastrzega je w <code className="font-mono">robots.txt</code>.
            Nie obchodzimy tych zabezpieczeń; w takim wypadku skopiuj treść i użyj zakładki obok.
          </p>
        </form>
      )}

      {activeMode === 'manual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nazwa Stanowiska (opcjonalnie)"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="np. Senior Frontend Architect"
            />

            <Input
              label="Firma Rekrutująca (opcjonalnie)"
              icon={Building2}
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
              placeholder="np. Global FinTech Corp"
            />
          </div>

          <Textarea
            label="Treść Ogłoszenia o Pracę (Job Description)"
            rows={6}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Wklej pełną treść ogłoszenia rekrutacyjnego..."
            className="font-mono text-xs"
          />

          <div className="flex flex-col gap-3 border-t border-line/60 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={FlaskConical}
              onClick={() => setManualText(SAMPLE_MANUAL_JD)}
            >
              Wypróbuj na przykładzie
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              icon={Sparkles}
              onClick={handleManualSubmit}
              disabled={!manualText.trim()}
            >
              Dopasuj CV do Treści
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
