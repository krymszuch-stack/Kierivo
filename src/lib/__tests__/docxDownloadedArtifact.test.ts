import { describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { saveAs } from 'file-saver';
import { downloadNativeDocxCv } from '../docxExporter';
import { createEmptyVault } from '../sampleVault';
import type { LayeredFactItem } from '../../types';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

describe('rzeczywisty plik pobierany przez eksporter DOCX', () => {
  it('zachowuje rolę widoczną w podglądzie i nie umieszcza firmy oferty w treści CV', async () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo.linkedin = 'https://example.invalid/in/jan';
    vault.personalInfo.github = 'https://example.invalid/jan';
    vault.personalInfo.website = 'https://example.invalid/portfolio';
    vault.projects = [{
      id: 'project-1', name: 'Projekt testowy', role: 'autor', description: 'Opis projektu.',
      techStack: ['TypeScript'], metrics: '3 wdrożenia', link: 'https://example.invalid/project',
    }];
    const companyFromOffer = 'FirmaTylkoDoNazwyPliku';
    vi.mocked(saveAs).mockClear();

    await downloadNativeDocxCv(vault, [] as LayeredFactItem[], 'Rola widoczna w podgladzie', companyFromOffer);

    expect(saveAs).toHaveBeenCalledOnce();
    const [artifact, filename] = vi.mocked(saveAs).mock.calls.at(-1) ?? [];
    expect(artifact).toBeInstanceOf(Blob);
    expect(filename).toContain(companyFromOffer);
    if (!(artifact instanceof Blob)) throw new Error('Eksporter nie przekazal pliku DOCX.');

    const archive = unzipSync(new Uint8Array(await artifact.arrayBuffer()));
    const documentXml = new TextDecoder().decode(archive['word/document.xml']);
    expect(documentXml).toContain('Rola widoczna w podgladzie');
    expect(documentXml).toContain('https://example.invalid/in/jan');
    expect(documentXml).toContain('https://example.invalid/jan');
    expect(documentXml).toContain('https://example.invalid/portfolio');
    expect(documentXml).toContain('Projekt testowy');
    expect(documentXml).toContain('Opis projektu.');
    expect(documentXml).toContain('https://example.invalid/project');
    expect(documentXml).not.toContain(companyFromOffer);
  });
});
