import {
  parseJobDescriptionWithGemini,
  generateCoverLetterWithFlash,
  generateInterviewCheatSheetEnrichmentWithFlash,
} from '../gemini';
import { MasterVault } from '../../types';

/**
 * Warstwa serwisowa nad wywoĹ‚aniami modelu.
 *
 * Tylko `parseJd` jest dziĹ› wystawione jako trasa HTTP â€” reszta metod czeka na
 * podpiÄ™cie do interfejsu w Fazie 6, juĹĽ za uwierzytelnieniem i licznikiem kwot.
 * Trzymamy je tutaj, bo implementacje w `gemini.ts` sÄ… gotowe i przetestowane;
 * brakuje wyĹ‚Ä…cznie ekranu, ktĂłry by ich uĹĽywaĹ‚, i kontroli uprawnieĹ„.
 */
export class AiService {
  /** Zamienia treĹ›Ä‡ ogĹ‚oszenia na ustrukturyzowane wymagania. */
  async parseJd(rawJdText: string) {
    return parseJobDescriptionWithGemini(rawJdText);
  }

  /**
   * Generuje spersonalizowanÄ… czÄ™Ĺ›Ä‡ Ĺ›ciÄ…gi na rozmowÄ™.
   *
   * Reszta Ĺ›ciÄ…gi (sĹ‚ownik, checklista, bank pytaĹ„) powstaje lokalnie i za zero
   * tokenĂłw â€” tutaj trafia tylko to, co wymaga osadzenia w historii kandydata.
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

  /** Generuje list motywacyjny na podstawie profilu i treĹ›ci ogĹ‚oszenia. */
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
