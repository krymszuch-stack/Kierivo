import { describe, expect, it } from 'vitest';
import { buildSupportEmailHref, isValidSupportReplyAddress } from '../supportEmail';

describe('szkic wiadomości do wsparcia', () => {
  it('kieruje problem do skonfigurowanego adresu i zachowuje polskie znaki', () => {
    const href = buildSupportEmailHref({
      category: 'problem',
      email: 'ala@example.test',
      message: 'Błąd przy eksporcie CV.',
    });
    expect(href).toBeDefined();
    const [recipient, query = ''] = href!.slice('mailto:'.length).split('?');
    const params = new URLSearchParams(query);

    expect(recipient).toBe('pomoc@kierivo.com');
    expect(params.get('subject')).toBe('Zgłoszenie problemu technicznego — Kierivo');
    expect(params.get('body')).toBe('Adres do odpowiedzi: ala@example.test\r\n\r\nBłąd przy eksporcie CV.');
  });

  it('nie dodaje pustego adresu odpowiedzi i nie deklaruje wysłania', () => {
    const href = buildSupportEmailHref({ category: 'wsparcie', email: '  ', message: ' Pytanie. ' });
    expect(href).toBeDefined();
    const body = new URLSearchParams(href!.split('?')[1]).get('body');

    expect(body).toBe('Pytanie.');
    expect(href).toContain('mailto:');
    expect(href).not.toContain('wysłano');
  });

  it('odrzuca błędny adres odpowiedzi i pustą treść', () => {
    expect(isValidSupportReplyAddress('  ')).toBe(true);
    expect(isValidSupportReplyAddress('ala@example.test')).toBe(true);
    expect(isValidSupportReplyAddress('ala.example.test')).toBe(false);
    expect(isValidSupportReplyAddress('ala@')).toBe(false);
    expect(buildSupportEmailHref({ category: 'problem', email: 'zly-adres', message: 'Problem' })).toBeUndefined();
    expect(buildSupportEmailHref({ category: 'problem', email: '', message: '   ' })).toBeUndefined();
  });
});
