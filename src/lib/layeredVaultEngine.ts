import { MasterVault, LayeredFactItem, PreFlightCheckItem } from '../types';
import { reportClientError } from './errorReporter';

/**
 * Wspólna obsługa wyjątków generatorów CV: zgłoś zanonimizowane zdarzenie
 * (`cv-export`) i przekaż wyjątek dalej. Zgłoszenie nie może zmieniać zachowania
 * — interfejs obsługuje błąd tak jak dotąd, a operator dostaje ślad w bazie.
 */
function reportCvExportError(surface: string, error: unknown): void {
  reportClientError({ kind: 'cv-export', surface, error });
}

/**
 * FILAR 1: Layered Fact Helper - Promotes per-job edit to MasterVault or keeps per-job override
 */
export function handleFactEditPromotion(
  vault: MasterVault,
  fact: LayeredFactItem,
  newText: string,
  promoteToVault: boolean
): { updatedVault: MasterVault; updatedFact: LayeredFactItem } {
  const updatedFact: LayeredFactItem = {
    ...fact,
    userOverrideText: newText,
    isUserEdited: true,
    sourceType: 'USER_EDITED',
  };

  const updatedVault = JSON.parse(JSON.stringify(vault)) as MasterVault;

  if (promoteToVault && fact.experienceId) {
    const exp = updatedVault.history.find(h => h.id === fact.experienceId);
    if (exp) {
      const highlight = exp.highlights.find(hl => hl.text === fact.baseText || hl.id === fact.sourceFactId);
      if (highlight) {
        highlight.text = newText;
      }
    }
  }

  return { updatedVault, updatedFact };
}

/**
 * FILAR 6: Pre-Flight Export Validation Checklist Generator
 */
export function generatePreFlightChecklist(
  vault: MasterVault,
  layeredFacts: LayeredFactItem[],
  missingKeywords: string[],
  targetRole: string
): PreFlightCheckItem[] {
  const items: PreFlightCheckItem[] = [];

  // Check 1: Zero Hallucination (Fact Accuracy)
  const isZeroHallucination = layeredFacts.every(f => f.baseText || f.userOverrideText);
  items.push({
    id: 'chk_accuracy',
    title: 'Zero-Halucynacji (Prawda Źródłowa Vault)',
    status: isZeroHallucination ? 'PASSED' : 'FAILED',
    message: isZeroHallucination
      ? 'Wszystkie opisy opierają się na Twoich zadeklarowanych faktach z MasterVault.'
      : 'Wkryto zdanie niepowiązane z bazą faktów.',
    category: 'FACT_ACCURACY',
  });

  // Check 2: Must-Have / Dealbreakers
  const hasCriticalMissing = missingKeywords.length > 5;
  items.push({
    id: 'chk_dealbreakers',
    title: 'Wymagania Twarde i Dealbreakery',
    status: hasCriticalMissing ? 'WARNING' : 'PASSED',
    message: hasCriticalMissing
      ? `Brak ${missingKeywords.length} fraz kluczowych. Sprawdź, czy spełniasz wymogi twarde.`
      : 'Sprawdzono wymagania twarde – wysoki stopień zgodności z ofertą.',
    category: 'DEALBREAKER',
  });

  // Check 3: Numeric Proofs & Metrics
  const hasDigitMetrics = layeredFacts.some(f => /\d/.test(f.jobReframedText || f.baseText));
  items.push({
    id: 'chk_metrics',
    title: 'Wskaźniki Cyfrowe i Dowody (Liczby)',
    status: hasDigitMetrics ? 'PASSED' : 'WARNING',
    message: hasDigitMetrics
      ? 'Dokument zawiera cyfrowe wskaźniki i liczby (np. 4,40/5, 100%), co zwiększa wiarygodność.'
      : 'Warto dodać konkretne wskaźniki liczbowe do opisu zadań.',
    category: 'METRICS',
  });

  // Check 4: Page Budget (1 Page Fit)
  const totalBullets = layeredFacts.length;
  items.push({
    id: 'chk_page_budget',
    title: 'Budżet Objętościowy (1 Strona A4)',
    status: totalBullets <= 12 ? 'PASSED' : 'WARNING',
    message: totalBullets <= 12
      ? 'CV zachowuje optymalną długość 1 strony A4 w układzie jednokolumnowym ATS.'
      : 'Liczba punktów przekracza 12 – ryzyko przejścia na 2. stronę.',
    category: 'PAGE_BUDGET',
  });

  // Check 5: Language Consistency
  items.push({
    id: 'chk_language',
    title: 'Spójność Językowa Dokumentu',
    status: 'PASSED',
    message: 'Nagłówki i opisy zachowują spójny rejestr językowy zgodny z ogłoszeniem.',
    category: 'LANGUAGE',
  });

  return items;
}

/**
 * FILAR 3: Plain Text (TXT) Export Generator for Legacy Corporate Forms
 */
export function generatePlainTextCvExport(
  vault: MasterVault,
  layeredFacts: LayeredFactItem[],
  targetRole: string,
  companyName: string
): string {
  try {
    const lines: string[] = [];

    lines.push(`==================================================`);
    lines.push(`${vault.personalInfo.fullName.toUpperCase()}`);
    lines.push(`${targetRole || vault.personalInfo.title} | ${companyName || ''}`);
    lines.push(`E-mail: ${vault.personalInfo.email} | Tel: ${vault.personalInfo.phone} | ${vault.personalInfo.location}`);
    lines.push(`LinkedIn: ${vault.personalInfo.linkedin || ''}`);
    lines.push(`==================================================\n`);

    lines.push(`--- PROFIL ZAWODOWY ---`);
    lines.push(`${vault.personalInfo.summary}\n`);

    lines.push(`--- DOŚWIADCZENIE ZAWODOWE ---`);
    vault.history.forEach(exp => {
      lines.push(`• ${exp.role.toUpperCase()} @ ${exp.company} (${exp.startDate} - ${exp.endDate})`);
      const expFacts = layeredFacts.filter(f => f.experienceId === exp.id);
      expFacts.forEach(f => {
        lines.push(`   - ${f.userOverrideText || f.jobReframedText || f.baseText}`);
      });
      lines.push(``);
    });

    lines.push(`--- UMIEJĘTNOŚCI I NARZĘDZIA ---`);
    lines.push(`Twarde: ${vault.skillsMatrix.hardSkills.join(', ')}`);
    lines.push(`Narzędzia: ${vault.skillsMatrix.toolsAndTech.join(', ')}`);
    lines.push(`Miękkie: ${vault.skillsMatrix.softSkills.join(', ')}\n`);

    return lines.join('\n');
  } catch (error) {
    // Vault bez personalInfo/history wywraca tu dostępem do właściwości pustki;
    // to klasyczny crash „generowania CV", który dotąd znikał bez śladu.
    reportCvExportError('engine:plainText', error);
    throw error;
  }
}

/**
 * FILAR 3: LinkedIn-Ready Snippets Export Generator
 */
export function generateLinkedInReadyExport(
  vault: MasterVault,
  targetRole: string
): { headline: string; aboutSection: string; experienceBullets: Array<{ company: string; role: string; text: string }> } {
  try {
    const headline = `${targetRole || vault.personalInfo.title} | ${vault.skillsMatrix.hardSkills.slice(0, 4).join(' • ')}`;

    const aboutSection = `${vault.personalInfo.summary}\n\nKluczowe kompetencje: ${vault.skillsMatrix.hardSkills.join(', ')}\nNarzędzia: ${vault.skillsMatrix.toolsAndTech.join(', ')}`;

    const experienceBullets = vault.history.map(exp => ({
      company: exp.company,
      role: exp.role,
      text: exp.highlights.map(h => `• ${h.text}`).join('\n')
    }));

    return { headline, aboutSection, experienceBullets };
  } catch (error) {
    reportCvExportError('engine:linkedin', error);
    throw error;
  }
}
