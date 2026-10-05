import { describe, expect, it } from 'vitest';
import { readLastJobAnalysis } from '../lastJobAnalysis';

const validSummary = {
  position: 'Specjalista wsparcia',
  company: 'Firma testowa',
  score: 68,
  strengths: ['Windows'],
  gaps: ['Exchange Online'],
  analyzedAt: '2026-10-02T10:00:00.000Z',
};

describe('bezpieczny odczyt ostatniej analizy z profilu', () => {
  it('zachowuje kompletny zapis bez zmiany treści', () => {
    expect(readLastJobAnalysis(validSummary)).toEqual({ state: 'valid', value: validSummary });
  });

  it('rozróżnia brak wpisu od uszkodzonego zapisu', () => {
    expect(readLastJobAnalysis(null)).toEqual({ state: 'missing' });
    expect(readLastJobAnalysis([])).toEqual({ state: 'invalid' });
    expect(readLastJobAnalysis({ ...validSummary, gaps: {} })).toEqual({ state: 'invalid' });
    expect(readLastJobAnalysis({ ...validSummary, strengths: ['Windows', null] })).toEqual({ state: 'invalid' });
  });

  it('nie uznaje nieliczbowego wyniku za zapis analizy', () => {
    expect(readLastJobAnalysis({ ...validSummary, score: '68' })).toEqual({ state: 'invalid' });
  });

  it('zachowuje starszą i nieznaną wersję reguł bez podstawiania bieżącej', () => {
    for (const atsScoreProvenance of ['canonical-v1', 'nieznany-silnik']) {
      const value = { ...validSummary, atsScoreProvenance };
      expect(readLastJobAnalysis(value)).toEqual({ state: 'valid', value });
    }
    expect(readLastJobAnalysis({ ...validSummary, atsScoreProvenance: 2 })).toEqual({ state: 'invalid' });
  });
});
