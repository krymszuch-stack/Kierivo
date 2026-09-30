import {
  parseRawCvToVault,
  parseJobDescriptionWithGemini,
  generateCoverLetterWithFlash,
  generateInterviewCheatSheetEnrichmentWithFlash,
} from '../gemini';
import { MasterVault } from '../../types';

/**
 * Warstwa serwisowa nad wywołaniami modelu.
 *
 * Tylko `parseJd` jest dziś wystawione jako trasa HTTP — reszta metod czeka na
 * podpięcie do interfejsu w Fazie 6, już za uwierzytelnieniem i licznikiem kwot.
 * Trzymamy je tutaj, bo implementacje w `gemini.ts` są gotowe i przetestowane;
 * brakuje wyłącznie ekranu, który by ich używał, i kontroli uprawnień.
 */
export class AiService {
  /** Zamienia surowy tekst CV na strukturę MasterVault. */
  async parseCv(rawText: string): Promise<Partial<MasterVault>> {
    return parseRawCvToVault(rawText);
  }

  /** Zamienia treść ogłoszenia na ustrukturyzowane wymagania. */
  async parseJd(rawJdText: string) {
    return parseJobDescriptionWithGemini(rawJdText);
  }

  /**
   * Generuje spersonalizowaną część ściągi na rozmowę.
   *
   * Reszta ściągi (słownik, checklista, bank pytań) powstaje lokalnie i za zero
   * tokenów — tutaj trafia tylko to, co wymaga osadzenia w historii kandydata.
   */
  async generateCheatSheetEnrichment(
    targetRole: string,
    companyName: string,
    jobDescription: string,
    vault: MasterVault,
    topRequirements: string[] = []
  ) {
    return generateInterviewCheatSheetEnrichmentWithFlash(
      vault,
      targetRole,
      companyName,
      jobDescription,
      topRequirements
    );
  }

  /** Generuje list motywacyjny na podstawie profilu i treści ogłoszenia. */
  async generateCoverLetter(
    targetRole: string,
    companyName: string,
    jobDescription: string,
    vault: MasterVault
  ) {
    return generateCoverLetterWithFlash(vault, targetRole, companyName, jobDescription);
  }
}

export const aiService = new AiService();
