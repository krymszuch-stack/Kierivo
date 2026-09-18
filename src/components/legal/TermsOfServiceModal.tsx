import React from 'react';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FREE_BETA_LABEL } from '../../lib/beta';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Warunki Korzystania z Aplikacji Kierivo"
      size="lg"
    >
      <div className="space-y-4 text-xs text-ink leading-relaxed">
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 flex items-start gap-3">
          <FileText className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-ink">
              Zasady Użytkowania • {FREE_BETA_LABEL}
            </h4>
            <p className="text-muted text-[11px]">
              Kierivo to narzędzie asystujące w optymalizacji dokumentów aplikacyjnych, przygotowaniu do rozmów i planowaniu ścieżki zawodowej.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl border border-line bg-surface p-4 space-y-1.5">
            <h5 className="font-bold text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              1. Odpowiedzialność za treść i prawdziwość danych
            </h5>
            <p className="text-muted text-[11px]">
              Użytkownik ponosi pełną odpowiedzialność za prawdziwość informacji wprowadzanych do CV i profilu. Kierivo nie generuje zmyślonych faktów, a sugerowane punkty osiągnięć powinny być zawsze zweryfikowane pod kątem zgodności z rzeczywistym doświadczeniem.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 space-y-1.5">
            <h5 className="font-bold text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              2. Brak gwarancji zatrudnienia
            </h5>
            <p className="text-muted text-[11px]">
              Aplikacja zwiększa czytelność CV dla systemów ATS oraz rekruterów, jednak nie stanowi gwarancji otrzymania oferty pracy ani zaproszenia na rozmowę rekrutacyjną. Decyzje kadrowe zależą wyłącznie od pracodawców.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 space-y-1.5">
            <h5 className="font-bold text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-brand-600" />
              3. Przechowywanie danych i kopie zapasowe
            </h5>
            <p className="text-muted text-[11px]">
              W trybie lokalnym dane przechowywane są wyłącznie w pamięci podręcznej przeglądarki użytkownika. Wyczyszczenie historii lub pamięci witryny usuwa dokumenty, chyba że użytkownik korzysta z konta w chmurze lub pobrał plik JSON/PDF.
            </p>
          </section>
        </div>
      </div>
    </Modal>
  );
};
