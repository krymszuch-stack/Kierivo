import React, { useId, useLayoutEffect, useState } from 'react';
import { createAdvisorRequestGuard } from './advisorRequestGuard';
import {
  Sparkles,
  Check,
  XCircle,
  Copy,
  RotateCcw,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Textarea, Input } from '../../components/ui/Field';
import { showToast } from '../../store/useToastStore';
import { api } from '../../lib/apiClient';
import { RuleFocus } from '../../lib/sectionRewriterEngine';
import { canCopySectionRewrite } from './sectionRewriteReview';
import { copyTextAndNotifySuccess } from '../../lib/copyTextAndNotifySuccess';

export interface SectionRewriterViewProps {
  initialRole?: string;
  azureAvailable?: boolean;
  onNavigateToProfile?: () => void;
}

interface RewriteApiResponse {
  success: boolean;
  originalText: string;
  proposedText: string;
  ruleExplanation: string;
  appliedRules: string[];
  diffHighlights?: {
    addedOrChanged: string[];
  };
  model: string;
  error?: string;
}

const EXAMPLE_BULLETS = [
  {
    role: 'Monter instalacji sanitarnych',
    text: 'Zajmowałem się montażem rur i usuwaniem awarii hydraulicznych u klientów.',
  },
  {
    role: 'Magazynier - Operator wózka',
    text: 'Wykonywałem załadunek 40 palet dziennie wózkiem widłowym.',
  },
  {
    role: 'Frontend Developer',
    text: 'Brałem udział w tworzeniu aplikacji w React i poprawianiu wydajności kodu.',
  },
];

export const SectionRewriterView: React.FC<SectionRewriterViewProps> = ({
  initialRole = '',
  azureAvailable = false,
}) => {
  const textId = useId();
  const textHintId = useId();
  const ruleLabelId = useId();
  const [inputText, setInputText] = useState('');
  const [roleTitle, setRoleTitle] = useState(initialRole);
  const [ruleFocus, setRuleFocus] = useState<RuleFocus>('star');
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<RewriteApiResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [azureConsent, setAzureConsent] = useState(false);
  const [factsVerified, setFactsVerified] = useState(false);
  const [proposalInvalidated, setProposalInvalidated] = useState(false);
  const [requestGuard] = useState(createAdvisorRequestGuard);
  const [copyGuard] = useState(createAdvisorRequestGuard);
  useLayoutEffect(() => () => {
    requestGuard.invalidate();
    copyGuard.invalidate();
  }, [requestGuard, copyGuard]);
  useLayoutEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const resetCopy = () => {
    copyGuard.invalidate();
    setCopied(false);
  };

  // Potwierdzenie dotyczy konkretnej propozycji dla konkretnego tekstu i kryteriów.
  // Zmiana i powrót do starej treści nie przywracają zgody na jej kopiowanie.
  const invalidateProposal = () => {
    if (proposal || requestGuard.isBusy()) setProposalInvalidated(true);
    requestGuard.invalidate();
    setProposal(null);
    setFactsVerified(false);
    resetCopy();
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (!inputText.trim() || inputText.trim().length < 5) {
      showToast('Wpisz tekst punktu do poprawki (min. 5 znaków)', { variant: 'error' });
      return;
    }
    if (!azureAvailable || !azureConsent) return;
    const requestToken = requestGuard.begin();
    if (!requestToken) return;

    setIsLoading(true);
    setProposal(null);
    setProposalInvalidated(false);
    resetCopy();
    setFactsVerified(false);

    try {
      // MINIMALNY KONTEKST: przesyłany jest wyłącznie fragment tekstu i nazwa roli,
      // bez całego Master Vaultu, danych osobowych czy kontaktu.
      const res = await api.post<RewriteApiResponse>('/advisor/rewrite-section', {
        text: inputText.trim(),
        roleTitle: roleTitle.trim() || undefined,
        ruleFocus,
        consentToAzure: true,
      });

      if (!requestGuard.isCurrent(requestToken)) return;
      if (res && res.success) {
        setProposal(res);
      } else {
        showToast(res?.error || 'Nie udało się wygenerować propozycji', { variant: 'error' });
      }
    } catch (err: unknown) {
      if (!requestGuard.isCurrent(requestToken)) return;
      const msg = err instanceof Error ? err.message : 'Błąd połączenia z silnikiem rewritingu';
      showToast(msg, { variant: 'error' });
    } finally {
      if (requestGuard.finish(requestToken)) setIsLoading(false);
    }
  };

  const handleReject = () => {
    setProposal(null);
    resetCopy();
    setFactsVerified(false);
    showToast('Propozycja została odrzucona', {
      message: 'Możesz zmodyfikować kryteria i wygenerować nową wersję.',
      variant: 'info',
    });
  };

  const handleCopy = async () => {
    if (!proposal || !canCopySectionRewrite(proposal.proposedText, factsVerified)) return;
    const copyToken = copyGuard.begin();
    if (!copyToken) return;
    setCopied(false);
    try {
      await copyTextAndNotifySuccess(proposal.proposedText);
      // Clipboard API nie da się odwołać. Zakończenie starego zapisu nie może
      // nadać nowej propozycji stanu „skopiowano” ani zgłosić jej sukcesu.
      if (!copyGuard.isCurrent(copyToken)) return;
      setCopied(true);
      showToast('Skopiowano ulepszoną treść do schowka', {
        message: 'Możesz wkleić ten punkt bezpośrednio do swojego CV w Profilu.',
      });
    } catch {
      if (!copyGuard.isCurrent(copyToken)) return;
      showToast('Nie udało się skopiować automatycznie', { variant: 'error' });
    } finally {
      copyGuard.finish(copyToken);
    }
  };

  const handleSelectExample = (ex: { role: string; text: string }) => {
    invalidateProposal();
    setRoleTitle(ex.role);
    setInputText(ex.text);
  };

  return (
    <div className="space-y-5">
      {/* Banner informacyjny o minimalizacji kontekstu i braku fabrykacji */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs text-brand-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div>
          <p className="font-semibold text-ink">Doradca zaufany — propozycja zmian przez Azure OpenAI</p>
          <p className="mt-0.5 text-muted">
            Do Azure OpenAI trafia <strong>wyłącznie ten fragment i opcjonalna nazwa roli</strong> — nie cały Master Vault. Model może się mylić; sprawdź propozycję i nie przyjmuj niepotwierdzonych faktów.
          </p>
          {!azureAvailable && <p className="mt-2 font-semibold text-danger-fg">Azure OpenAI jest niedostępne. Wymagany jest tryb chmurowy, logowanie i konfiguracja deploymentu.</p>}
        </div>
      </div>

      {/* Formularz wprowadzania punktu */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor={textId} className="text-xs font-bold text-ink">
            Treść punktu lub sekcji do ulepszenia:
          </label>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-muted">Przykłady:</span>
            {EXAMPLE_BULLETS.map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectExample(ex)}
                className="rounded-md border border-line bg-sunken px-2 py-0.5 text-[10px] font-medium text-muted hover:border-brand-300 hover:text-ink transition-colors"
              >
                {ex.role.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          id={textId}
          aria-describedby={textHintId}
          value={inputText}
          onChange={(e) => { invalidateProposal(); setInputText(e.target.value); }}
          placeholder="Wklej pojedynczy punkt ze swojego CV (np. „Byłem odpowiedzialny za montaż instalacji...” lub „Robiłem aplikację w React...”)"
          rows={3}
          maxLength={800}
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span id={textHintId}>Maksymalnie 800 znaków (jeden punktor lub krótki akapit)</span>
          <span>{inputText.length} / 800</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Rola / Stanowisko (kontekst)"
            value={roleTitle}
            onChange={(e) => { invalidateProposal(); setRoleTitle(e.target.value); }}
            placeholder="np. Monter, Spawacz, Magazynier, Programista"
          />

          <div>
            <span id={ruleLabelId} className="mb-1 block text-xs font-semibold text-ink">
              Priorytet reguł
            </span>
            <div role="group" aria-labelledby={ruleLabelId} className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                aria-pressed={ruleFocus === 'star'}
                onClick={() => { if (ruleFocus !== 'star') invalidateProposal(); setRuleFocus('star'); }}
                className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ${
                  ruleFocus === 'star'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                Metoda STAR
              </button>
              <button
                type="button"
                aria-pressed={ruleFocus === 'ats_clarity'}
                onClick={() => { if (ruleFocus !== 'ats_clarity') invalidateProposal(); setRuleFocus('ats_clarity'); }}
                className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ${
                  ruleFocus === 'ats_clarity'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xs'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                Standard ATS
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-line bg-sunken p-2.5 text-[11px] leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={azureConsent}
            onChange={(event) => setAzureConsent(event.target.checked)}
            className="mt-0.5 accent-brand-600"
          />
          <span>Potwierdzam wysłanie tego fragmentu i nazwy roli do Azure OpenAI przez API.</span>
        </label>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Sparkles}
            onClick={handleGenerate}
            disabled={isLoading || !azureAvailable || !azureConsent || inputText.trim().length < 5}
          >
            {isLoading ? 'Generuję propozycję...' : 'Ulepsz ten punkt'}
          </Button>
        </div>
      </div>

      {proposalInvalidated && <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-xs text-ink">Treść lub kryteria zmieniły się. Poprzednia propozycja została wycofana. Wygeneruj nową i sprawdź jej fakty przed kopiowaniem.</p>}
      {/* Podgląd zmian (Diff / Before & After) z możliwością odrzucenia */}
      {proposal && (
        <div className="mt-6 space-y-4 rounded-2xl border border-line bg-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <span>Podgląd propozycji zmian</span>
            </h3>
            <span className="rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[10px] text-muted">
              Silnik: {proposal.model}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Przed zmianą */}
            <div className="rounded-xl border border-danger/20 bg-danger-soft/30 p-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-danger-fg block mb-1">
                Przed zmianą (Oryginał):
              </span>
              <p className="text-xs text-ink/80 leading-relaxed">
                {proposal.originalText}
              </p>
            </div>

            {/* Po zmianie */}
            <div className="rounded-xl border border-success/30 bg-success-soft/30 p-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-success-fg block mb-1">
                Po ulepszeniu (Zgodnie z regułami STAR & ATS):
              </span>
              <p className="text-xs font-medium text-ink leading-relaxed">
                {proposal.proposedText}
              </p>
            </div>
          </div>

          {/* Wyjaśnienie regułowe */}
          <div className="space-y-2 rounded-xl border border-line bg-sunken/60 p-3">
            <span className="text-xs font-bold text-ink flex items-center gap-1">
              <Sliders className="h-3.5 w-3.5 text-muted" />
              Uzasadnienie eksperckie i zastosowane reguły:
            </span>
            <p className="text-xs text-muted leading-relaxed">
              {proposal.ruleExplanation}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {proposal.appliedRules.map((rule, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700"
                >
                  ✓ {rule}
                </span>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-xs leading-relaxed text-ink">
            <input
              type="checkbox"
              checked={factsVerified}
              onChange={(event) => { resetCopy(); setFactsVerified(event.target.checked); }}
              className="mt-0.5 accent-brand-600"
            />
            <span>Sprawdziłem propozycję. Potwierdzam, że każda liczba, umiejętność i informacja o moim doświadczeniu jest prawdziwa.</span>
          </label>

          {/* Przyciski decyzyjne */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={XCircle}
              onClick={handleReject}
            >
              Odrzuć propozycję
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onClick={handleGenerate}
                disabled={isLoading}
              >
                Inny wariant
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopy}
                disabled={!canCopySectionRewrite(proposal.proposedText, factsVerified)}
              >
                {copied ? 'Skopiowano!' : 'Skopiuj propozycję'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
