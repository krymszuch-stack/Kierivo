import React from 'react';
import { Mail, MessageSquare, LifeBuoy, Send, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { showToast } from '../../store/useToastStore';

interface SupportContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: 'wsparcie' | 'problem';
}

export const SupportContactModal: React.FC<SupportContactModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'wsparcie',
}) => {
  const [feedback, setFeedback] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [isSent, setIsSent] = React.useState(false);

  const isProblem = defaultCategory === 'problem';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setIsSent(true);
    showToast('Wiadomość wysłana', {
      message: 'Dziękujemy! Nasz zespół odpowie w ciągu 24 godzin.',
      variant: 'success',
    });
    setTimeout(() => {
      setIsSent(false);
      setFeedback('');
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isProblem ? 'Zgłoś Problem Techniczny' : 'Kontakt i Wsparcie Techniczne'}
      size="md"
    >
      <div className="space-y-4 text-xs text-ink">
        <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-ink">
            <LifeBuoy className="h-4 w-4 text-brand-600" />
            Centrum Pomocy Kierivo
          </div>
          <p className="text-muted text-[11px] leading-relaxed">
            Masz pytanie, sugestię nowej funkcji lub napotkałeś problem techniczny? Napisz do nas bezpośrednio lub skorzystaj z poniższego formularza.
          </p>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-brand-fg font-mono">
            <Mail className="h-3.5 w-3.5" />
            <a href="mailto:pomoc@kierivo.com" className="hover:underline">
              pomoc@kierivo.com
            </a>
          </div>
        </div>

        {isSent ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-success-fg mx-auto" />
            <h4 className="font-bold text-sm text-ink">Dziękujemy za kontakt!</h4>
            <p className="text-muted text-xs">Twoja wiadomość została przekazana do zespołu technicznego.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div>
              <label className="block font-bold text-[11px] text-muted mb-1">
                Twój adres e-mail (opcjonalnie do odpowiedzi)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="adrian.k@example.com"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 focus-visible:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[11px] text-muted mb-1">
                Treść wiadomości / Opis zgłoszenia
              </label>
              <textarea
                rows={4}
                required
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={isProblem ? 'Opisz, co poszło nie tak lub jaki problem wystąpił...' : 'Opisz swoje pytanie, problem lub pomysł na ulepszenie...'}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500 focus-visible:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={Send}>
                Wyślij wiadomość
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
