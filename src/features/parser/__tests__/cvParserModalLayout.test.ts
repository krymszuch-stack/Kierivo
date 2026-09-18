import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Układ i teksty widoku importu CV (CVParserModal)', () => {
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, '../CVParserModal.tsx'),
    'utf-8'
  );
  const dropzoneSource = fs.readFileSync(
    path.resolve(__dirname, '../DropZone.tsx'),
    'utf-8'
  );

  it('posiada zaktualizowany nagłówek, opis i badge bez żargonu', () => {
    expect(modalSource).toContain('title="Importuj swoje CV"');
    expect(modalSource).toContain(
      'description="Dodaj plik lub wklej treść CV. Pokażemy, jakie informacje możesz dodać do swojego profilu."'
    );
    expect(modalSource).toContain('badge="Automatyczne rozpoznawanie treści"');
    expect(modalSource).not.toContain('badge="Parser Kierivo"');
    expect(modalSource).not.toContain('Wczytywanie i scalanie dokumentu CV');
  });

  it('używa zaktualizowanych zakładek: Prześlij plik i Wklej treść', () => {
    expect(modalSource).toContain("label: 'Prześlij plik'");
    expect(modalSource).toContain("label: 'Wklej treść'");
    expect(modalSource).not.toContain('Plik z dysku (PDF/DOCX)');
    expect(modalSource).not.toContain('Wklej surowy tekst');
  });

  it('posiada wyśrodkowany kontener o maksymalnej szerokości 760–960 px z marginesem mobilnym', () => {
    expect(modalSource).toMatch(/max-w-\[(7[6-9][0-9]|8[0-9]{2}|9[0-6][0-9])px\]/);
    expect(modalSource).toContain('mx-auto');
    expect(modalSource).toContain('px-4 sm:px-6');
  });

  it('dropzone ma wysokość w granicach 220–280 px', () => {
    expect(dropzoneSource).toContain('min-h-[220px]');
    expect(dropzoneSource).toContain('max-h-[280px]');
  });

  it('textarea ma wysokość w granicach 280–360 px i nie rozciąga się w nieskończoność', () => {
    expect(modalSource).toContain('min-h-[280px]');
    expect(modalSource).toContain('max-h-[360px]');
    expect(modalSource).toContain('resize-y');
  });

  it('przycisk akcji ma etykietę analizy CV i pokazania różnic', () => {
    expect(modalSource).toContain('Przeanalizuj CV i pokaż różnice');
    expect(modalSource).not.toContain('Rozpocznij parsowanie i przygotuj Diff');
  });

  it('informacja o limicie jest oddzielona od komunikatu o prywatności', () => {
    expect(modalSource).toContain(
      'Limit importów plików został wykorzystany. Możesz nadal bezpłatnie wkleić treść CV.'
    );
    expect(modalSource).toContain('Treść jest przetwarzana lokalnie.');
  });
});
