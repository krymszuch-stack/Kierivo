import { isPlausibleEmailAddress } from './emailAddress';

export type SupportCategory = 'wsparcie' | 'problem';

/**
 * Pole jest opcjonalne, ale jeśli je podano, nie może wstawić błędnego adresu
 * do szkicu. Walidacja celowo sprawdza typowy adres, a nie pełną składnię RFC.
 */
export function isValidSupportReplyAddress(email: string): boolean {
  const normalized = email.trim();
  return normalized === '' || isPlausibleEmailAddress(normalized);
}

/** Buduje szkic dla programu pocztowego; samo otwarcie nie wysyła wiadomości. */
export function buildSupportEmailHref(input: {
  category: SupportCategory;
  email: string;
  message: string;
}): string | undefined {
  const message = input.message.trim();
  if (!message || !isValidSupportReplyAddress(input.email)) return undefined;

  const subject = input.category === 'problem'
    ? 'Zgłoszenie problemu technicznego — Kierivo'
    : 'Pytanie do wsparcia — Kierivo';
  const replyAddress = input.email.trim();
  const body = [
    ...(replyAddress ? [`Adres do odpowiedzi: ${replyAddress}`, ''] : []),
    message,
  ].join('\r\n');

  return `mailto:pomoc@kierivo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
