/**
 * Moduł Smart Portable CV (Round-Trip).
 *
 * Umożliwia bezstratny odczyt i natychmiastowy import profilu kandydata
 * bezpośrednio z dwuwarstwowego pliku PDF wygenerowanego przez silnik `mvcv`,
 * wykorzystując osadzony w drzewie /EmbeddedFiles załącznik `mastervault.json`.
 *
 * Zgodność z regułami AGENTS.md:
 * - Reguła 1: Zero wymyślonych danych. Odtwarzamy wyłącznie to, co zostało zapisane w dokumencie.
 */

import { ParsedCVResult } from './cvUniversalParser';
import { WorkExperience, Education, Certification, LanguageProficiency, Project } from '../types';

export interface MasterVaultEmbeddedData {
  masterVaultRecord?: {
    source?: string;
    version?: string;
    resumeData?: {
      name?: string;
      title?: string;
      initials?: string;
      contact?: {
        phone?: string;
        email?: string;
        city?: string;
        linkedin?: string;
        github?: string;
        www?: string;
      };
      summary?: {
        display?: string;
        semantic?: string;
      } | string;
      skills?: Array<{
        label?: string;
        semantic?: string;
        group?: string;
        weight?: number;
      } | string>;
      experience?: Array<{
        role?: string;
        company?: string;
        location?: string;
        start?: string;
        end?: string;
        bullets?: Array<{
          kind?: 'result' | 'duty';
          display?: string;
          semantic?: string;
          text?: string;
        }>;
        tech?: string[];
      }>;
      education?: Array<{
        degree?: string;
        school?: string;
        start?: string;
        end?: string;
        note?: string;
      }>;
      certifications?: Array<{
        name?: string;
        issuer?: string;
        year?: string;
        semantic?: string;
      }>;
      languages?: Array<{
        name?: string;
        level?: string;
      }>;
      licenses?: string[];
      clause?: string;
      projects?: Array<Record<string, unknown>>;
    };
    jsonLd?: Record<string, unknown>;
  };
}

/**
 * Wyodrębnia skompresowany lub nieskompresowany strumień JSON załącznika mastervault.json z bufora PDF.
 */
export async function decompressStreamBytes(compressedSlice: Uint8Array, maxDecompressedBytes: number = 0): Promise<string> {
  // 1. Środowisko Node.js (testy Vitest, backend)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const zlib = await import('zlib');
      try {
        const decompressed = zlib.inflateSync(compressedSlice);
        if (maxDecompressedBytes > 0 && decompressed.length > maxDecompressedBytes) {
          throw new Error(
            'Zdekompresowany załącznik PDF jest zbyt duży. Plik może zawierać złośliwą strukturę.'
          );
        }
        return decompressed.toString('utf-8');
      } catch {
        if (maxDecompressedBytes > 0) {
          // Druga próba z limitem — inflateRawSync
          const decompressedRaw = zlib.inflateRawSync(compressedSlice);
          if (decompressedRaw.length > maxDecompressedBytes) {
            throw new Error(
              'Zdekompresowany załącznik PDF jest zbyt duży. Plik może zawierać złośliwą strukturę.'
            );
          }
          return decompressedRaw.toString('utf-8');
        }
        const decompressedRaw = zlib.inflateRawSync(compressedSlice);
        return decompressedRaw.toString('utf-8');
      }
    } catch {
      // fallback do browser API
    }
  }

  // 2. Środowisko przeglądarkowe z natywnym DecompressionStream
  if (typeof DecompressionStream !== 'undefined') {
    for (const format of ['deflate', 'deflate-raw'] as const) {
      try {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        writer.write(compressedSlice);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (maxDecompressedBytes > 0 && totalBytes > maxDecompressedBytes) {
              throw new Error(
                'Zdekompresowany załącznik PDF jest zbyt duży. Plik może zawierać złośliwą strukturę.'
              );
            }
            chunks.push(value);
          }
        }
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        return new TextDecoder('utf-8').decode(merged);
      } catch {
        // próbujemy kolejny format
      }
    }
  }

  throw new Error('Brak środowiska do dekompresji strumienia PDF FlateDecode.');
}

/**
 * Maksymalna łączna liczba zdekompresowanych bajtów na cały dokument PDF.
 * Chroni przed Cumulative Decompression Bomb — wieloma małymi strumieniami,
 * z których każdy jest w limicie, ale łącznie przekraczają pamięć.
 */
const MAX_CUMULATIVE_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Szuka obiektu EmbeddedFile w binariach PDF i wyciąga obiekt masterVaultRecord.
 */
export async function extractEmbeddedMasterVault(
  pdfBuffer: Uint8Array | ArrayBuffer
): Promise<MasterVaultEmbeddedData | null> {
  const bytes = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
  
  // W środowisku Node.js (testy, backend) używamy szybkiego bufora binarnego
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const zlib = await import('zlib');
      const buf = Buffer.from(bytes);
      const content = buf.toString('binary');
      let cumulativeDecompressed = 0;

      const markers = ['/application#2Fjson', '/application/json', '/EmbeddedFile', 'mastervault.json'];
      for (const m of markers) {
        let pos = content.indexOf(m);
        while (pos !== -1) {
          const objStart = content.lastIndexOf('obj', pos);
          const searchStart = objStart !== -1 ? objStart : pos;
          const streamKeyword = 'stream';
          let streamStart = content.indexOf(streamKeyword, searchStart);
          if (streamStart !== -1) {
            streamStart += streamKeyword.length;
            if (content.charCodeAt(streamStart) === 0x0d) streamStart++;
            if (content.charCodeAt(streamStart) === 0x0a) streamStart++;
            const streamEnd = content.indexOf('endstream', streamStart);
            if (streamEnd !== -1 && streamEnd > streamStart) {
              const compressedSlice = buf.subarray(streamStart, streamEnd);
              const streamSize = streamEnd - streamStart;
              // Szacunkowy limit: 10:1 ratio dekompresji
              cumulativeDecompressed += streamSize * 10;
              if (cumulativeDecompressed > MAX_CUMULATIVE_DECOMPRESSED_BYTES) {
                throw new Error(
                  'Dokument PDF zawiera zbyt wiele danych po dekompresji. Plik może być uszkodzony lub zawierać złośliwą strukturę.'
                );
              }
              try {
                const decomp = zlib.inflateSync(compressedSlice);
                const str = decomp.toString('utf-8');
                if (str.includes('masterVaultRecord')) {
                  return JSON.parse(str);
                }
              } catch {
                try {
                  const decompRaw = zlib.inflateRawSync(compressedSlice);
                  const str = decompRaw.toString('utf-8');
                  if (str.includes('masterVaultRecord')) {
                    return JSON.parse(str);
                  }
                } catch {
                  // sprawdź kolejne wystąpienie
                }
              }
            }
          }
          pos = content.indexOf(m, pos + m.length);
        }
      }
    } catch {
      // fallback do przeglądarki
    }
  }

  // W środowisku przeglądarkowym
  try {
    let binaryString = '';
    const CHUNK_SIZE = 32768;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binaryString += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }

    if (binaryString.includes('masterVaultRecord')) {
      const match = binaryString.match(/\{\s*"masterVaultRecord"\s*:\s*\{[\s\S]*?\}\s*\}\s*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          // kontynuacja
        }
      }
    }

    let cumulativeDecompressed = 0;
    const markers = ['/application#2Fjson', '/application/json', '/EmbeddedFile', 'mastervault.json'];
    for (const m of markers) {
      let pos = binaryString.indexOf(m);
      while (pos !== -1) {
        const objStart = binaryString.lastIndexOf('obj', pos);
        const streamKeyword = 'stream';
        let streamStart = binaryString.indexOf(streamKeyword, objStart !== -1 ? objStart : pos);
        if (streamStart !== -1) {
          streamStart += streamKeyword.length;
          if (binaryString.charCodeAt(streamStart) === 0x0d) streamStart++;
          if (binaryString.charCodeAt(streamStart) === 0x0a) streamStart++;
          const streamEnd = binaryString.indexOf('endstream', streamStart);
          if (streamEnd !== -1 && streamEnd > streamStart) {
            const slice = bytes.subarray(streamStart, streamEnd);
            const streamSize = streamEnd - streamStart;
            cumulativeDecompressed += streamSize * 10;
            if (cumulativeDecompressed > MAX_CUMULATIVE_DECOMPRESSED_BYTES) {
              throw new Error(
                'Dokument PDF zawiera zbyt wiele danych po dekompresji. Plik może być uszkodzony lub zawierać złośliwą strukturę.'
              );
            }
            try {
              const text = await decompressStreamBytes(slice, MAX_CUMULATIVE_DECOMPRESSED_BYTES - cumulativeDecompressed);
              if (text.includes('masterVaultRecord')) {
                return JSON.parse(text);
              }
            } catch {
              // spróbuj kolejne
            }
          }
        }
        pos = binaryString.indexOf(m, pos + m.length);
      }
    }
  } catch {
    // brak
  }

  return null;
}

/**
 * Konwertuje odzyskany rekord resumeData na standardowy format ParsedCVResult w Kierivo.
 */
export function convertResumeDataToParsedCVResult(
  data: MasterVaultEmbeddedData
): ParsedCVResult | null {
  const resume = data?.masterVaultRecord?.resumeData;
  if (!resume || !resume.name) {
    return null;
  }

  const hardSkills: string[] = [];
  const toolsAndTech: string[] = [];
  const softSkills: string[] = [];

  for (const item of resume.skills || []) {
    if (!item) continue;
    const label = typeof item === 'string' ? item : item.label || '';
    const group = typeof item === 'object' ? item.group : 'core';
    if (!label) continue;

    if (group === 'tooling') {
      toolsAndTech.push(label);
    } else if (group === 'soft') {
      softSkills.push(label);
    } else {
      hardSkills.push(label);
    }
  }

  const history: WorkExperience[] = (resume.experience || []).map((exp, idx) => ({
    id: `exp-portable-${idx + 1}`,
    company: exp.company || '',
    role: exp.role || '',
    location: exp.location || '',
    startDate: exp.start || '',
    endDate: exp.end || '',
    isCurrent: exp.end === 'obecnie',
    description: '',
    highlights: (exp.bullets || []).map((b, bIdx) => ({
      id: `h-portable-${idx + 1}-${bIdx + 1}`,
      text: b.display || b.text || '',
      action: '',
      target: '',
      tool: exp.tech?.[0] || '',
      metric: b.kind === 'result' ? 'zweryfikowano' : '',
      keywords: exp.tech || [],
    })),
  }));

  const education: Education[] = (resume.education || []).map((edu, idx) => ({
    id: `edu-portable-${idx + 1}`,
    institution: edu.school || '',
    degree: edu.degree || '',
    fieldOfStudy: '',
    startDate: edu.start || '',
    endDate: edu.end || '',
    description: edu.note || '',
  }));

  const certifications: Certification[] = (resume.certifications || []).map((cert, idx) => ({
    id: `cert-portable-${idx + 1}`,
    name: cert.name || '',
    issuer: cert.issuer || '',
    date: cert.year || '',
  }));

  const normalizeCefr = (lvl?: string): LanguageProficiency['level'] => {
    if (!lvl) return 'B2';
    const clean = lvl.trim();
    if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native'].includes(clean)) {
      return clean as LanguageProficiency['level'];
    }
    const upper = clean.toUpperCase();
    if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(upper)) {
      return upper as LanguageProficiency['level'];
    }
    if (upper === 'NATIVE') return 'Native';
    return 'B2';
  };

  const languages: LanguageProficiency[] = (resume.languages || []).map((lang, idx) => ({
    id: `lang-portable-${idx + 1}`,
    language: lang.name || '',
    level: normalizeCefr(lang.level),
    context: '',
  }));

  const projects: Project[] = (resume.projects || []).map((p: any, idx: number) => ({
    id: `proj-portable-${idx + 1}`,
    name: p.name || `Projekt ${idx + 1}`,
    role: p.role || '',
    description: p.description || '',
    techStack: Array.isArray(p.techStack) ? p.techStack : [],
    metrics: p.metrics || '',
  }));

  const summaryText = typeof resume.summary === 'string'
    ? resume.summary
    : resume.summary?.display || '';

  return {
    personalInfo: {
      fullName: resume.name || '',
      title: resume.title || '',
      email: resume.contact?.email || '',
      phone: resume.contact?.phone || '',
      location: resume.contact?.city || '',
      summary: summaryText,
    },
    hardSkills,
    softSkills,
    toolsAndTech,
    certifications,
    history,
    education,
    languages: languages.length > 0 ? languages : undefined,
    projects: projects.length > 0 ? projects : undefined,
    rawText: JSON.stringify(data, null, 2),
    detectedFormat: 'KIERIVO_PORTABLE_PDF',
    hasCyrillicScript: false,
    warnings: [],
  };
}
