import React, { useState } from 'react';
import { ShieldCheck, Lock, Database, Trash2, EyeOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  productInsightsEnabled,
  readProductInsights,
  setProductInsightsEnabled,
} from '../../lib/productInsights';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [insightsEnabled, setInsightsEnabled] = useState(productInsightsEnabled);
  const [insights, setInsights] = useState(readProductInsights);

  const handleInsightsChange = (enabled: boolean) => {
    setProductInsightsEnabled(enabled);
    setInsightsEnabled(enabled);
    setInsights(readProductInsights());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Polityka Prywatności i Ochrona Danych (RODO)"
      size="lg"
    >
      <div className="space-y-5 text-xs text-ink leading-relaxed">
        <div className="rounded-2xl border border-success-500/30 bg-success-500/5 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-success-fg shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-ink">Zasada Local-First i Zero Nieautoryzowanego Śledzenia</h4>
            <p className="text-muted text-[11px]">
              Dane profilu są przechowywane zależnie od wybranego trybu: lokalnie w pamięci przeglądarki albo w chmurowym Vault przypisanym do konta po zalogowaniu i synchronizacji. Aplikacja nie szyfruje lokalnych danych osobno.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-sunken p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h5 className="font-bold text-sm text-ink">Dobrowolne dane o korzystaniu</h5>
                <p className="mt-1 text-[11px] text-muted">
                  Pomagają ocenić, które funkcje są używane. Zapisujemy tylko lokalne liczniki otwarć i kliknięć — bez treści CV, ofert, pytań, identyfikatora ani wysyłki na serwer.
                </p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={insightsEnabled}
                  onChange={(event) => handleInsightsChange(event.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                Włącz
              </label>
            </div>
            {insightsEnabled ? (
              <p className="rounded-xl border border-line bg-surface px-3 py-2 text-[10px] text-muted">
                Na tym urządzeniu: Doradca {insights.events.advisor_opened}×, wskazówki {insights.events.advisor_suggestion_clicked}×, artykuły {insights.events.career_article_opened}×.
              </p>
            ) : (
              <p className="text-[10px] text-muted">Domyślnie wyłączone. Możesz włączyć lub wyłączyć w każdej chwili.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <h5 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Database className="h-4 w-4 text-brand-600" />
              1. Administrator Danych
            </h5>
            <p className="text-muted">
              Administratorem danych osobowych przetwarzanych w ramach serwisu jest właściciel Kierivo. Kontakt w sprawach ochrony danych: <strong>prywatnosc@kierivo.com</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <h5 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-600" />
              2. Zakres i Cel Przetwarzania
            </h5>
            <p className="text-muted">
              Profil służy do tworzenia i edycji CV, dopasowania do ofert oraz przygotowania dokumentów aplikacyjnych. Tryb lokalny przechowuje Vault w przeglądarce; w trybie chmurowym Vault synchronizuje się z usługą konta. To podsumowanie funkcji nie określa podstaw prawnych dla poszczególnych operacji.
            </p>
          </div>

          <div className="space-y-1.5">
            <h5 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <EyeOff className="h-4 w-4 text-brand-600" />
              3. Anonimizacja i AI
            </h5>
            <p className="text-muted">
              Funkcje AI działają osobno od lokalnego przechowywania profilu. Przed wybranymi operacjami zobaczysz, jaki tekst zostanie wysłany, i potwierdzasz wysyłkę. Niektóre ścieżki zastępują rozpoznane dane kontaktowe, ale nie oznacza to pełnej anonimizacji — treść może nadal zawierać dane osobowe. Microsoft informuje, że prompty i odpowiedzi modeli Azure nie są używane do trenowania modeli bazowych bez zgody lub instrukcji klienta; zasady przechowywania i monitorowania zależą od usługi oraz jej konfiguracji. <a href="https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy" target="_blank" rel="noopener noreferrer" className="text-brand-fg underline">Zasady danych i prywatności modeli Azure</a>.
            </p>
          </div>

          <div className="space-y-1.5">
            <h5 className="font-bold text-sm text-ink flex items-center gap-1.5">
              <Trash2 className="h-4 w-4 text-brand-600" />
              4. Prawo do usunięcia danych (Prawo do bycia zapomnianym)
            </h5>
            <p className="text-muted">
              W każdej chwili możesz całkowicie wyczyścić dane ze swojej przeglądarki w ustawieniach konta lub usunąć konto w chmurze jednym kliknięciem.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-line/60 flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Zamknij
          </Button>
        </div>
      </div>
    </Modal>
  );
};
