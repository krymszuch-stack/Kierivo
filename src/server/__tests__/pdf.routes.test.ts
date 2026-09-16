import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { pdfRouter } from '../routes/pdf.routes';
import { createEmptyVault } from '../../lib/sampleVault';

describe('pdf.routes API Suite', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api', pdfRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/cv/themes zwraca katalog motywów i układów', async () => {
    const res = await fetch(`${baseUrl}/api/cv/themes`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.themes)).toBe(true);
    expect(data.themes.length).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(data.layouts)).toBe(true);
    expect(data.layouts.length).toBeGreaterThanOrEqual(5);

    const parchment = data.themes.find((t: { id: string }) => t.id === 'parchment');
    expect(parchment).toBeDefined();
    expect(parchment.accent).toBeDefined();
  });

  it('POST /api/cv/export-pdf odrzuca żądanie bez danych MasterVault (kod 400)', async () => {
    const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Brak wymaganych danych');
  });

  it('POST /api/cv/export-pdf generuje poprawny strumień binarny PDF (%PDF-)', async () => {
    const vault = createEmptyVault('Adam Nowak', 'adam@example.pl');
    vault.personalInfo = {
      fullName: 'Adam Nowak',
      title: 'Technik Mechanik',
      summary: 'Doświadczony mechanik urządzeń przemysłowych.',
      email: 'adam@example.pl',
      phone: '+48 500 600 700',
      location: 'Kraków',
    };
    vault.skillsMatrix = {
      hardSkills: ['Montaż mechaniczny', 'Pneumatyka'],
      toolsAndTech: ['Klucze dynamometryczne'],
      softSkills: ['Dokładność'],
      certifications: [],
    };
    vault.history = [
      {
        id: 'h1',
        company: 'Zremb Sp. z o.o.',
        role: 'Mechanik',
        location: 'Kraków',
        startDate: '2021-01',
        endDate: '2023-12',
        isCurrent: false,
        highlights: [
          {
            id: 'hl1',
            text: 'Remonty 40 przekładni zębatych rocznie.',
            action: 'Remont',
            target: 'Przekładnie',
            tool: 'Narzędzia warsztatowe',
            metric: '40 szt.',
            keywords: ['Mechanika'],
          },
        ],
      },
    ];

    const res = await fetch(`${baseUrl}/api/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vault,
        theme: 'blueprint',
        layout: 'sidebar',
        targetPages: 1,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('CV_Adam_Nowak.pdf');
    expect(res.headers.get('x-cv-theme')).toBe('blueprint');
    expect(res.headers.get('x-cv-cache')).toBe('MISS');

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const magic = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, 5)));
    expect(magic).toBe('%PDF-');

    // Drugie zapytanie z identycznym payloadem powinno trafić w cache SHA-256 (HIT) w ułamku sekundy
    const startHit = performance.now();
    const hitRes = await fetch(`${baseUrl}/api/cv/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vault,
        theme: 'blueprint',
        layout: 'sidebar',
        targetPages: 1,
      }),
    });
    const hitDuration = performance.now() - startHit;

    expect(hitRes.status).toBe(200);
    expect(hitRes.headers.get('x-cv-cache')).toBe('HIT');
    expect(hitRes.headers.get('x-cv-theme')).toBe('blueprint');
    expect(hitDuration).toBeLessThan(100); // Błyskawiczny odczyt z RAM
    const hitBuffer = await hitRes.arrayBuffer();
    expect(hitBuffer.byteLength).toBe(buffer.byteLength);
  });
});
