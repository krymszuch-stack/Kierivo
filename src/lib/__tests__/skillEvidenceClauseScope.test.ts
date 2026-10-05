import { describe, expect, it } from 'vitest';
import { countPositiveSkillEvidence, hasPositiveSkillEvidence } from '../skillEvidence';
import { mapJdKeywords } from '../jdKeywordMapper';
import { scoreCanonicalAts } from '../canonicalAts';
import { createEmptyVault } from '../sampleVault';
import { auditKnockouts } from '../knockouts';
import { generateSkillBridges } from '../skillBridgeEngine';

describe('zakres zaprzeczenia i nauki w osobistej deklaracji', () => {
  it.each([
    ['Nie używałem SAP, ale obsługiwałem WMS.', 'WMS'],
    ['Nie znam SAP, lecz znam WMS.', 'WMS'],
    ['Nie znam SAP, obsługuję WMS.', 'WMS'],
    ['Uczę się SAP, natomiast obsługiwałam WMS.', 'WMS'],
    ['I have not used SAP, but I operated WMS.', 'WMS'],
    ['Currently learning Docker, but I use Kubernetes.', 'Kubernetes'],
    ['Nie znam TIG, ale spawam MIG/MAG.', 'MIG/MAG'],
    ['Kolega nie zna SAP, ja obsługuję WMS.', 'WMS'],
  ])('nowa własna czynność nie dziedziczy negacji: %s', (text, skill) => {
    expect(hasPositiveSkillEvidence(text, skill)).toBe(true);
    expect(countPositiveSkillEvidence(text, skill)).toBe(1);
  });

  it.each([
    ['Nie znam SAP ani WMS.', 'WMS'],
    ['Nie znam SAP, WMS i Docker.', 'Docker'],
    ['Nie znam SAP, ale nie znam WMS.', 'WMS'],
    ['Nie znam SAP, ale uczę się WMS.', 'WMS'],
    ['Uczę się SAP i WMS.', 'WMS'],
    ['I have not used SAP or WMS.', 'WMS'],
    ['Nie znam SAP, ale kolega obsługiwał WMS.', 'WMS'],
    ['Nie znam SAP, ale WMS.', 'WMS'],
  ])('lista lub nowy brak nie stają się dowodem: %s', (text, skill) => {
    expect(hasPositiveSkillEvidence(text, skill)).toBe(false);
  });

  it('ATS i mapper zachowują WMS po zaprzeczeniu SAP', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Nie używałem SAP, ale obsługiwałem WMS.';
    const jd = 'Poszukujemy magazyniera.\nWymagania:\n- Znajomość WMS.';
    expect(scoreCanonicalAts(vault, jd).matchedRequirements).toContain('wms');
    const keyword = mapJdKeywords(jd, vault).keywords.find(item => item.term.toLowerCase() === 'wms');
    expect(keyword?.status).toBe('MATCHED_IN_CV');
    expect(keyword?.foundInCvEvidence).toEqual([vault.personalInfo.summary]);
    expect(hasPositiveSkillEvidence(vault.personalInfo.summary, 'SAP')).toBe(false);
  });

  it('uprawnienie montera ma własny zakres zaprzeczenia', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Nie posiadam UDT, ale posiadam SEP G1.';
    const report = auditKnockouts('Wymagania: uprawnienia SEP G1.', vault);
    expect(report.findings.find(finding => finding.ruleId === 'sep_g1')?.satisfied).toBe(true);
    expect(hasPositiveSkillEvidence(vault.personalInfo.summary, 'UDT')).toBe(false);
  });

  it('most spawacza zachowuje własną praktykę po braku TIG', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Nie znam TIG, ale znam Spawanie MIG/MAG.';
    expect(generateSkillBridges(['Spawanie TIG'], vault)[0]?.adjacentSkill).toBe('Spawanie MIG/MAG');
  });
});
