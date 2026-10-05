import { describe, expect, it } from 'vitest';
import { countPositiveSkillEvidence, hasPositiveSkillEvidence } from '../skillEvidence';
import { scoreCanonicalAts } from '../canonicalAts';
import { mapJdKeywords } from '../jdKeywordMapper';
import { createEmptyVault } from '../sampleVault';
import { auditKnockouts } from '../knockouts';
import { generateSkillBridges } from '../skillBridgeEngine';

describe('osoba będąca źródłem deklaracji umiejętności', () => {
  it.each([
    ['Mój kolega obsługiwał WMS.', 'WMS'],
    ['Nasz zespół używał Python.', 'Python'],
    ['Dostawca konfigurował Docker.', 'Docker'],
    ['Kolega posiada SEP G1.', 'SEP G1'],
    ['My colleague used RabbitMQ.', 'RabbitMQ'],
    ['Our team operated WMS.', 'WMS'],
    ['Kolega obsługiwał SAP i WMS.', 'WMS'],
    ['Nasz zespół używał Python i Docker.', 'Docker'],
    ['WMS obsługiwał mój kolega.', 'WMS'],
    ['WMS obsługiwała koleżanka.', 'WMS'],
    ['Docker konfigurował dostawca.', 'Docker'],
    ['SEP G1 posiada mój kolega.', 'SEP G1'],
    ['RabbitMQ was operated by my colleague.', 'RabbitMQ'],
    ['Docker was configured by the vendor.', 'Docker'],
    ['Koledzy obsługiwali WMS.', 'WMS'],
    ['WMS obsługiwali koledzy.', 'WMS'],
    ['Kolega obsługuje WMS.', 'WMS'],
    ['Kolega używa WMS.', 'WMS'],
    ['Spawanie MIG/MAG wykonywał kolega.', 'Spawanie MIG/MAG'],
  ])('cudza czynność nie jest osobistym dowodem: %s', (text, skill) => {
    expect(hasPositiveSkillEvidence(text, skill)).toBe(false);
    expect(countPositiveSkillEvidence(text, skill)).toBe(0);
  });

  it.each([
    ['Wraz z zespołem obsługiwałem WMS.', 'WMS'],
    ['Kolega obsługiwał WMS, a ja używałem SAP.', 'SAP'],
    ['I used RabbitMQ with my colleague.', 'RabbitMQ'],
    ['Our team used Python; I implemented services in Docker.', 'Docker'],
    ['Nasz zespół używał Python, ja wdrożyłem Docker.', 'Docker'],
    ['My colleague used RabbitMQ, but I configured RabbitMQ myself.', 'RabbitMQ'],
    ['WMS obsługiwałem z kolegą.', 'WMS'],
    ['Docker konfigurowałam wraz z zespołem.', 'Docker'],
    ['I operated RabbitMQ with my colleague.', 'RabbitMQ'],
    ['WMS obsługiwał kolega, a ja używałem SAP.', 'SAP'],
    ['Obsługuję WMS wraz z kolegą.', 'WMS'],
  ])('własna deklaracja pozostaje dowodem: %s', (text, skill) => {
    expect(hasPositiveSkillEvidence(text, skill)).toBe(true);
  });

  const jd = 'Poszukujemy magazyniera.\nWymagania:\n- Znajomość systemu WMS.';
  it.each(['Mój kolega obsługiwał WMS.', 'Nie używałem WMS.', 'WMS obsługiwał mój kolega.'])('ATS i mapper nie zaliczają samego tagu przy opisie: %s', text => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Kompletowałem zamówienia i przyjmowałem dostawy w magazynie.';
    vault.history = [{ id: 'h', company: 'Magazyn syntetyczny', role: 'Magazynier', startDate: '', endDate: '', isCurrent: false, location: '',
      highlights: [{ id: 'p', text, tool: 'WMS', keywords: ['WMS'], action: '', target: '', metric: '' }],
    }];
    expect(scoreCanonicalAts(vault, jd).matchedRequirements).not.toContain('wms');
    const mapping = mapJdKeywords(jd, vault);
    expect(mapping.keywords.find(keyword => keyword.term.toLowerCase() === 'wms')?.status).toBe('MISSING_IN_VAULT');
  });

  it('mapper nie zalicza zanegowanego projektu i tekstu w CV', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Nie używałem WMS. Kompletowałem zamówienia ręcznie.';
    vault.projects = [{ id: 'p', name: 'Projekt', role: '', description: 'Nie używałem WMS.', techStack: ['WMS'] }];
    expect(mapJdKeywords(jd, vault).keywords.find(keyword => keyword.term.toLowerCase() === 'wms')?.status).toBe('MISSING_IN_VAULT');
  });

  it('wybiera osobiste źródło zamiast wcześniejszego opisu kolegi', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Kolega obsługiwał WMS. Obsługiwałem WMS przy kompletacji.';
    const keyword = mapJdKeywords(jd, vault).keywords.find(item => item.term.toLowerCase() === 'wms');
    expect(keyword?.status).toBe('MATCHED_IN_CV');
    expect(keyword?.foundInCvEvidence).toEqual(['Obsługiwałem WMS przy kompletacji.']);
    expect(countPositiveSkillEvidence(vault.personalInfo.summary, 'WMS')).toBe(1);
  });

  it('zachowuje oddzielną osobistą deklarację w macierzy umiejętności', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Kolega obsługiwał WMS.';
    vault.skillsMatrix.toolsAndTech = ['WMS'];
    expect(scoreCanonicalAts(vault, jd).matchedRequirements).toContain('wms');
    expect(mapJdKeywords(jd, vault).keywords.find(item => item.term.toLowerCase() === 'wms')?.status).toBe('IN_VAULT_NOT_IN_CV');
  });

  it('zlicza tylko późniejsze osobiste wystąpienie tej samej umiejętności', () => {
    const text = 'WMS obsługiwał kolega, a ja używałem WMS.';
    expect(hasPositiveSkillEvidence(text, 'WMS')).toBe(true);
    expect(countPositiveSkillEvidence(text, 'WMS')).toBe(1);
  });

  it('uprawnienia kolegi po nazwie SEP nie spełniają wymogu montera', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'SEP G1 posiada mój kolega.';
    expect(auditKnockouts('Wymagania: uprawnienia SEP G1.', vault).findings.find(finding => finding.ruleId === 'sep_g1')?.satisfied).toBe(false);
  });

  it('praca innego spawacza nie tworzy osobistego mostu do TIG', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Spawanie MIG/MAG wykonywał kolega.';
    expect(generateSkillBridges(['Spawanie TIG'], vault)).toEqual([]);
  });
});
