import type { InterviewLoopSession, PostCallDebrief } from '../types';

const OPENING_COUNT = 4;

/** Builds a follow-up draft from the interview context and the user's own notes. */
export function generateFollowUpEmail(
  session: InterviewLoopSession,
  candidateName = '',
  debriefData?: Partial<PostCallDebrief>,
  variantIndex = 0,
): string {
  const role = session.roleTitle?.trim();
  const company = session.companyName?.trim();
  const topic = debriefData?.whatWentWell?.trim();
  const clarification = debriefData?.topicsToClarifyInFollowUp?.trim();
  const openingVariant = ((variantIndex % OPENING_COUNT) + OPENING_COUNT) % OPENING_COUNT;
  const openings = [
    role
      ? `Dziękuję za rozmowę dotyczącą stanowiska ${role}${company ? ` w firmie ${company}` : ''}.`
      : 'Dziękuję za rozmowę rekrutacyjną.',
    role
      ? `Dziękuję za spotkanie w sprawie rekrutacji na stanowisko ${role}${company ? ` w firmie ${company}` : ''}.`
      : 'Dziękuję za spotkanie dotyczące rekrutacji.',
    role
      ? `Przesyłam podziękowanie za rozmowę o stanowisku ${role}${company ? ` w firmie ${company}` : ''}.`
      : 'Przesyłam podziękowanie za rozmowę rekrutacyjną.',
    role
      ? `Dziękuję za poświęcony czas podczas rozmowy dotyczącej stanowiska ${role}${company ? ` w firmie ${company}` : ''}.`
      : 'Dziękuję za poświęcony czas podczas rozmowy rekrutacyjnej.',
  ];

  const body = [
    'Dzień dobry,',
    '',
    openings[openingVariant],
    ...(topic ? ['', `Notatka po rozmowie: ${topic}`] : []),
    ...(clarification ? ['', `Proszę o doprecyzowanie kwestii: ${clarification}`] : []),
    '',
    'Proszę o informację o kolejnych krokach procesu rekrutacyjnego.',
  ];
  const name = candidateName.trim();
  if (name && name.toLocaleLowerCase('pl-PL') !== 'kandydat') {
    body.push('', 'Z poważaniem,', name);
  } else {
    body.push('', 'Z poważaniem');
  }

  return body.join('\n');
}
