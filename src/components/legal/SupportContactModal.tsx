import React from 'react';
import { Mail, LifeBuoy, Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { buildSupportEmailHref } from '../../lib/supportEmail';

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

  const isProblem = defaultCategory === 'problem';
  const emailHref = feedback.trim()
    ? buildSupportEmailHref({ category: defaultCategory, email, message: feedback })
    : undefined;

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
            Masz pytanie, sugestię nowej funkcji lub napotkałeś problem techniczny? Wpisz treść, a poniższy odnośnik przygotuje szkic w Twoim programie pocztowym. Kierivo nie wysyła tej wiadomości za Ciebie.
          </p>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-brand-fg font-mono">
            <Mail className="h-3.5 w-3.5" />
            <a href="mailto:pomoc@kierivo.com" className="hover:underline">
              pomoc@kierivo.com
            </a>
          </div>
        </div>

          <form onSubmit={(event) => event.preventDefault()} className="space-y-3 pt-1">
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
              <a
                href={emailHref}
                aria-disabled={!emailHref}
                onClick={(event) => {
                  if (!emailHref) event.preventDefault();
                }}
                className={`relative inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-brand-grad px-3 py-1 text-xs font-medium text-on-brand shadow-raised transition-colors ${emailHref ? 'hover:brightness-110' : 'cursor-not-allowed opacity-50'}`}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Otwórz szkic wiadomości
              </a>
            </div>
          </form>
      </div>
    </Modal>
  );
};
