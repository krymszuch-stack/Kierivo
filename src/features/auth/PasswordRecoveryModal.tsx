import React, { useCallback, useState } from 'react';
import { KeyRound, MailWarning } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { checkPassword, passwordStrength, STRENGTH_LABELS } from '../../lib/passwordPolicy';
import { checkLeakedPassword } from '../../lib/leakedPassword';
import { showToast } from '../../store/useToastStore';

export const PasswordRecoveryModal: React.FC = () => {
  const {
    session,
    passwordRecoveryActive,
    passwordRecoveryError,
    updateRecoveredPassword,
    requestPasswordReset,
    clearPasswordRecoveryError,
    logout,
  } = useAuth();

  const [haslo, setHaslo] = useState('');
  const [powtorz, setPowtorz] = useState('');
  const [email, setEmail] = useState('');
  const [blad, setBlad] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [wyslanoPonownie, setWyslanoPonownie] = useState(false);

  const isOpen = passwordRecoveryActive || passwordRecoveryError !== null;
  const sila = passwordStrength(haslo);

  const zamknij = useCallback(() => {
    setHaslo('');
    setPowtorz('');
    setEmail('');
    setBlad('');
    setWyslanoPonownie(false);

    if (passwordRecoveryActive) {
      // Link recovery tworzy uprzywilejowaną sesję. Jeżeli użytkownik rezygnuje
      // ze zmiany hasła, nie zostawiamy go po cichu jako zalogowanego.
      void logout();
      return;
    }

    clearPasswordRecoveryError();
  }, [passwordRecoveryActive, logout, clearPasswordRecoveryError]);

  const ustawNoweHaslo = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBlad('');

      if (haslo !== powtorz) {
        setBlad('Hasła nie są identyczne.');
        return;
      }

      const polityka = checkPassword(haslo, session?.user.email ?? '');
      if (!polityka.ok) {
        setBlad(polityka.problems.join(' '));
        return;
      }

      setPracuje(true);
      const wyciek = await checkLeakedPassword(haslo);
      if (wyciek.leaked) {
        setPracuje(false);
        setBlad(
          `To hasło pojawiło się w znanych wyciekach danych (${wyciek.count.toLocaleString('pl-PL')} razy). Wybierz inne.`
        );
        return;
      }

      const wynik = await updateRecoveredPassword(haslo);
      setPracuje(false);

      if (!wynik.ok) {
        setBlad(wynik.message);
        return;
      }

      setHaslo('');
      setPowtorz('');
      showToast('Hasło zostało zmienione', {
        message: 'Możesz dalej korzystać z konta. Przy następnym logowaniu użyj nowego hasła.',
        variant: 'success',
      });
    },
    [haslo, powtorz, session?.user.email, updateRecoveredPassword]
  );

  const wyslijNowyLink = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBlad('');
      setPracuje(true);

      // Niezależnie od tego, czy adres istnieje, UI kończy tym samym
      // komunikatem. Nie tworzymy przez reset hasła wyszukiwarki kont.
      await requestPasswordReset(email.trim());
      setPracuje(false);
      setWyslanoPonownie(true);
    },
    [email, requestPasswordReset]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={zamknij}
      title={passwordRecoveryActive ? 'Ustaw nowe hasło' : 'Link do zmiany hasła wygasł'}
      description={
        passwordRecoveryActive
          ? 'Ustaw nowe hasło do konta. Zmiana zostanie zapisana dopiero po potwierdzeniu przez serwer.'
          : 'Ten link nie może już zostać użyty. Możesz od razu poprosić o nowy.'
      }
      size="sm"
    >
      <div className="mb-4 min-h-[3rem]" aria-live="assertive">
        {blad && <Alert variant="danger">{blad}</Alert>}
        {!blad && passwordRecoveryError && <Alert variant="danger">{passwordRecoveryError}</Alert>}
      </div>

      {passwordRecoveryActive ? (
        <form onSubmit={ustawNoweHaslo} className="space-y-4">
          <KeyRound className="mx-auto h-9 w-9 text-brand-fg" aria-hidden="true" />
          <div>
            <Input
              label="Nowe hasło"
              type="password"
              autoComplete="new-password"
              value={haslo}
              onChange={(event) => setHaslo(event.target.value)}
              hint="Co najmniej 12 znaków, mała i wielka litera oraz cyfra."
              required
              autoFocus
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
          <Input
            label="Powtórz nowe hasło"
            type="password"
            autoComplete="new-password"
            value={powtorz}
            onChange={(event) => setPowtorz(event.target.value)}
            required
          />
          <Button type="submit" variant="primary" loading={pracuje} className="w-full">
            Zapisz nowe hasło
          </Button>
        </form>
      ) : wyslanoPonownie ? (
        <div className="space-y-4 text-center">
          <MailWarning className="mx-auto h-9 w-9 text-brand-fg" aria-hidden="true" />
          <p className="text-sm text-ink">
            Jeśli ten adres ma u nas konto, wysłaliśmy nowy link do ustawienia hasła.
          </p>
          <Button type="button" variant="secondary" onClick={zamknij} className="w-full">
            Rozumiem
          </Button>
        </div>
      ) : (
        <form onSubmit={wyslijNowyLink} className="space-y-4">
          <Input
            label="Adres e-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
          <Button type="submit" variant="primary" loading={pracuje} className="w-full">
            Wyślij nowy link
          </Button>
        </form>
      )}
    </Modal>
  );
};
