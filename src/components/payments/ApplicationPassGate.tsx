import React from 'react';

/**
 * Bramka funkcji, która historycznie należała do Karnetu Aplikacyjnego.
 *
 * W bezpłatnej becie nie ma aktywnej sprzedaży, więc komponent nie może
 * prowadzić do cennika ani checkoutu. Istniejące konto z aktywnym uprawnieniem
 * zachowuje dostęp, ale nowy tester dostaje jednoznaczną informację o granicy
 * zakresu zamiast martwego CTA.
 */
export interface ApplicationPassGateProps {
  hasActivePass: boolean;
  pitch: string;
  children: React.ReactNode;
}

export const ApplicationPassGate: React.FC<ApplicationPassGateProps> = ({
  hasActivePass,
  pitch,
  children,
}) => {
  if (hasActivePass) return <>{children}</>;

  return (
    <section
      role="note"
      aria-label="Funkcja poza zakresem bezpłatnej bety"
      className="rounded-2xl border border-line bg-surface p-6 text-center"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-fg">
        Poza zakresem bezpłatnej bety
      </p>
      <h2 className="mt-1.5 text-lg font-black tracking-tight text-ink">
        Teleprompter Live HUD
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
        {pitch}
      </p>
      <p className="mx-auto mt-3 max-w-prose text-sm font-semibold text-ink">
        Ta funkcja nie jest obecnie udostępniana nowym testerom i nie można dokupić do niej dostępu.
      </p>
      <p className="mx-auto mt-2 max-w-prose text-xs text-muted">
        Podstawowy przepływ bety, czyli profil, audyt CVelocity, dopasowanie do oferty,
        przygotowanie dokumentu i pipeline, działa bez Karnetu.
      </p>
    </section>
  );
};
