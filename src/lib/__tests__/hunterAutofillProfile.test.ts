import { describe, expect, it } from 'vitest';
import type { MasterVault } from '../../types';
import { buildHunterAutofillProfile } from '../hunterAutofillProfile';

function makeVault(personalInfo: Partial<MasterVault['personalInfo']>): MasterVault {
  return { personalInfo } as MasterVault;
}

describe('buildHunterAutofillProfile', () => {
  it('tworzy schemat akceptowany przez rozszerzenie Hunter', () => {
    expect(buildHunterAutofillProfile(makeVault({
      firstName: '  Ada ',
      lastName: ' Nowak ',
      email: ' ada@example.test ',
      phone: '+48123456789',
      linkedin: 'https://linkedin.example/one',
      title: 'Do not export',
    }))).toEqual({
      schemaVersion: 1,
      fields: {
        'given-name': 'Ada',
        'family-name': 'Nowak',
        email: 'ada@example.test',
        tel: '+48123456789',
      },
    });
  });

  it('nie zgaduje imienia i nazwiska z fullName ani nie eksportuje spornego LinkedIn', () => {
    expect(buildHunterAutofillProfile(makeVault({
      fullName: 'Ada Nowak',
      email: '',
      phone: '  ',
      linkedin: 'https://linkedin.example/disputed',
    }))).toBeNull();
  });

  it('nie tworzy pliku, gdy profil nie zawiera obsługiwanych, niepustych pól', () => {
    expect(buildHunterAutofillProfile(makeVault({}))).toBeNull();
  });
});
