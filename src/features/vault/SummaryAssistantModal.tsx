import React, { useMemo } from 'react';
import { Sparkles, Check, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { MasterVault } from '../../types';
import { generateSummarySuggestions, SummarySuggestion } from '../../lib/summaryEngine';

export interface SummaryAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  onSelectSummary: (summaryText: string) => void;
}

export const SummaryAssistantModal: React.FC<SummaryAssistantModalProps> = ({
  isOpen,
  onClose,
  vault,
  onSelectSummary,
}) => {
  const suggestions = useMemo(() => {
    return generateSummarySuggestions(vault, 4);
  }, [vault]);

  const handlePick = (sug: SummarySuggestion) => {
    onSelectSummary(sug.text);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generator Podsumowania Zawodowego (Beztokenowy)"
      size="lg"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <span>Podsumowanie oparte na faktach</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              Zero zmyślonych danych
            </span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Propozycje zostały przygotowane lokalnie wyłącznie z danych Twojego profilu (stanowisko, historia zatrudnienia, umiejętności). Brak zmyślonych metryk ani niepotwierdzonych osiągnięć — wybierz wariant, który najlepiej odpowiada Twojemu doświadczeniu.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center space-y-2">
            <p className="text-xs font-medium text-ink">Brak danych do wygenerowania propozycji</p>
            <p className="text-[11px] text-muted">
              Uzupełnij stanowisko, historię pracy lub umiejętności w profilu, aby przygotować propozycje podsumowania zawodowego.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {suggestions.map((sug, idx) => (
              <div
                key={sug.id || idx}
                className="rounded-2xl border border-line bg-surface p-4 hover:border-brand-500/40 transition-colors shadow-2xs space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-brand-500/10 text-brand-600 px-2 py-0.5 font-mono text-[10px] font-bold">
                        {sug.styleName}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">
                      {sug.wordCount} słów • {sug.sentenceCount} {sug.sentenceCount === 1 ? 'zdanie' : 'zdania'}
                    </span>
                  </div>

                  <p className="text-xs text-ink leading-relaxed font-medium">
                    {sug.text}
                  </p>
                </div>

                <div className="pt-2 border-t border-line/50 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {sug.highlightedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="rounded bg-sunken px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => handlePick(sug)}
                    className="text-xs h-7 px-3"
                  >
                    Wstaw do profilu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
