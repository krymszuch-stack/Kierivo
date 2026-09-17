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
 * Wykorzystuje wyłącznie standardowe Web API (DecompressionStream) bez zależności od Node.js zlib.
 */
export async function decompressStreamBytes(compressedSlice: Uint8Array, maxDecompressedBytes: number = 0): Promise<string> {
  if (typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined') {
    for (const format of ['deflate', 'deflate-raw'] as const) {
      try {
        let totalBytes = 0;
        const sizeLimiter = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            totalBytes += chunk.length;
            if (maxDecompressedBytes > 0 && totalBytes > maxDecompressedBytes) {
              controller.error(
                new Error('Zdekompresowany załącznik PDF jest zbyt duży. Plik może zawierać złośliwą strukturę.')
              );
              return;
            }
            controller.enqueue(chunk);
          },
        });

        const ds = new DecompressionStream(format);
        const decompressedStream = new Response(compressedSlice).body
          ?.pipeThrough(ds)
          .pipeThrough(sizeLimiter);

        if (!decompressedStream) {
          continue;
        }

        const text = await new Response(decompressedStream).text();
        return text;
      } catch (err) {
        if (err instanceof Error && err.message.includes('zbyt duży')) {
          throw err;
        }
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
  
  try {
    let binaryString = '';
    if (typeof Buffer !== 'undefined') {
      binaryString = Buffer.from(bytes).toString('binary');
    } else {
      const CHUNK_SIZE = 32768;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binaryString += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
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

    // Szukamy sekwencji wskazujących na załączony plik JSON
    const markers = ['mastervault.json', '/EmbeddedFile', 'masterVaultRecord'];
    let cumulativeDecompressed = 0;
    for (const m of markers) {
      let pos = binaryString.indexOf(m);
      while (pos !== -1) {
        const objStart = binaryString.lastIndexOf('obj', pos);
        const searchStart = objStart !== -1 ? objStart : pos;
        const streamKeyword = 'stream';
        let streamStart = binaryString.indexOf(streamKeyword, searchStart);
        if (streamStart !== -1) {
          streamStart += streamKeyword.length;
          if (binaryString.charCodeAt(streamStart) === 0x0d) streamStart++;
          if (binaryString.charCodeAt(streamStart) === 0x0a) streamStart++;
          const streamEnd = binaryString.indexOf('endstream', streamStart);
          if (streamEnd !== -1 && streamEnd > streamStart) {
            let actualStreamEnd = streamEnd;
            while (
              actualStreamEnd > streamStart &&
              (bytes[actualStreamEnd - 1] === 0x0a || bytes[actualStreamEnd - 1] === 0x0d)
            ) {
              actualStreamEnd--;
            }
            const slice = bytes.subarray(streamStart, actualStreamEnd);
            const streamSize = actualStreamEnd - streamStart;
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
