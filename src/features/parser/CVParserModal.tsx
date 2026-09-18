import React, { useState } from 'react';
import { UploadCloud, FileCode, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { MasterVault } from '../../types';
import { DropZone } from './DropZone';
import { DiffView, MergeStrategies } from './DiffView';
import { applyParsedCVToVault } from '../../lib/vaultImportMerge';
import { extractTextFromAnyFile, ParsedCVResult } from '../../lib/cvUniversalParser';
import {
  validateRawCvText,
  resolveCvIngestionResult,
  formatCvMergeSummary,
} from '../../lib/cvIngestionEngine';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Tabs } from '../../components/ui/Tabs';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEntitlements } from '../../store/useEntitlements';
import { showToast } from '../../store/useToastStore';

export interface CVParserModalProps {
  currentVault: MasterVault;
  onApplyVault: (vault: MasterVault) => void;
  className?: string;
}

type IngestMode = 'file' | 'rawText';

export const CVParserModal: React.FC<CVParserModalProps> = ({
  currentVault,
  onApplyVault,
  className = '',
}) => {
  const [ingestMode, setIngestMode] = useState<IngestMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedCVResult | null>(null);

  const { usage, consumeImport } = useEntitlements();

  const ingestTabs = [
    { id: 'file' as IngestMode, label: 'Prześlij plik', icon: UploadCloud },
    { id: 'rawText' as IngestMode, label: 'Wklej treść', icon: FileCode },
  ];

  const handleStartParsing = async () => {
    let textToParse = rawText;
    let portableResult: ParsedCVResult | undefined;

    if (ingestMode === 'file') {
      if (!selectedFile) {
        showToast('Nie wybrano pliku', { message: 'Wybierz lub upuść dokument CV.', variant: 'error' });
        return;
      }

      if (usage.importUses <= 0) {
        setIngestMode('rawText');
        showToast('Limit importu plików wykorzystany', {
          message: 'Zakupy są wyłączone w bezpłatnej becie. Wklej treść CV jako tekst i kontynuuj bez płatności.',
          variant: 'info',
        });
        return;
      }

      setIsProcessing(true);
      setParseProgress(20);
      try {
        const extracted = await extractTextFromAnyFile(selectedFile);
        textToParse = extracted.text;
        portableResult = extracted.portableVault;
      } catch {
        showToast('Nie udało się odczytać pliku', { message: 'Spróbuj wkleić treść CV ręcznie.', variant: 'error' });
        setIsProcessing(false);
        return;
      }

      if (portableResult) {
        showToast('Wykryto profil Smart Portable CV', {
          message: 'Bezstratny odczyt danych z certyfikowanego pliku PDF.',
          variant: 'success',
        });
      }
    } else {
      const validation = validateRawCvText(rawText);
      if (!validation.valid) {
        showToast('Za mało treści', {
          message: validation.error || 'Wklejony tekst jest zbyt krótki do analizy.',
          variant: 'error',
        });
        return;
      }
      setIsProcessing(true);
    }

    setParseProgress(50);
    setStatusMessage(
      portableResult
        ? 'Błyskawiczny odczyt certyfikowanego rekordu MasterVault...'
        : 'Analiza sekcji, ról oraz słów kluczowych...'
    );

    await new Promise((resolve) => setTimeout(resolve, 600));

    setParseProgress(80);
    setStatusMessage('Formatowanie widoku porównawczego (Diff)...');

    const result = resolveCvIngestionResult({
      extractedText: textToParse,
      portableResult,
      fileName: selectedFile?.name,
      isFile: ingestMode === 'file',
    });

    if (ingestMode === 'file') {
      consumeImport();
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    setParseProgress(100);
    setIsProcessing(false);
    setParsedResult(result);
  };

  const handleApplyMerge = (strategies: MergeStrategies) => {
    if (!parsedResult) return;

    const { vault: scalonyVault, added } = applyParsedCVToVault(currentVault, parsedResult, strategies);
    onApplyVault(scalonyVault);

    showToast('CV scalone z profilem', {
      message: formatCvMergeSummary(added),
      variant: 'success',
    });

    setParsedResult(null);
    setSelectedFile(null);
    setRawText('');
  };

  return (
    <div className={`mx-auto w-full max-w-[820px] px-4 sm:px-6 space-y-6 ${className}`}>
      <PageHeader
        title="Importuj swoje CV"
        description="Dodaj plik lub wklej treść CV. Pokażemy, jakie informacje możesz dodać do swojego profilu."
        badge="Automatyczne rozpoznawanie treści"
      />

      {!parsedResult ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2.5">
            <Tabs<IngestMode>
              items={ingestTabs}
              active={ingestMode}
              onChange={setIngestMode}
              className="max-w-xs sm:max-w-sm w-full"
            />

            {ingestMode === 'file' && usage.importUses <= 0 && (
              <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Limit importów plików został wykorzystany. Możesz nadal bezpłatnie wkleić treść CV.</span>
              </div>
            )}

            {ingestMode === 'file' && usage.importUses > 0 && (
              <div className="text-[11px] font-mono text-muted">
                Pozostało importów plików w tym miesiącu: <b className="text-ink">{usage.importUses}</b>
              </div>
            )}
          </div>

          <Card tone="raised" className="p-5 sm:p-6 space-y-4">
            {ingestMode === 'file' ? (
              <DropZone
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                isProcessing={isProcessing}
              />
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Wklej tutaj treść swojego dokumentu CV (np. skopiowaną z pliku Word, PDF lub profilu zawodowego)..."
                  className="h-[300px] min-h-[280px] max-h-[360px] font-mono text-xs w-full resize-y"
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-muted px-1">
                  <span>
                    Znaków: <b className="text-ink">{rawText.length}</b> • Słów: <b className="text-ink">{rawText.trim().split(/\s+/).filter(Boolean).length}</b>
                  </span>
                  <span>Wklejanie tekstu jest bezpłatne</span>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2 pt-1 border-t border-line/60">
                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                  <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    {statusMessage}
                  </span>
                  <span className="font-mono">{parseProgress}%</span>
                </div>
                <ProgressBar value={parseProgress} max={100} showLabel={false} barColor="bg-brand-600" />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-line/50">
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                <span>Treść jest przetwarzana lokalnie.</span>
              </div>

              <Button
                variant="primary"
                size="md"
                icon={Sparkles}
                loading={isProcessing}
                disabled={
                  isProcessing ||
                  (ingestMode === 'file' && !selectedFile) ||
                  (ingestMode === 'rawText' && rawText.trim().length < 30)
                }
                onClick={handleStartParsing}
              >
                {isProcessing ? 'Analizowanie CV...' : 'Przeanalizuj CV i pokaż różnice'}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <DiffView
          currentVault={currentVault}
          parsedData={parsedResult}
          onApplyMerge={handleApplyMerge}
          onCancel={() => setParsedResult(null)}
        />
      )}
    </div>
  );
};
