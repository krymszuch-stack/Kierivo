import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  Sparkles,
  Zap,
  Target,
  Award,
  RefreshCw,
} from 'lucide-react';
import { CoverLetter, MasterVault, JobOffer, CvExportEvent } from '../../types';
import { generateAntiTemplateCoverLetter } from '../../lib/coverLetterEngine';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';
import { copyTextAndNotifySuccess } from '../../lib/copyTextAndNotifySuccess';

export interface CoverLetterViewProps {
  coverLetter: CoverLetter;
  vault?: MasterVault;
  jobOffer?: JobOffer;
  /** Tryb tylko do odczytu dla historycznych snapshotów — blokuje re-generację */
  isReadOnly?: boolean;
  /** List wyszedł z aplikacji — patrz `DocumentRendererProps`. */
  onExported?: (event: CvExportEvent) => void;
  className?: string;
}

export const CoverLetterView: React.FC<CoverLetterViewProps> = ({
  coverLetter: initialCoverLetter,
  vault,
  jobOffer,
  isReadOnly = false,
  onExported,
  className = '',
}) => {
  const [variantIndex, setVariantIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // W trybie isReadOnly lub braku parametrów oferty używamy wyłącznie nienaruszonego snapshotu
  const coverLetter =
    !isReadOnly && vault && jobOffer
      ? generateAntiTemplateCoverLetter(
          jobOffer.title,
          jobOffer.company,
          jobOffer.description || jobOffer.rawDescription || '',
          vault,
          variantIndex
        )
      : initialCoverLetter;

  const handleNextVariant = () => {
    setVariantIndex((prev) => (prev + 1) % 8);
  };

  const handleCopy = async () => {
    try {
      await copyTextAndNotifySuccess(coverLetter.fullText, () => onExported?.({
        coverLetter,
        document: { kind: 'cover-letter', format: 'plain-text', content: coverLetter.fullText },
      }));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast('Nie udało się skopiować listu', {
        message: 'Przeglądarka nie zapisała tekstu w schowku. Spróbuj ponownie.',
        variant: 'error',
      });
    }
  };

  const handlePrint = () => {
    window.print();
    onExported?.({
      coverLetter,
      document: { kind: 'cover-letter', format: 'plain-text', content: coverLetter.fullText },
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Controls & Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-elevated p-4 shadow-raised">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                List motywacyjny bez szablonu (0 tokenów)
              </h3>
              {vault && jobOffer && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  Styl #{variantIndex + 1}/8
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">
              Wygenerowany w 100% lokalnie bez zużycia tokenów, ze zróżnicowaną bazą profesjonalnych zwrotów.
            </p>
            <p className="text-[11px] text-muted">
              Treść odzwierciedla wpisy w MasterVault; sprawdź, czy odpowiadają Twojemu doświadczeniu.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && vault && jobOffer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={handleNextVariant}
              title="Wylosuj inny wariant stylistyczny (0 tokenów)"
            >
              Inny styl
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={isCopied ? Check : Copy}
            onClick={handleCopy}
          >
            {isCopied ? 'Skopiowano treść' : 'Kopiuj list'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Printer}
            onClick={handlePrint}
          >
            Drukuj / PDF
          </Button>
        </div>
      </div>

      {/* 3 Strategic Blocks Overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-fg">
            <Target className="h-3.5 w-3.5" />
            <span>1. Wstęp</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed line-clamp-3">
            {coverLetter.hook}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-success-fg">
            <Award className="h-3.5 w-3.5" />
            <span>2. Wpisy z profilu</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed line-clamp-3">
            {coverLetter.proofPoints.join(' ')}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-violet">
            <Sparkles className="h-3.5 w-3.5" />
            <span>3. Zakończenie</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed line-clamp-3">
            {coverLetter.callToAction}
          </p>
        </div>
      </div>

      {/* Full Document Paper Container.
          Własny identyfikator druku: CSS `@media print` odsłania wyłącznie
          #cv-printable-document i #cover-letter-printable-document — bez tego
          „Drukuj / PDF" na tej zakładce dawało pustą kartkę. */}
      <Card tone="raised" id="cover-letter-printable-document" className="p-8 sm:p-12 space-y-6">
        <div className="border-b border-line pb-4">
          <h2 className="text-lg font-bold text-ink">
            Aplikacja na stanowisko: {coverLetter.targetJobTitle}
          </h2>
          <p className="text-xs text-muted">
            Firma: <strong className="text-ink">{coverLetter.companyName}</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-line/60 bg-sunken p-6 font-sans text-xs text-ink leading-relaxed whitespace-pre-wrap">
          {coverLetter.fullText}
        </div>
      </Card>
    </div>
  );
};
