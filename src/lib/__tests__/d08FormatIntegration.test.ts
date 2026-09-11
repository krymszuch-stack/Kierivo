import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import { jsPDF } from 'jspdf';
import { extractTextFromAnyFile } from '../cvUniversalParser';
import { computeD08TokenAgreement } from '../audit-core/d08/extractor';
import {
  auditPdfStructuralReadability,
  extractD08SignalsFromPdf,
} from '../audit-core/d08/pdfAudit';

describe('D08 — integracja z realnymi binarnymi formatami', () => {
  it('przechodzi przez rzeczywisty PDF: bytes → PDF.js → D08 signals → scorer', async () => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFontSize(18);
    pdf.text('JAN KOWALSKI', 48, 54);
    pdf.setFontSize(12);
    pdf.text('EXPERIENCE', 48, 96);
    pdf.text('IT Support Specialist - Example Company', 48, 118);
    pdf.text('SKILLS', 48, 160);
    pdf.text('Microsoft 365 PowerShell Active Directory', 48, 182);

    const bytes = pdf.output('arraybuffer');
    const file = new File([bytes], 'd08-integration.pdf', { type: 'application/pdf' });

    const extraction = await extractD08SignalsFromPdf(file);
    const result = await auditPdfStructuralReadability(file);

    expect(extraction.extractedText).toContain('JAN KOWALSKI');
    expect(extraction.extractedText).toContain('EXPERIENCE');
    expect(extraction.signals.measurementHealth.pipelineHealthy).toBe(true);
    expect(extraction.signals.evidence.length).toBeGreaterThanOrEqual(4);
    expect(extraction.signals.textLayer.nativeTextCoverage).toBeGreaterThan(0.9);
    expect(result.verdictCode).not.toBe('D08_PDF_EXTRACTION_EXCEPTION');
  });

  it('przechodzi przez rzeczywisty DOCX i zachowuje treść dla pomiaru text integrity', async () => {
    const sourceLines = [
      'JAN KOWALSKI',
      'IT SUPPORT SPECIALIST',
      'EXPERIENCE',
      'Example Company',
      'Microsoft 365 PowerShell Active Directory',
      'EDUCATION',
      'Example University',
    ];

    const document = new Document({
      sections: [
        {
          children: sourceLines.map((text) => new Paragraph({ text })),
        },
      ],
    });
    const buffer = await Packer.toBuffer(document);
    const file = new File(
      [buffer],
      'd08-integration.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    );

    const parsed = await extractTextFromAnyFile(file);
    const agreement = computeD08TokenAgreement(sourceLines.join('\n'), parsed.text);

    expect(parsed.format).toBe('DOCX');
    expect(parsed.text).toContain('JAN KOWALSKI');
    expect(parsed.text).toContain('Example University');
    expect(agreement.precision).toBeGreaterThan(0.98);
    expect(agreement.recall).toBeGreaterThan(0.98);
    expect(agreement.f1).toBeGreaterThan(0.98);
  });
});
