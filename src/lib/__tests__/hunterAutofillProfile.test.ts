import { describe, expect, it } from 'vitest';
import type { MasterVault } from '../../types';
import { buildHunterAutofillProfile } from '../hunterAutofillProfile';

function makeVault(personalInfo: Partial<MasterVault['personalInfo']>): MasterVault {
  return { personalInfo } as MasterVault;
}

describe('buildHunterAutofillProfile', () => {
  it('creates the schema already accepted by the Hunter extension', () => {
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

  it('does not guess a name from fullName or export a disputed LinkedIn value', () => {
    expect(buildHunterAutofillProfile(makeVault({
      fullName: 'Ada Nowak',
      email: '',
      phone: '  ',
      linkedin: 'https://linkedin.example/disputed',
    }))).toBeNull();
  });

  it('returns no file when the profile has no supported non-empty fields', () => {
    expect(buildHunterAutofillProfile(makeVault({}))).toBeNull();
  });
});
