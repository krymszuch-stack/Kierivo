import { describe, expect, it } from 'vitest';
import { isPlausibleEmailAddress } from '../emailAddress';

describe('typowy adres kontaktowy', () => {
  it.each(['jan@example.com', ' anna.nowak+cv@przykład.pl '])('akceptuje %s', (email) => {
    expect(isPlausibleEmailAddress(email)).toBe(true);
  });

  it.each([
    '', 'jan@', '@example.com', 'jan@@example.com', 'jan@.example.com',
    'jan@example..com', 'jan@-example.com', 'jan@example-.com',
    'jan kowalski@example.com',
  ])('odrzuca %s', (email) => {
    expect(isPlausibleEmailAddress(email)).toBe(false);
  });
});
