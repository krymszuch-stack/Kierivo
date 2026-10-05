import type { CvExportEvent } from '../types';

export interface CvCopyNotice {
  title: string;
  message: string;
}

/** Tekst komunikatu rozróżnia skopiowaną treść od pobranego pliku PDF. */
export function cvCopyNotice(event: CvExportEvent): CvCopyNotice | null {
  if (event.document?.kind === 'cv' && event.document.format === 'plain-text') {
    return {
      title: 'Treść CV skopiowana',
      message: 'Tekst dokumentu został skopiowany do schowka.',
    };
  }

  return null;
}
