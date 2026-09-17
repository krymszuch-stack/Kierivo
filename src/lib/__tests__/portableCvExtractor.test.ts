import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  extractEmbeddedMasterVault,
  decompressStreamBytes,
  convertResumeDataToParsedCVResult,
  MasterVaultEmbeddedData,
} from '../portableCvExtractor';

describe('portableCvExtractor Suite (Smart Portable CV Round-Trip)', () => {
  it('bezstratnie odzyskuje profil z realnego pliku PDF z załącznikiem mastervault.json', async () => {
    const samplePdfPath = path.resolve(process.cwd(), 'mastervault-cv/sample/out.pdf');
    if (!fs.existsSync(samplePdfPath)) {
      // Jeśli plik nie istnieje, pomijamy test plikowy
      return;
    }

    const pdfBuffer = fs.readFileSync(samplePdfPath);
    const embedded = await extractEmbeddedMasterVault(pdfBuffer);

    expect(embedded).toBeDefined();
    expect(embedded?.masterVaultRecord?.resumeData).toBeDefined();

    const resumeData = embedded!.masterVaultRecord!.resumeData!;
    expect(resumeData.name).toBe('Michał Kowalczyk');
    expect(resumeData.title).toContain('Automatyk');
    expect(resumeData.contact?.city).toBe('Warszawa');
    expect(resumeData.skills?.length).toBeGreaterThanOrEqual(5);

    const parsed = convertResumeDataToParsedCVResult(embedded!);
    expect(parsed).toBeDefined();
    expect(parsed?.personalInfo.fullName).toBe('Michał Kowalczyk');
    expect(parsed?.personalInfo.location).toBe('Warszawa');
    expect(parsed?.detectedFormat).toBe('KIERIVO_PORTABLE_PDF');
    expect(parsed?.hardSkills.length).toBeGreaterThan(0);
    expect(parsed?.history.length).toBeGreaterThan(0);
  });

  it('poprawnie konwertuje strukturę MasterVaultEmbeddedData do ParsedCVResult z zachowaniem wszystkich pól', () => {
    const mockData: MasterVaultEmbeddedData = {
      masterVaultRecord: {
        source: 'mvcv-semantic-dual-layer',
        version: '1.0',
        resumeData: {
          name: 'Janusz Techniczny',
          title: 'Specjalista Automatyki i UDT',
          contact: {
            phone: '+48 500 600 700',
            email: 'janusz@techniczny.pl',
            city: 'Gdańsk',
          },
          summary: {
            display: 'Specjalista z 10-letnim stażem w utrzymaniu ruchu i automatyce.',
            semantic: 'Pełny kontekst ATS...',
          },
          skills: [
            { label: 'Sterowniki PLC', group: 'core' },
            { label: 'SCADA', group: 'tooling' },
            { label: 'Komunikacja techniczna', group: 'soft' },
          ],
          experience: [
            {
              role: 'Główny Automatyk',
              company: 'Stocznia Północna S.A.',
              location: 'Gdańsk',
              start: '01.2020',
              end: 'obecnie',
              bullets: [
                {
                  kind: 'result',
                  display: 'Zmniejszono przestoje linii o 25%.',
                  semantic: 'Rezultat mierzalny: 25%',
                },
              ],
              tech: ['Siemens S7-1500', 'TIA Portal'],
            },
          ],
          education: [
            {
              school: 'Politechnika Gdańska',
              degree: 'Inżynier Mechatronik',
              start: '2015',
              end: '2019',
              note: 'Specjalizacja: Automatyka przemysłowa',
            },
          ],
          certifications: [
            {
              name: 'Uprawnienia SEP E+D do 1kV',
              issuer: 'SEP',
              year: '2023',
            },
          ],
          languages: [
            { name: 'angielski', level: 'B2' },
          ],
        },
      },
    };

    const parsed = convertResumeDataToParsedCVResult(mockData);
    expect(parsed).not.toBeNull();
    expect(parsed!.personalInfo.fullName).toBe('Janusz Techniczny');
    expect(parsed!.personalInfo.title).toBe('Specjalista Automatyki i UDT');
    expect(parsed!.personalInfo.email).toBe('janusz@techniczny.pl');
    expect(parsed!.personalInfo.location).toBe('Gdańsk');
    expect(parsed!.personalInfo.summary).toContain('Specjalista z 10-letnim stażem');

    // Podział umiejętności na grupy
    expect(parsed!.hardSkills).toContain('Sterowniki PLC');
    expect(parsed!.toolsAndTech).toContain('SCADA');
    expect(parsed!.softSkills).toContain('Komunikacja techniczna');

    // Doświadczenie i punkty
    expect(parsed!.history.length).toBe(1);
    expect(parsed!.history[0].role).toBe('Główny Automatyk');
    expect(parsed!.history[0].isCurrent).toBe(true);
    expect(parsed!.history[0].highlights[0].text).toBe('Zmniejszono przestoje linii o 25%.');
    expect(parsed!.history[0].highlights[0].metric).toBe('zweryfikowano');

    // Certyfikaty i edukacja
    expect(parsed!.certifications.length).toBe(1);
    expect(parsed!.certifications[0].name).toBe('Uprawnienia SEP E+D do 1kV');
    expect(parsed!.education[0].institution).toBe('Politechnika Gdańska');
    expect(parsed!.languages?.[0].language).toBe('angielski');
  });

  describe('Dekompresja Web API (DecompressionStream) bez modułu zlib', () => {
    async function compressWithWebStream(text: string, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
      const cs = new CompressionStream(format);
      const writer = cs.writable.getWriter();
      writer.write(new TextEncoder().encode(text));
      writer.close();
      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return merged;
    }

    it('poprawnie dekompresuje dane skompresowane w formacie deflate za pomocą DecompressionStream', async () => {
      const originalText = JSON.stringify({
        masterVaultRecord: {
          resumeData: { name: 'Adam Kowalski', title: 'Monter Konstrukcji Stalowych' },
        },
      });

      const compressed = await compressWithWebStream(originalText, 'deflate');
      const decompressed = await decompressStreamBytes(compressed);

      expect(decompressed).toBe(originalText);
      expect(JSON.parse(decompressed).masterVaultRecord.resumeData.name).toBe('Adam Kowalski');
    });

    it('poprawnie dekompresuje dane w formacie deflate-raw za pomocą DecompressionStream', async () => {
      const originalText = 'Surowy tekst testowy strumienia bez nagłówka zlib';
      const compressed = await compressWithWebStream(originalText, 'deflate-raw');
      const decompressed = await decompressStreamBytes(compressed);

      expect(decompressed).toBe(originalText);
    });

    it('rzuca błąd bezpieczeństwa, gdy zdekompresowany strumień przekracza zdefiniowany limit bajtów', async () => {
      const longText = 'A'.repeat(5000);
      const compressed = await compressWithWebStream(longText, 'deflate');

      await expect(decompressStreamBytes(compressed, 1000)).rejects.toThrow(
        'Zdekompresowany załącznik PDF jest zbyt duży'
      );
    });

    it('extractEmbeddedMasterVault poprawnie odczytuje masterVaultRecord ze strumienia PDF bez udziału zlib', async () => {
      const payload = JSON.stringify({
        masterVaultRecord: {
          version: '1.0',
          resumeData: {
            name: 'Piotr Nowak',
            title: 'Spawacz TIG/MAG',
          },
        },
      });

      const compressedStream = await compressWithWebStream(payload, 'deflate');
      const compressedString = Array.from(compressedStream)
        .map((b) => String.fromCharCode(b))
        .join('');

      // Konstrukcja minimalnego kontenera PDF z /Type /EmbeddedFile i stream ... endstream
      const pdfText = `%PDF-1.7\n` +
        `1 0 obj\n` +
        `<< /Type /Filespec /EF << /F 2 0 R >> /F (mastervault.json) >>\n` +
        `endobj\n` +
        `2 0 obj\n` +
        `<< /Type /EmbeddedFile /Subtype /application#2Fjson /Filter /FlateDecode /Length ${compressedStream.length} >>\n` +
        `stream\r\n` +
        compressedString +
        `\r\nendstream\n` +
        `endobj\n` +
        `%%EOF`;

      const pdfBytes = new Uint8Array(pdfText.length);
      for (let i = 0; i < pdfText.length; i++) {
        pdfBytes[i] = pdfText.charCodeAt(i);
      }

      const result = await extractEmbeddedMasterVault(pdfBytes);
      expect(result).not.toBeNull();
      expect(result?.masterVaultRecord?.resumeData?.name).toBe('Piotr Nowak');
      expect(result?.masterVaultRecord?.resumeData?.title).toBe('Spawacz TIG/MAG');
    });
  });
});
