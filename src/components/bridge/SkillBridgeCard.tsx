import React, { useState } from 'react';
import {
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SkillBridge } from '../../types';
import { Button } from '../ui/Button';
import { showToast } from '../../store/useToastStore';

export interface SkillBridgeCardProps {
  bridge: SkillBridge;
  className?: string;
}

export const SkillBridgeCard: React.FC<SkillBridgeCardProps> = ({
  bridge,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bridge.talkingPoint);
      setCopied(true);
      showToast('Skopiowano odpowiedź do schowka', {
        message: `Skopiowano szkic do sprawdzenia: „${bridge.missingSkill}”`,
        variant: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`rounded-2xl border border-line bg-elevated p-5 shadow-raised space-y-4 ${className}`}>
      {/* Powiązane doświadczenie nie zastępuje brakującej umiejętności. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Brakujące X */}
          <span className="rounded-xl border border-error/30 bg-error-soft px-3 py-1.5 font-mono text-xs font-bold text-error-fg flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Nie wykazano w profilu: {bridge.missingSkill}</span>
          </span>

          <div className="flex items-center gap-1 text-brand-600 font-mono text-xs">
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="font-extrabold font-sans">Doświadczenie powiązane</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>

          {/* Rzeczywisty wpis z profilu */}
          <span className="rounded-xl border border-success/30 bg-success-soft px-3 py-1.5 font-mono text-xs font-bold text-success-fg flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>W profilu: {bridge.adjacentSkill}</span>
          </span>
        </div>

      </div>

      {/* 2. Ekwiwalencja Pojęciowa */}
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 space-y-1">
        <span className="font-mono text-[10px] font-extrabold text-brand-700 uppercase tracking-wider block">
          Powiązane zagadnienia — nie oznaczają równoważności:
        </span>
        <p className="text-xs text-ink/90 font-sans leading-relaxed">
          {bridge.relatedTopics}
        </p>
      </div>

      {/* Szkic opisuje lukę bez przypisywania brakującej kompetencji. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold text-muted uppercase tracking-wider">
            Szkic do edycji i sprawdzenia:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={copied ? Check : Copy}
            onClick={handleCopy}
          >
            {copied ? 'Skopiowano!' : 'Kopiuj odpowiedź'}
          </Button>
        </div>

        <blockquote className="rounded-xl border-l-4 border-brand-600 bg-surface p-3.5 text-xs text-ink/90 font-sans italic leading-relaxed shadow-xs">
          „{bridge.talkingPoint}”
        </blockquote>
      </div>

      {/* 4. Dowód z MasterVault */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line text-[11px] font-mono text-muted">
        {bridge.evidenceFromVault ? (
          <span className="flex items-center gap-1 text-ink">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            <span>Dowód z MasterVault: <strong>{bridge.evidenceFromVault}</strong></span>
          </span>
        ) : (
          <span className="text-subtle">Powiązanie wynika z wybranej pozycji w profilu</span>
        )}
      </div>
    </div>
  );
};
