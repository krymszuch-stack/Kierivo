export type SupportCategory = 'wsparcie' | 'problem';

/** Buduje szkic dla programu pocztowego; samo otwarcie nie wysyła wiadomości. */
export function buildSupportEmailHref(input: {
  category: SupportCategory;
  email: string;
  message: string;
}): string {
  const subject = input.category === 'problem'
    ? 'Zgłoszenie problemu technicznego — Kierivo'
    : 'Pytanie do wsparcia — Kierivo';
  const replyAddress = input.email.trim();
  const body = [
    ...(replyAddress ? [`Adres do odpowiedzi: ${replyAddress}`, ''] : []),
    input.message.trim(),
  ].join('\r\n');

  return `mailto:pomoc@kierivo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
