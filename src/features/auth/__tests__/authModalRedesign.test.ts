import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Audyt i weryfikacja przeprojektowania AuthModal oraz stopki aplikacji', () => {
  const authModalPath = path.resolve(__dirname, '../AuthModal.tsx');
  const footerPath = path.resolve(__dirname, '../../../components/layout/Footer.tsx');
  const sidebarPath = path.resolve(__dirname, '../../../components/layout/Sidebar.tsx');

  const authModalSrc = fs.readFileSync(authModalPath, 'utf-8');
  const footerSrc = fs.readFileSync(footerPath, 'utf-8');
  const sidebarSrc = fs.readFileSync(sidebarPath, 'utf-8');

  it('1 & 2: nagłówek i opis modalu wyboru zgodny z wytycznymi', () => {
    expect(authModalSrc).toContain("wybor: 'Jak chcesz korzystać z Kierivo?'");
    expect(authModalSrc).not.toContain("wybor: 'Wybierz sposób zapisu'");
    expect(authModalSrc).toContain(
      "wybor: 'Wybierz, gdzie zapisywać swój profil i CV. Możesz zmienić tę decyzję później.'"
    );
  });

  it('3 & 4: pogrupowanie na Polecane, Szybkie logowanie i Bez logowania ze zmienionymi tekstami', () => {
    expect(authModalSrc).toContain('Polecane');
    expect(authModalSrc).toContain('Szybkie logowanie');
    expect(authModalSrc).toContain('Bez logowania');

    expect(authModalSrc).toContain('Załóż konto lub zaloguj się');
    expect(authModalSrc).toContain('Zaloguj się kontem Google');
    expect(authModalSrc).toContain('Zaloguj się kontem Microsoft');
    expect(authModalSrc).toContain('Zaloguj się przez LinkedIn');
    expect(authModalSrc).toContain('Korzystaj bez logowania');
  });

  it('5 & 6: jasne opisy konsekwencji i brak starego tekstu technicznego', () => {
    expect(authModalSrc).toContain('CV i profil będą dostępne na Twoich urządzeniach');
    expect(authModalSrc).toContain('Dane pozostaną w tej przeglądarce i nie będą synchronizowane');
    expect(authModalSrc).not.toContain('Konto synchronizuje CV. Profil Lokalny zostaje na tym urządzeniu.');
  });

  it('7: link Dowiedz się więcej przy profilu lokalnym wyjaśnia kwestię opuszczania przeglądarki', () => {
    expect(authModalSrc).toContain('Dowiedz się więcej');
    expect(authModalSrc).toContain('Czy dane opuszczają przeglądarkę?');
    expect(authModalSrc).toContain('localStorage');
  });

  it('8: informacja przy logowaniu LinkedIn o pobieranych danych i braku importu bez zgody', () => {
    expect(authModalSrc).toContain(
      'Przy logowaniu przez LinkedIn pobierane są wyłącznie podstawowe dane profilowe (imię, nazwisko, e-mail). Import danych zawodowych lub CV wymaga Twojej zgody.'
    );
  });

  it('9 & 10: brak tarczy jako zwykłego awatara konta; tarcza ma tooltip „Dane konta są chronione”', () => {
    expect(sidebarSrc).toContain('Dane konta są chronione');
    // Awatar użytkownika używa inicjału lub ikony User, nie samej tarczy
    expect(sidebarSrc).toContain('userEmail.slice(0, 2).toUpperCase()');
  });

  it('11, 12, 13: stopka zawiera 4 czytelne linki oraz układ siatki na mobile', () => {
    expect(footerSrc).toContain('Prywatność i RODO');
    expect(footerSrc).toContain('Warunki korzystania');
    expect(footerSrc).toContain('Kontakt i wsparcie');
    expect(footerSrc).toContain('Zgłoś problem');

    // Responsywność na mobile: siatka 2 kolumny (2 wiersze dla 4 opcji)
    expect(footerSrc).toContain('grid grid-cols-2');
  });

  it('14: neutralny adres e-mail adrian.k@example.com jako placeholder', () => {
    expect(authModalSrc).toContain('adrian.k@example.com');
    expect(authModalSrc).not.toContain('jan.kowalski@domena.pl');
  });
});
