import React, { useState } from 'react';
import {
  FileText,
  Eye,
  ShieldCheck,
  Calendar,
  Lock,
  AlertCircle,
  FileDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobApplication } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { DocumentRenderer } from '../matcher/DocumentRenderer';
import { CoverLetterView } from '../matcher/CoverLetterView';
import { HistoricalAtsReport } from './HistoricalAtsReport';
import { downloadNativeDocxCv } from '../../lib/docxExporter';
import { getApplicationSnapshotDisplayInfo } from './applicationDisplay';
import { getSavedAtsScoreDisplayInfo } from '../../lib/atsScoreEvidence';
import { getRenderableAtsResultSnapshot } from '../../lib/atsResultSnapshot';
import { useAnalysisClock } from '../../hooks/useAnalysisClock';

export interface HistoricalDocumentModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'cv' | 'coverLetter' | 'atsReport';

export const HistoricalDocumentModal: React.FC<HistoricalDocumentModalProps> = ({
  application,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('cv');
  const now = useAnalysisClock();

  if (!application) return null;

  const snapshot = application.documentSnapshot;
  const atsResult = getRenderableAtsResultSnapshot(snapshot?.atsResultSnapshot);
  const hasMalformedAtsResult = Boolean(snapshot?.atsResultSnapshot) && !atsResult;
  const display = getApplicationSnapshotDisplayInfo(application);
  const atsScoreDisplay = application.atsScore !== undefined
    ? getSavedAtsScoreDisplayInfo(application.atsScore, application.atsScoreContext, application.atsScoreProvenance, now)
    : null;

  const tabs = [
    { id: 'cv' as TabId, label: 'Wysłane CV (A4)', icon: Eye },
    ...(snapshot?.coverLetter
      ? [{ id: 'coverLetter' as TabId, label: 'List Motywacyjny', icon: FileText }]
      : []),
    ...(atsResult
      ? [{ id: 'atsReport' as TabId, label: 'Raport ATS', icon: ShieldCheck }]
      : []),
  ];
  const visibleTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'cv';

  const formattedDate = snapshot?.createdAt
    ? new Date(snapshot.createdAt).toLocaleString('pl-PL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : application.date;

  const handleDownloadDocx = async () => {
    if (!snapshot) return;
    await downloadNativeDocxCv(
      snapshot.vaultSnapshot,
      [],
      snapshot.tailoredResume?.targetJobTitle || snapshot.vaultSnapshot.personalInfo?.title || '',
      snapshot.jobOfferSnapshot?.company || '',
      { summaryOverride: snapshot.tailoredResume?.summary }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dokumenty aplikacyjne • ${display.positionLabel} (${display.companyLabel})`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Pasek metadanych snapshotu */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-fg">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-bold text-ink">
                  {display.positionLabel}
                </span>
                <span className="text-muted text-xs">•</span>
                <span className="font-sans text-xs font-semibold text-muted">
                  {display.companyLabel}
                </span>
              </div>
              <p className="flex items-center gap-1 font-mono text-[11px] text-muted pt-0.5">
                <Calendar className="h-3 w-3" />
                <span>
                  {snapshot
                    ? `Zapisano snapshot: ${formattedDate}`
                    : `Data zgłoszenia: ${application.date}`}
                </span>
                {snapshot && (
                  <span className="inline-flex items-center gap-1 rounded bg-brand-500/15 px-1.5 py-0.2 text-[10px] font-bold text-brand-fg ml-1.5">
                    <Lock className="h-2.5 w-2.5" /> Niezmienna migawka
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshot && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={FileDown}
                onClick={handleDownloadDocx}
                className="text-xs font-semibold"
                title="Pobierz plik Word (.docx) z niezmiennego snapshotu"
              >
                Pobierz Word (.docx)
              </Button>
            )}
            <span className="rounded-lg border border-line bg-sunken px-2.5 py-1 font-mono text-xs font-bold text-ink">
              Status: {application.status}
            </span>
            {atsScoreDisplay && (
              <div className="max-w-sm space-y-0.5">
                <span className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${
                  atsScoreDisplay.state === 'full'
                    ? 'border-brand-500/30 bg-brand-500/10 text-brand-fg'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }`}>
                  {atsScoreDisplay.label}
                </span>
                <p role="note" className="text-[10px] leading-relaxed text-muted">
                  {atsScoreDisplay.note}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Zawartość: Snapshot istnieje */}
        {snapshot ? (
          <div className="space-y-4">
            {hasMalformedAtsResult && <HistoricalAtsReport snapshot={snapshot.atsResultSnapshot} />}
            {tabs.length > 1 && (
              <Tabs<TabId>
                items={tabs}
                active={visibleTab}
                onChange={setActiveTab}
                variant="underline"
              />
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={visibleTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {visibleTab === 'cv' && (
                  <DocumentRenderer
                    vault={snapshot.vaultSnapshot}
                    tailoredResume={snapshot.tailoredResume}
                  />
                )}

                {visibleTab === 'coverLetter' && snapshot.coverLetter && (
                  <CoverLetterView
                    coverLetter={snapshot.coverLetter}
                    isReadOnly={true}
                  />
                )}

                {visibleTab === 'atsReport' && atsResult && (
                  <HistoricalAtsReport snapshot={snapshot.atsResultSnapshot} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* Pusty stan: Aplikacja dodana ręcznie bez snapshotu (Reguła 1: Zero wymyślonych danych) */
          <EmptyState
            icon={AlertCircle}
            title="Brak zapisanej migawki dokumentu"
            description="Ta aplikacja została dodana ręcznie do listy albo utworzona przed wprowadzeniem niezmiennych migawek. Dokumenty wygenerowane w sekcji APLIKUJ są automatycznie utrwalane w całości."
          />
        )}
      </div>
    </Modal>
  );
};
