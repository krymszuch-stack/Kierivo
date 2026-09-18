import React, { useState } from 'react';
import { Shield, FileText, LifeBuoy, AlertCircle } from 'lucide-react';
import { PrivacyPolicyModal } from '../legal/PrivacyPolicyModal';
import { TermsOfServiceModal } from '../legal/TermsOfServiceModal';
import { SupportContactModal } from '../legal/SupportContactModal';

export interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState<'wsparcie' | 'problem'>('wsparcie');

  const handleOpenSupport = (category: 'wsparcie' | 'problem') => {
    setSupportCategory(category);
    setIsSupportOpen(true);
  };

  return (
    <footer
      className={`border-t border-line/80 bg-surface/90 backdrop-blur-md px-4 py-5 sm:px-6 sm:py-6 lg:px-8 mt-auto shadow-xs ${className}`}
    >
      <div className="mx-auto max-w-[1440px] 2xl:max-w-[1680px] flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
        {/* Lewa strona: Identyfikator i misja */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs sm:text-sm text-ink/70">
          <span className="font-mono font-bold tracking-tight text-ink">KIERIVO</span>
          <span className="text-muted/60" aria-hidden="true">•</span>
          <span className="text-muted">Optymalizacja CV pod ATS i wsparcie kariery</span>
        </div>

        {/* Prawa strona: 4 główne linki o wysokim kontraście i wygodnym klikaniu. Na mobile ułożone w 2 wierszach (siatka 2-kolumnowa) */}
        <nav
          aria-label="Stopka aplikacji"
          className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-4 md:gap-6 font-semibold text-xs sm:text-sm"
        >
          <button
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="flex items-center justify-center sm:justify-start gap-2 text-ink/80 hover:text-brand-600 transition-colors cursor-pointer py-2 px-3 rounded-xl border border-line/50 sm:border-transparent bg-elevated/40 sm:bg-transparent hover:bg-elevated text-center"
          >
            <Shield className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="truncate">Prywatność i RODO</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="flex items-center justify-center sm:justify-start gap-2 text-ink/80 hover:text-brand-600 transition-colors cursor-pointer py-2 px-3 rounded-xl border border-line/50 sm:border-transparent bg-elevated/40 sm:bg-transparent hover:bg-elevated text-center"
          >
            <FileText className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="truncate">Warunki korzystania</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenSupport('wsparcie')}
            className="flex items-center justify-center sm:justify-start gap-2 text-ink/80 hover:text-brand-600 transition-colors cursor-pointer py-2 px-3 rounded-xl border border-line/50 sm:border-transparent bg-elevated/40 sm:bg-transparent hover:bg-elevated text-center"
          >
            <LifeBuoy className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="truncate">Kontakt i wsparcie</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenSupport('problem')}
            className="flex items-center justify-center sm:justify-start gap-2 text-ink/80 hover:text-brand-600 transition-colors cursor-pointer py-2 px-3 rounded-xl border border-line/50 sm:border-transparent bg-elevated/40 sm:bg-transparent hover:bg-elevated text-center"
          >
            <AlertCircle className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="truncate">Zgłoś problem</span>
          </button>
        </nav>
      </div>

      {/* Modale prawne i pomocy */}
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      <TermsOfServiceModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      <SupportContactModal
        isOpen={isSupportOpen}
        defaultCategory={supportCategory}
        onClose={() => setIsSupportOpen(false)}
      />
    </footer>
  );
};
