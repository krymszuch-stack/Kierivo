import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Check,
  XCircle,
  Copy,
  RotateCcw,
  Sliders,
  ShieldCheck,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Textarea, Input } from '../../components/ui/Field';
import { Card } from '../../components/ui/Card';
import { showToast } from '../../store/useToastStore';
import { api } from '../../lib/apiClient';
import { RuleFocus } from '../../lib/sectionRewriterEngine';

export interface SectionRewriterViewProps {
  initialRole?: string;
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
}) => {
  const [inputText, setInputText] = useState('');
  const [roleTitle, setRoleTitle] = useState(initialRole);
  const [ruleFocus, setRuleFocus] = useState<RuleFocus>('star');
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<RewriteApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!inputText.trim() || inputText.trim().length < 5) {
      showToast('Wpisz tekst punktu do poprawki (min. 5 znaków)', { variant: 'error' });
      return;
    }

    setIsLoading(true);
    setCopied(false);

    try {
      // MINIMALNY KONTEKST: przesyłany jest wyłącznie fragment tekstu i nazwa roli,
      // bez całego Master Vaultu, danych osobowych czy kontaktu.
      const res = await api.post<RewriteApiResponse>('/advisor/rewrite-section', {
        text: inputText.trim(),
        roleTitle: roleTitle.trim() || undefined,
        ruleFocus,
      });

      if (res && res.success) {
        setProposal(res);
      } else {
        showToast(res?.error || 'Nie udało się wygenerować propozycji', { variant: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd połączenia z silnikiem rewritingu';
      showToast(msg, { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = () => {
    setProposal(null);
    setCopied(false);
    showToast('Propozycja została odrzucona', {
      message: 'Możesz zmodyfikować kryteria i wygenerować nową wersję.',
      variant: 'info',
    });
  };

  const handleCopy = async () => {
    if (!proposal?.proposedText) return;
    try {
      await navigator.clipboard.writeText(proposal.proposedText);
      setCopied(true);
      showToast('Skopiowano ulepszoną treść do schowka', {
        message: 'Możesz wkleić ten punkt bezpośrednio do swojego CV w Profilu.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Nie udało się skopiować automatycznie', { variant: 'error' });
    }
  };

  const handleSelectExample = (ex: { role: string; text: string }) => {
    setRoleTitle(ex.role);
    setInputText(ex.text);
    setProposal(null);
    setCopied(false);
  };

  return (
    <div className="space-y-5">
      {/* Banner informacyjny o minimalizacji kontekstu i braku fabrykacji */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs text-brand-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div>
          <p className="font-semibold text-ink">Pół-automatyczny asystent sekcji CV (Reguły STAR + Lekki LLM)</p>
          <p className="mt-0.5 text-muted">
            Model analizuje <strong>wyłącznie ten jeden wpisany fragment</strong> — nie czyta całego Twojego Master Vaultu ani danych kontaktowych. Brakujące liczby uzupełnia szablonem, nie zmyśla faktów (Reguła 1).
          </p>
        </div>
      </div>

      {/* Formularz wprowadzania punktu */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-xs font-bold text-ink">
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
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Wklej pojedynczy punkt ze swojego CV (np. „Byłem odpowiedzialny za montaż instalacji...” lub „Robiłem aplikację w React...”)"
          rows={3}
          maxLength={800}
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>Maksymalnie 800 znaków (jeden punktor lub krótki akapit)</span>
          <span>{inputText.length} / 800</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Rola / Stanowisko (kontekst)"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="np. Monter, Spawacz, Magazynier, Programista"
          />

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              Priorytet reguł
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setRuleFocus('star')}
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
                onClick={() => setRuleFocus('ats_clarity')}
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

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Sparkles}
            onClick={handleGenerate}
            disabled={isLoading || inputText.trim().length < 5}
          >
            {isLoading ? 'Generuję propozycję...' : 'Ulepsz ten punkt'}
          </Button>
        </div>
      </div>

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
              >
                {copied ? 'Skopiowano!' : 'Zastosuj i skopiuj'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
