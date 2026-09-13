import React, { useCallback, useId, useState } from 'react';
import { Cloud, HardDrive, ArrowLeft, MailCheck } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { MasterVault } from '../../types';
import { showToast } from '../../store/useToastStore';
import { checkPassword, passwordStrength, STRENGTH_LABELS } from '../../lib/passwordPolicy';
import { checkLeakedPassword } from '../../lib/leakedPassword';

/**
 * Wejście do aplikacji — dwa tryby, oba prawdziwe.
 *
 * Poprzednia wersja tego pliku zbierała imię i opcjonalny e-mail, i mówiła
 * wprost, że „to nie jest jeszcze konto w chmurze". Było to uczciwe, bo
 * konta faktycznie nie było. Teraz jest, więc modal przestaje być
 * oświadczeniem, a staje się wyborem:
 *
 * - **konto w chmurze** — CV przeżywa wyczyszczenie przeglądarki i wraca na
 *   innym urządzeniu;
 * - **tylko na tym urządzeniu** — dane nie opuszczają przeglądarki.
 *
 * Tryb lokalny zostaje, bo dla części osób to jest powód, żeby w ogóle wpisać
 * tu swoje CV, a nie przeszkoda do usunięcia.
 */

type Widok = 'wybor' | 'logowanie' | 'rejestracja' | 'reset' | 'potwierdz' | 'lokalny';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessVaultLoaded?: (vault: MasterVault) => void;
}

const TYTULY: Record<Widok, string> = {
  wybor: 'Wybierz sposób zapisu',
  logowanie: 'Zaloguj się',
  rejestracja: 'Załóż konto',
  reset: 'Odzyskaj dostęp',
  potwierdz: 'Sprawdź skrzynkę',
  lokalny: 'Profil na tym urządzeniu',
};

// Podtytuł prostym językiem — mówi, co się zaraz wydarzy, zanim użytkownik
// zacznie czytać formularz.
const OPISY: Partial<Record<Widok, string>> = {
  wybor: 'Konto synchronizuje CV. Profil lokalny zostaje na tym urządzeniu.',
  logowanie: 'Wpisz e-mail i hasło, żeby wrócić do swojego CV.',
  rejestracja: 'Załóż darmowe konto, żeby mieć dostęp z każdego urządzenia.',
  lokalny: 'Dane zostają wyłącznie w tej przeglądarce — bez konta i bez hasła.',
};

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const GoogleButton: React.FC<{
  onClick: () => void;
  loading?: boolean;
  text?: string;
}> = ({ onClick, loading, text = 'Kontynuuj z Google' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-busy={loading || undefined}
    className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-xs transition-colors hover:bg-elevated hover:border-ink/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
  >
    <GoogleIcon />
    <span className="truncate">{loading ? 'Łączenie z Google…' : text}</span>
  </button>
);

const OrDivider: React.FC<{ text?: string }> = ({ text = 'albo' }) => (
  <div className="relative my-3 flex items-center justify-center" role="separator">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-line" />
    </div>
    <span className="relative bg-surface px-2 text-meta font-bold uppercase tracking-wider text-muted">
      {text}
    </span>
  </div>
);

/**
 * Przełącznik logowanie/rejestracja — jeden `role="tablist"`, dwa `role="tab"`.
 * Szerokość kolumn jest stała (grid-cols-2), więc zmiana zakładki nie
 * przesuwa reszty formularza.
 */
const AuthTabs: React.FC<{
  aktywny: 'logowanie' | 'rejestracja';
  onChange: (widok: 'logowanie' | 'rejestracja') => void;
}> = ({ aktywny, onChange }) => {
  const tabId = useId();

  const tabClass = (tab: 'logowanie' | 'rejestracja') =>
    [
      'cursor-pointer rounded-lg py-2 text-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50',
      aktywny === tab ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink',
    ].join(' ');

  return (
    <div
      role="tablist"
      aria-label="Wybór między logowaniem a rejestracją"
      className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1"
    >
      <button
        type="button"
        role="tab"
        id={`${tabId}-logowanie`}
        aria-selected={aktywny === 'logowanie'}
        aria-pressed={aktywny === 'logowanie'}
        onClick={() => onChange('logowanie')}
        className={tabClass('logowanie')}
      >
        Logowanie
      </button>
      <button
        type="button"
        role="tab"
        id={`${tabId}-rejestracja`}
        aria-selected={aktywny === 'rejestracja'}
        aria-pressed={aktywny === 'rejestracja'}
        onClick={() => onChange('rejestracja')}
        className={tabClass('rejestracja')}
      >
        Rejestracja
      </button>
    </div>
  );
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccessVaultLoaded }) => {
  const {
    signInLocally,
    signUpCloud,
    signInCloud,
    signInWithGoogle,
    requestPasswordReset,
    cloudAvailable,
  } = useAuth();

  const [widok, setWidok] = useState<Widok>(cloudAvailable ? 'wybor' : 'lokalny');
  const [email, setEmail] = useState('');
  const [haslo, setHaslo] = useState('');
  const [imie, setImie] = useState('');
  const [blad, setBlad] = useState('');
  const [pracuje, setPracuje] = useState(false);

  const wyczysc = useCallback(() => {
    setBlad('');
    setHaslo('');
  }, []);

  const idzDo = useCallback(
    (cel: Widok) => {
      wyczysc();
      setWidok(cel);
    },
    [wyczysc]
  );

  const zamknij = useCallback(() => {
    setEmail('');
    setHaslo('');
    setImie('');
    setBlad('');
    setWidok(cloudAvailable ? 'wybor' : 'lokalny');
    onClose();
  }, [cloudAvailable, onClose]);

  /* --- profil lokalny --- */

  const zapiszProfilLokalny = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!imie.trim()) return;

      const vault = signInLocally(imie, email);
      onSuccessVaultLoaded?.(vault);
      showToast('Profil zapisany na tym urządzeniu', {
        message: 'Dane nie opuszczają tej przeglądarki.',
        variant: 'success',
      });
      zamknij();
    },
    [imie, email, signInLocally, onSuccessVaultLoaded, zamknij]
  );

  /* --- konto w chmurze --- */

  const zaloguj = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBlad('');
      setPracuje(true);

      const wynik = await signInCloud(email.trim(), haslo);
      setPracuje(false);

      if (!wynik.ok) {
        setBlad(wynik.message);
        return;
      }

      showToast('Zalogowano', { message: 'Pobieramy Twoje CV z konta.', variant: 'success' });
      zamknij();
    },
    [email, haslo, signInCloud, zamknij]
  );

  const zalogujGoogle = useCallback(async () => {
    setBlad('');
    setPracuje(true);
    const wynik = await signInWithGoogle();
    setPracuje(false);

    if (!wynik.ok) {
      setBlad(wynik.message);
    }
  }, [signInWithGoogle]);

  const zarejestruj = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBlad('');

      const polityka = checkPassword(haslo, email);
      if (!polityka.ok) {
        setBlad(polityka.problems.join(' '));
        return;
      }

      setPracuje(true);

      // Hasło z wycieku odrzucamy przed założeniem konta. Przy niedostępnym
      // HIBP przepuszczamy dalej — cudza awaria nie może blokować rejestracji.
      const wyciek = await checkLeakedPassword(haslo);
      if (wyciek.leaked) {
        setPracuje(false);
        setBlad(
          `To hasło pojawiło się w znanych wyciekach danych (${wyciek.count.toLocaleString('pl-PL')} razy). Wybierz inne — atakujący sprawdzają je w pierwszej kolejności.`
        );
        return;
      }

      const wynik = await signUpCloud(email.trim(), haslo, imie.trim() || email.split('@')[0]);
      setPracuje(false);

      if (!wynik.ok) {
        setBlad(wynik.message);
        return;
      }

      if (wynik.needsEmailConfirmation) {
        setWidok('potwierdz');
        return;
      }

      showToast('Konto założone', { variant: 'success' });
      zamknij();
    },
    [email, haslo, imie, signUpCloud, zamknij]
  );

  const resetuj = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBlad('');
      setPracuje(true);

      await requestPasswordReset(email.trim());
      setPracuje(false);

      // Ten sam komunikat niezależnie od wyniku: inaczej formularz powiedziałby
      // obcemu, czy dany adres ma u nas konto.
      setWidok('potwierdz');
    },
    [email, requestPasswordReset]
  );

  const sila = passwordStrength(haslo);
  const jestFormularzemUwierzytelniania = widok === 'logowanie' || widok === 'rejestracja';

  return (
    <Modal isOpen={isOpen} onClose={zamknij} title={TYTULY[widok]} description={OPISY[widok]} size="sm">
      {widok !== 'wybor' && widok !== 'potwierdz' && cloudAvailable && (
        <button
          type="button"
          onClick={() => idzDo('wybor')}
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-label font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 rounded"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Wróć do wyboru
        </button>
      )}

      {jestFormularzemUwierzytelniania && (
        <div className="mb-4">
          <AuthTabs aktywny={widok} onChange={idzDo} />
        </div>
      )}

      {/* Stała wysokość, żeby pojawienie się błędu nie przesuwało formularza. */}
      <div className="mb-4 min-h-[3rem]" aria-live="assertive">
        {blad && <Alert variant="danger">{blad}</Alert>}
      </div>

      {/* --- wybór trybu --- */}
      {widok === 'wybor' && (
        <div className="space-y-3">
          {cloudAvailable && (
            <>
              <GoogleButton onClick={zalogujGoogle} loading={pracuje} text="Kontynuuj z Google" />
              <OrDivider text="lub" />
            </>
          )}

          <button
            type="button"
            onClick={() => idzDo('logowanie')}
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
          >
            <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-brand-fg" aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-ink">Konto przez e-mail</span>
              <span className="mt-0.5 block text-label text-muted">
                Zaloguj się albo je załóż. CV wróci na innym urządzeniu.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => idzDo('lokalny')}
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
          >
            <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-ink">Profil lokalny</span>
              <span className="mt-0.5 block text-label text-muted">
                Bez konta i bez hasła. Dane nie opuszczają tej przeglądarki.
              </span>
            </span>
          </button>
        </div>
      )}

      {/* --- logowanie --- */}
      {widok === 'logowanie' && (
        <div className="space-y-4">
          <GoogleButton onClick={zalogujGoogle} loading={pracuje} text="Kontynuuj z Google" />
          <OrDivider text="albo e-mail i hasło" />

          <form onSubmit={zaloguj} className="space-y-4" noValidate={false}>
            <Input
              label="Adres e-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Hasło"
              type="password"
              autoComplete="current-password"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" loading={pracuje} className="w-full">
              Zaloguj się
            </Button>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => idzDo('reset')}
                className="cursor-pointer text-label text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 rounded"
              >
                Nie pamiętam hasła
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- rejestracja --- */}
      {widok === 'rejestracja' && (
        <div className="space-y-4">
          <GoogleButton onClick={zalogujGoogle} loading={pracuje} text="Zarejestruj się przez Google" />
          <OrDivider text="albo wypełnij formularz" />

          <form onSubmit={zarejestruj} className="space-y-4">
            <Input
              label="Jak się do Ciebie zwracać"
              value={imie}
              onChange={(e) => setImie(e.target.value)}
              placeholder="np. Jan"
              autoComplete="name"
              autoFocus
            />
            <Input
              label="Adres e-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div>
              <Input
                label="Hasło"
                type="password"
                autoComplete="new-password"
                value={haslo}
                onChange={(e) => setHaslo(e.target.value)}
                hint="Co najmniej 12 znaków, mała i wielka litera oraz cyfra."
                required
              />
              {haslo && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-[var(--duration-state)]"
                      style={{ width: `${(sila / 4) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-subtle">{STRENGTH_LABELS[sila]}</span>
                </div>
              )}
            </div>

            <Button type="submit" variant="primary" loading={pracuje} className="w-full">
              Załóż konto
            </Button>
          </form>
        </div>
      )}

      {/* --- reset hasła --- */}
      {widok === 'reset' && (
        <form onSubmit={resetuj} className="space-y-4">
          <p className="text-sm text-muted">
            Podaj adres e-mail powiązany z kontem. Wyślemy link do ustawienia nowego hasła.
          </p>
          <Input
            label="Adres e-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" variant="primary" loading={pracuje} className="w-full">
            Wyślij link
          </Button>
        </form>
      )}

      {/* --- po rejestracji / po resecie --- */}
      {widok === 'potwierdz' && (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-brand-fg" aria-hidden="true" />
          <p className="text-sm text-ink">
            Jeśli ten adres ma u nas konto, wysłaliśmy na niego wiadomość.
          </p>
          {/* Czas życia linku ustala konfiguracja Supabase, nie ten kod —
              konkretna liczba godzin szybko przestałaby być prawdą. */}
          <p className="text-label text-muted">
            Link jest ważny ograniczony czas — jeśli wygaśnie, wygeneruj nowy.
            Sprawdź też folder ze spamem — wiadomości od nowych nadawców czasem
            tam trafiają.
          </p>
          <Button type="button" variant="secondary" onClick={zamknij} className="w-full">
            Rozumiem
          </Button>
        </div>
      )}

      {/* --- profil lokalny --- */}
      {widok === 'lokalny' && (
        <form onSubmit={zapiszProfilLokalny} className="space-y-4">
          <Input
            label="Jak się do Ciebie zwracać"
            value={imie}
            onChange={(e) => setImie(e.target.value)}
            placeholder="np. Jan Kowalski"
            autoComplete="name"
            required
            autoFocus
          />
          <Input
            label="Adres e-mail (opcjonalnie)"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jan.kowalski@domena.pl"
            hint="Nigdzie go nie wysyłamy — trafia do nagłówka Twojego CV."
          />

          <Alert variant="info">
            Ten profil żyje wyłącznie w tej przeglądarce. Nie ma hasła i nie ma
            synchronizacji — wyczyszczenie danych witryny usunie CV bezpowrotnie.
          </Alert>

          <Button type="submit" variant="primary" className="w-full">
            Zapisz profil
          </Button>
        </form>
      )}
    </Modal>
  );
};
