import React, { useState } from 'react';
import { UploadCloud, FileCode, Sparkles } from 'lucide-react';
import { MasterVault } from '../../types';
import { DropZone } from './DropZone';
import { DiffView, MergeStrategies } from './DiffView';
import { applyParsedCVToVault } from '../../lib/vaultImportMerge';
import { extractTextFromAnyFile, parseTextToMasterVault, ParsedCVResult } from '../../lib/cvUniversalParser';
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
    { id: 'file' as IngestMode, label: 'Plik z dysku (PDF/DOCX)', icon: UploadCloud },
    { id: 'rawText' as IngestMode, label: 'Wklej surowy tekst (bezpłatnie)', icon: FileCode },
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
      if (!rawText.trim() || rawText.trim().length < 30) {
        showToast('Za mało treści', { message: 'Wklejony tekst jest zbyt krótki do analizy.', variant: 'error' });
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

    const result = portableResult || parseTextToMasterVault(textToParse);
    if (ingestMode === 'file') {
      consumeImport();
      result.detectedFormat = portableResult
        ? 'Smart Portable PDF'
        : (selectedFile?.name.split('.').pop()?.toUpperCase() || 'Plik');
    } else {
      result.detectedFormat = 'Wklejony tekst';
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

    const części: string[] = [];
    if (added.history) części.push(`${added.history} stanowisk`);
    if (added.education) części.push(`${added.education} szkół`);
    const dodaneUmiejętności =
      added.hardSkills + added.softSkills + added.toolsAndTech + added.certifications;
    if (dodaneUmiejętności) części.push(`${dodaneUmiejętności} pozycji umiejętności`);

    showToast('CV scalone z profilem', {
      message: części.length ? `Dodano: ${części.join(', ')}.` : 'Nie wykryto nowych pozycji do dodania.',
      variant: 'success',
    });

    setParsedResult(null);
    setSelectedFile(null);
    setRawText('');
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader
        title="Wczytywanie i scalanie dokumentu CV"
        description="Zaimportuj CV z pliku albo wklej jego treść. Parser lokalny wyodrębni historię, umiejętności i dane kontaktowe do porównania z Master Vault."
        badge="Parser Kierivo"
      />

      {!parsedResult ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <Tabs<IngestMode>
              items={ingestTabs}
              active={ingestMode}
              onChange={setIngestMode}
              className="max-w-md"
            />

            {ingestMode === 'file' && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                {usage.importUses > 0 ? (
                  <span>Pozostało importów pliku w tym miesiącu: <b className="text-ink">{usage.importUses}</b></span>
                ) : (
                  <span className="text-warning-fg font-bold">
                    Limit plików wykorzystany. Wklejanie tekstu pozostaje dostępne bez płatności.
                  </span>
                )}
              </div>
            )}
          </div>

          <Card tone="raised" className="space-y-4">
            {ingestMode === 'file' ? (
              <DropZone
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                isProcessing={isProcessing}
              />
            ) : (
              <div className="space-y-2">
                <Textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Wklej tutaj pełną treść swojego dokumentu CV..."
                  className="font-mono text-xs"
                />
                <p className="font-mono text-[11px] text-muted">
                  Znaków: {rawText.length} • Słów: {rawText.trim().split(/\s+/).filter(Boolean).length} • Wklejanie tekstu jest bezpłatne i bez limitu płatnego.
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span className="flex items-center gap-1.5 text-brand-fg">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    {statusMessage}
                  </span>
                  <span className="font-mono">{parseProgress}%</span>
                </div>
                <ProgressBar value={parseProgress} max={100} showLabel={false} barColor="bg-brand-600" />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="lg"
                icon={Sparkles}
                loading={isProcessing}
                disabled={isProcessing || (ingestMode === 'file' && !selectedFile) || (ingestMode === 'rawText' && rawText.length < 30)}
                onClick={handleStartParsing}
              >
                {isProcessing ? 'Parsowanie dokumentu...' : 'Rozpocznij parsowanie i przygotuj Diff'}
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
