import React, { useState } from 'react';
import {
  Eye,
  FileEdit,
  ShieldCheck,
  FileText,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MasterVault,
  JobOffer,
  AtsCheckResult,
  TailoredResume,
  CoverLetter,
  GeneratedCvExport,
} from '../../types';
import { type CanonicalAtsScore } from '../../lib/canonicalAts';
import { createApplicationDocumentSnapshot } from '../../lib/applicationSnapshot';
import { DocumentRenderer } from './DocumentRenderer';
import { CVWordBuilder } from './CVWordBuilder';
import { AtsSimulatorView } from './AtsSimulatorView';
import { CoverLetterView } from './CoverLetterView';
import { InterviewCheatSheetView } from './InterviewCheatSheetView';
import { ConsistencyGuardView } from '../consistency/ConsistencyGuardView';
import { JDKeywordMapper } from './JDKeywordMapper';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { requestApplicationConfirmation } from '../../store/usePendingApplication';

export type SubTabId =
  | 'generator'
  | 'editor'
  | 'report'
  | 'mapper'
  | 'coverLetter'
  | 'cheatSheet'
  | 'consistency';

export interface RealtimeLivePreviewProps {
  vault: MasterVault;
  jobOffer: JobOffer;
  atsResult: AtsCheckResult;
  canonicalResult?: CanonicalAtsScore;
  tailoredResume: TailoredResume;
  coverLetter: CoverLetter;
  onSaveTailoredCV?: () => void;
  className?: string;
}

export const RealtimeLivePreview: React.FC<RealtimeLivePreviewProps> = ({
  vault,
  jobOffer,
  atsResult,
  canonicalResult,
  tailoredResume,
  coverLetter,
  onSaveTailoredCV,
  className = '',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('generator');

  /**
   * Eksport dokumentu to jedyny moment, w którym wiadomo, że użytkownik
   * naprawdę zamierza aplikować — i jedyny, w którym wypada o to zapytać.
   * Pytanie pokazuje `ApplicationFeedbackModal` podpięty globalnie w `App`.
   */
  const notifyExported = (exportedCv?: GeneratedCvExport) =>
    requestApplicationConfirmation({
      jobId: jobOffer.id,
      company: jobOffer.company,
      title: jobOffer.title,
      sourceUrl: jobOffer.url,
      salary: jobOffer.salary,
      atsScore: canonicalResult?.score ?? atsResult?.overallScore,
      missingKeywords: canonicalResult?.missingRequirements?.length
        ? canonicalResult.missingRequirements
        : atsResult?.missingHardSkills,
      documentSnapshot: createApplicationDocumentSnapshot({
        vault,
        tailoredResume,
        jobOffer,
        atsResult,
        coverLetter,
        exportedCv,
      }),
    });

  const subTabs = [
    { id: 'generator' as SubTabId, label: 'Generator gotowego CV', icon: Eye },
    { id: 'editor' as SubTabId, label: 'Edytor Dokumentu', icon: FileEdit },
    { id: 'report' as SubTabId, label: 'Raport ATS & Wynik', icon: ShieldCheck },
    { id: 'mapper' as SubTabId, label: 'Mapper Słów Kluczowych', icon: Tag },
    { id: 'coverLetter' as SubTabId, label: 'List Motywacyjny', icon: FileText },
    { id: 'cheatSheet' as SubTabId, label: 'Ściąga na Rozmowę', icon: BookOpen },
    { id: 'consistency' as SubTabId, label: 'Kontrola danych', icon: ShieldCheck },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Underline Sub-Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-2">
        <Tabs<SubTabId>
          items={subTabs}
          active={activeSubTab}
          onChange={setActiveSubTab}
          variant="underline"
        />

        {onSaveTailoredCV && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            onClick={onSaveTailoredCV}
          >
            Zapisz na liście aplikacji
          </Button>
        )}
      </div>

      {/* Sub-Views */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
        >
          {activeSubTab === 'generator' && (
            <DocumentRenderer
              vault={vault}
              tailoredResume={tailoredResume}
              onExported={notifyExported}
            />
          )}

          {activeSubTab === 'editor' && (
            <CVWordBuilder
              vault={vault}
              onExported={notifyExported}
            />
          )}

          {activeSubTab === 'report' && (
            <AtsSimulatorView
              result={atsResult}
              canonicalResult={canonicalResult}
            />
          )}

          {activeSubTab === 'mapper' && (
            <JDKeywordMapper
              initialJdText={jobOffer.description || jobOffer.requirements?.join(' ') || jobOffer.title}
              vault={vault}
              tailoredResume={tailoredResume}
            />
          )}

          {activeSubTab === 'coverLetter' && (
            <CoverLetterView
              coverLetter={coverLetter}
              vault={vault}
              jobOffer={jobOffer}
              onExported={notifyExported}
            />
          )}

          {activeSubTab === 'cheatSheet' && (
            <InterviewCheatSheetView
              vault={vault}
              jobOffer={jobOffer}
            />
          )}

          {activeSubTab === 'consistency' && (
            <ConsistencyGuardView
              vault={vault}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
