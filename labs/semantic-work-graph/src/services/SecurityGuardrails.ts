/**
 * Security Guardrail Module for semantic-work-graph SQLite & Gemini API
 */

export const VULGARITIES_PL_EN = [
  'kurwa', 'kurwie', 'kurwy', 'chuj', 'chuja', 'chujowy', 'pizda', 'pizdzie', 'jebać', 'jebac', 'jebany', 'pierdolić', 'pierdolic', 'spierdalać', 'skurwiel', 'fiut', 'kutas', 'dziwka',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'nigger', 'faggot'
];

export class SecurityGuardrails {
  /**
   * Sanitizes input text against XSS, HTML script injection, and SQL injection vectors
   */
  public sanitizeInput(input: string): string {
    if (!input) return '';

    return input
      .replace(/<script\b[^<]*>(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/eval\s*\(/gi, '')
      .replace(/'/g, "''")
      .trim();
  }

  /**
   * Scans for vulgarities and profanity in Polish & English
   */
  public checkProfanity(text: string): { isVulgar: boolean; detectedWords: string[]; sanitizedText: string } {
    if (!text) return { isVulgar: false, detectedWords: [], sanitizedText: '' };

    const words = text.split(/\s+/);
    const detectedWords: string[] = [];

    const sanitizedWords = words.map((w) => {
      const cleanWord = w.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/gi, '');
      if (VULGARITIES_PL_EN.includes(cleanWord)) {
        detectedWords.push(w);
        return '***';
      }
      return w;
    });

    return {
      isVulgar: detectedWords.length > 0,
      detectedWords,
      sanitizedText: sanitizedWords.join(' '),
    };
  }

  /**
   * Validates a Gemini AI proposal for safety before inserting into DB
   */
  public validateProposalSafety(proposal: any): { isSafe: boolean; reason?: string } {
    if (!proposal) return { isSafe: false, reason: 'Pusta propozycja' };

    const jsonStr = JSON.stringify(proposal);

    // Check script injection
    if (/<script/i.test(jsonStr) || /javascript:/i.test(jsonStr)) {
      return { isSafe: false, reason: 'Wykryto próbę injekcji kodu JavaScript/XSS w propozycji AI' };
    }

    // Check profanity
    const profanity = this.checkProfanity(jsonStr);
    if (profanity.isVulgar) {
      return { isSafe: false, reason: `Wykryto słowa wulgarne w propozycji AI: ${profanity.detectedWords.join(', ')}` };
    }

    return { isSafe: true };
  }
}
