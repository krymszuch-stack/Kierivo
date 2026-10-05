import { describe, it, expect } from 'vitest';
import {
  pseudonymize,
  rehydrate,
  stripSensitiveFields,
  identifyingValues,
  assertNoPii,
  PiiLeakError,
  preparePromptForModel,
} from '../pseudonymize';
import type { MasterVault } from '../../types';

const vault = {
  personalInfo: {
    fullName: "Sean O'Brien",
    email: 'sean.obrien@example.pl',
    phone: '+48 600 700 800',
    location: 'KrakĂłw',
    photoUrl: 'https://cdn.example.pl/zdjecia/sean.jpg',
    title: 'Backend Developer',
    summary: 'Programista z 8-letnim staĹĽem.',
  },
} as unknown as Partial<MasterVault>;

describe('Pseudonimizacja na granicy modelu', () => {
  it('usuwa imiÄ™, e-mail, telefon i miasto z tekstu wysyĹ‚anego do modelu', () => {
    const input =
      "Sean O'Brien, KrakĂłw. Kontakt: sean.obrien@example.pl, tel. +48 600 700 800. Programista backendu.";

    const { text } = pseudonymize(input, identifyingValues(vault));

    expect(text).not.toContain("Sean O'Brien");
    expect(text).not.toContain('sean.obrien@example.pl');
    expect(text).not.toContain('600 700 800');
    expect(text).toContain('[KANDYDAT]');
    expect(text).toContain('[EMAIL]');
    // TreĹ›Ä‡ merytoryczna musi przetrwaÄ‡ â€” inaczej model nie ma z czego korzystaÄ‡.
    expect(text).toContain('Programista backendu');
  });

  it('przywraca prawdziwe dane w wyniku wracajÄ…cym do uĹĽytkownika', () => {
    const input = "Sean O'Brien, e-mail: sean.obrien@example.pl";
    const { text, map } = pseudonymize(input, identifyingValues(vault));

    // Model zwraca tekst z placeholderami â€” list zaadresowany do [KANDYDAT]
    // byĹ‚by bezuĹĽyteczny.
    const modelOutput = `Szanowni PaĹ„stwo, nazywam siÄ™ ${text.split(',')[0]}.`;

    expect(rehydrate(modelOutput, map)).toContain("Sean O'Brien");
  });

  it('nie myli dwĂłch rĂłĹĽnych adresĂłw e-mail przy przywracaniu', () => {
    const input = 'Kontakt: jan@example.pl oraz rekrutacja@firma.pl';
    const { text, map } = pseudonymize(input);

    expect(text).toContain('[EMAIL]');
    expect(text).toContain('[EMAIL_2]');
    expect(rehydrate(text, map)).toBe(input);
  });

  it('usuwa zdjÄ™cie caĹ‚kowicie, bez placeholdera', () => {
    // Wizerunek to dane szczegĂłlnej kategorii (art. 9 RODO), a do wygenerowania
    // treĹ›ci CV nie jest potrzebny w ĹĽadnej postaci.
    const safe = stripSensitiveFields(vault);

    expect(safe.personalInfo).not.toHaveProperty('photoUrl');
    expect(JSON.stringify(safe)).not.toContain('sean.jpg');
    // PozostaĹ‚e pola zostajÄ… nietkniÄ™te.
    expect(safe.personalInfo?.title).toBe('Backend Developer');
  });

  it('zamienia dĹ‚uĹĽsze dopasowanie przed krĂłtszym', () => {
    // Gdyby "Sean" poszĹ‚o przed "Sean O'Brien", w tekĹ›cie zostaĹ‚oby "[KANDYDAT] O'Brien".
    const { text } = pseudonymize("Sean O'Brien pracowaĹ‚ z Seanem", ["Sean O'Brien", 'Sean']);

    expect(text).not.toContain("O'Brien");
  });

  it('nie wywraca siÄ™ na pustym wejĹ›ciu', () => {
    expect(pseudonymize('').text).toBe('');
    expect(rehydrate('', new Map())).toBe('');
    expect(identifyingValues({} as Partial<MasterVault>)).toEqual([]);
  });
  it('nie usuwa krotkich dat ani zakresow miesiecznych jako telefonow', () => {
    const input = 'Doswiadczenie: 2021-03 do 2023-12; oferta 2026-10-02.';
    expect(pseudonymize(input).text).toBe(input);
    expect(preparePromptForModel(input).text).toBe(input);
  });
});

describe('Bramka assertNoPii', () => {
  it('przepuszcza Ĺ‚adunek po pseudonimizacji', () => {
    const { text } = pseudonymize(
      "Sean O'Brien, sean.obrien@example.pl, +48 600 700 800",
      identifyingValues(vault)
    );

    expect(() => assertNoPii(text)).not.toThrow();
  });

  it('blokuje wysyĹ‚kÄ™, gdy w Ĺ‚adunku zostaĹ‚ adres e-mail', () => {
    expect(() => assertNoPii('Kandydat: jan.kowalski@example.pl')).toThrow(PiiLeakError);
  });

  it('blokuje numer PESEL i numer telefonu', () => {
    expect(() => assertNoPii('PESEL 90010112345')).toThrow(PiiLeakError);
    expect(() => assertNoPii('tel. 600 700 800')).toThrow(PiiLeakError);
  });

});
