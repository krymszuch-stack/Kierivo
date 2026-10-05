import { describe, expect, it } from 'vitest';
import { cvCopyNotice } from '../cvCopyNotice';

describe('komunikat ukończonej czynności CV', () => {
  it('opisuje skopiowany tekst jako skopiowany, nie pobrany PDF', () => {
    expect(cvCopyNotice({ document: { kind: 'cv', format: 'plain-text', content: 'CV syntetyczne' } })).toEqual({
      title: 'Treść CV skopiowana',
      message: 'Tekst dokumentu został skopiowany do schowka.',
    });
  });

  it('nie wyświetla drugiego komunikatu dla pobranego PDF', () => {
    expect(cvCopyNotice({ exportedCv: {
      templateId: 'semantic-dual-layer-classic-header',
      templateName: 'PDF ATS / Dual-Layer — classic / header',
      fit: 'ats-friendly',
      exportedAt: '2026-10-01T00:00:00.000Z',
    } })).toBeNull();
  });
});
