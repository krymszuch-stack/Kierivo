import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useEntitlements } from '../../store/useEntitlements';
import { PURCHASES_DISABLED_REASON } from '../../lib/betaConfig';

/**
 * Przejście do kasy / informacja o statusie zakupów.
 *
 * W fazie bezpłatnej bety zakupy komercyjne są bezwzględnie wyłączone.
 * Podstawowy przepływ aplikacji oraz dostępne narzędzia są udostępnione testerom bezpłatnie.
 */

export interface StripeCheckoutProduct {
  /** Identyfikator ceny w Stripe (`price_...`). Serwer weryfikuje go w tabeli `plans`. */
  sku: string;
  title: string;
  price: string;
  period: string;
  recurring: boolean;
  /** Cykl odnowienia subskrypcji; brak pola = opis ogólny (np. zakup jednorazowy). */
  interval?: 'month' | 'year';
  trialDays?: number;
}

export interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StripeCheckoutProduct;
  onUnlocked?: () => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  product,
  onUnlocked,
}) => {
  const { grantDemoPro } = useEntitlements();

  const handleDemoUnlock = () => {
    grantDemoPro();
    onUnlocked?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Informacja o planie: ${product.title}`} size="sm">
      <div className="space-y-5">
        {/* Cena jest dominantą, okres i VAT to meta-informacja */}
        <div className="border-b border-line pb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-bold text-ink">{product.price}</span>
            <span className="text-meta text-subtle">{product.period}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-fg">
              Wersja Beta
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-muted">
              Dostęp bezpłatny
            </span>
          </div>
        </div>

        <div className="space-y-2 text-meta text-muted">
          <div className="flex items-center gap-2 rounded-xl bg-success-soft p-2.5 text-success-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>W bezpłatnej wersji beta wszystkie podstawowe moduły są dostępne bez opłat.</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="rounded-2xl border border-line bg-warning-soft/40 p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-warning-fg font-semibold text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Zakupy są wyłączone w bezpłatnej wersji beta</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {PURCHASES_DISABLED_REASON}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-2"
              onClick={onClose}
            >
              Wróć do aplikacji
            </Button>
          </div>

          {/* Odblokowanie testowe dla trybu deweloperskiego — wizualnie odsunięte od ścieżki produkcyjnej */}
          {import.meta.env.DEV && (
            <div className="rounded-lg border border-dashed border-line/70 pt-2 mt-1">
              <button
                type="button"
                onClick={handleDemoUnlock}
                className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-wide text-subtle transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50"
              >
                Dev only: odblokuj lokalnie bez płatności
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-line/60 pt-3 text-meta text-subtle">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          <span>CVelocity Beta • Bezpłatny dostęp testowy</span>
        </div>
      </div>
    </Modal>
  );
};
