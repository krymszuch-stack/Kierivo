import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { scoreCanonicalAts } from '../canonicalAts';
import { createEmptyVault } from '../sampleVault';
import {
  EmptyStateScoreRing,
  ResultScoreRing,
  ScoreRing,
} from '../../components/ui/ScoreRing';
import { ScrollContinuationHint } from '../../components/ui/ScrollContinuationHint';

describe('Audyt kanoniczny — stan pusty (EmptyStateScoreRing) vs realny wynik 0% (ResultScoreRing)', () => {
  it('eksportuje EmptyStateScoreRing, ResultScoreRing i ScoreRing jako osobne komponenty', () => {
    expect(EmptyStateScoreRing).toBeDefined();
    expect(ResultScoreRing).toBeDefined();
    expect(ScoreRing).toBeDefined();
    expect(EmptyStateScoreRing).not.toBe(ResultScoreRing);
  });

  it('rozróżnia stan pusty (INSUFFICIENT_CV) od realnego wyniku 0% po wypełnieniu profilu', () => {
    const emptyVault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    emptyVault.personalInfo.title = '';
    emptyVault.skillsMatrix.hardSkills = [];
    emptyVault.history = [];

    const jd = 'Wymagania: C++, Rust, Embedded systems, Linux kernel.';
    const emptyResult = scoreCanonicalAts(emptyVault, jd);

    expect(emptyResult.state).toBe('INSUFFICIENT_CV');
    expect(emptyResult.score).toBe(0);

    // Wypełniony profil, ale bez żadnych pasujących umiejętności do specyficznego ogłoszenia
    const filledVault = createEmptyVault('Anna Nowak', 'anna@example.com');
    filledVault.personalInfo.title = 'Kucharz';
    filledVault.personalInfo.summary = 'Doświadczony szef kuchni z 10-letnim stażem.';
    filledVault.skillsMatrix.hardSkills = ['Gotowanie', 'Cukiernictwo', 'HACCP'];
    filledVault.history = [
      {
        id: 'h1',
        company: 'Restauracja',
        role: 'Szef kuchni',
        location: 'Warszawa',
        startDate: '2015-01',
        endDate: '2024-01',
        isCurrent: false,
        highlights: [{ id: 'hl1', text: 'Zarządzanie kuchnią', action: '', target: '', tool: '', metric: '', keywords: [] }],
      },
    ];

    const filledResult = scoreCanonicalAts(filledVault, jd);
    // Profil jest ocenialny (SCORABLE), nawet jeśli dopasowanie do oferty C++/Rust wynosi 0%
    expect(filledResult.state).toBe('SCORABLE');
  });

  it('weryfikuje kontrakt widoku AtsLabView.tsx w stanie pustym', () => {
    const viewPath = path.resolve(__dirname, '../../features/ats/AtsLabView.tsx');
    const source = fs.readFileSync(viewPath, 'utf8');

    // (1) Użycie EmptyStateScoreRing i ResultScoreRing
    expect(source).toContain('EmptyStateScoreRing');
    expect(source).toContain('ResultScoreRing');
    expect(source).toContain('message="Brak danych"');

    // (2) Cztery kafle w stanie pustym mają neutralny kolor tekstu (text-ink-muted), nie text-amber-500
    expect(source).toContain("if (isEmpty) return 'text-ink-muted';");

    // (3) Przycisk Uzupełnij profil powiększony z opisem
    expect(source).toContain('size="md"');
    expect(source).toContain('Uzupełnij profil');
    expect(source).toContain('Dodaj doświadczenie, umiejętności lub zaimportuj CV');

    // (4) Mediana symulatora schowana w stanie pustym
    expect(source).toContain('!isEmptyProfile &&');
    expect(source).toContain('Mediana symulatora:');
    expect(source).toContain('odniesienie z 3 silników heurystycznych');

    // (5) Wizualna reprezentacja wag (proporcje 40/25/20/15 i paski)
    expect(source).toContain('sm:flex-[40_1_0%]');
    expect(source).toContain('sm:flex-[25_1_0%]');
    expect(source).toContain('sm:flex-[20_1_0%]');
    expect(source).toContain('sm:flex-[15_1_0%]');
    expect(source).toContain('style={{ width: `${pillar.weight}%` }}');

    // (6) Nowa etykieta 'Dopasowanie profilu' z tooltipem metodologii
    expect(source).toContain('Dopasowanie profilu');
    expect(source).toContain('Metodologia Kierivo (D07–D11):');
  });

  it('weryfikuje kontrakt sticky pionowej nawigacji sekcji (mini-mapa) w AtsLabView.tsx', () => {
    const viewPath = path.resolve(__dirname, '../../features/ats/AtsLabView.tsx');
    const source = fs.readFileSync(viewPath, 'utf8');

    // Obecność definicji sekcji mini-mapy
    expect(source).toContain('Profile heurystyczne');
    expect(source).toContain('Ocena dopasowania');
    expect(source).toContain('Oceny modułów');
    expect(source).toContain('Szczegóły wybranego modułu');
    expect(source).toContain('Praktyki redakcyjne');

    // Obecność id sekcji z offsetem scroll-mt
    expect(source).toContain('id="profile-heurystyczne"');
    expect(source).toContain('id="ocena-dopasowania"');
    expect(source).toContain('id="oceny-modulow"');
    expect(source).toContain('id="szczegoly-modulu"');
    expect(source).toContain('id="praktyki-redakcyjne"');
    expect(source).toContain('scroll-mt-24');

    // Obsługa scrolla, podświetlenia aktywnej sekcji i smooth scrolla
    expect(source).toContain('showMiniMap');
    expect(source).toContain('activeSectionId');
    expect(source).toContain('handleScrollTo');
    expect(source).toContain('scrollIntoView');
    expect(source).toContain('Mini-mapa sekcji audytu');
  });

  it('weryfikuje wdrożenie jednolitego wskaźnika ScrollContinuationHint w AtsLabView.tsx', () => {
    expect(ScrollContinuationHint).toBeDefined();

    const viewPath = path.resolve(__dirname, '../../features/ats/AtsLabView.tsx');
    const source = fs.readFileSync(viewPath, 'utf8');

    // Import i obecność ScrollContinuationHint
    expect(source).toContain('ScrollContinuationHint');

    // Zmniejszony spacing z space-y-8 na spójny system space-y-5
    expect(source).toContain('space-y-5');
    expect(source).not.toContain('space-y-8');

    // Spójne wdrożenie między wszystkimi kluczowymi sekcjami
    expect(source).toContain('targetId="profile-heurystyczne"');
    expect(source).toContain('targetId="ocena-dopasowania"');
    expect(source).toContain('targetId="oceny-modulow"');
    expect(source).toContain('targetId="szczegoly-modulu"');
    expect(source).toContain('targetId="praktyki-redakcyjne"');
  });
});

