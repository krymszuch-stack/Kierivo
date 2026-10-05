import { describe, it, expect } from 'vitest';
import { findSkillBridgeForGap } from '../skillBridgeEngine';
import { createEmptyVault } from '../sampleVault';
import { buildCandidateEvidenceCorpora } from '../candidateEvidence';
import { hasPositiveSkillEvidence } from '../skillEvidence';

/**
 * F12: żaden most bez jawnej definicji i dowodu. `Excel → Kafka 75%`
 * nie wraca.
 */
describe('skillBridge — zakaz fabrykacji', () => {
  it('negacja doświadczenia nie zmienia się w posiadane narzędzie przez tagi punktu', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.history = [{ id: 'negative', company: 'Firma syntetyczna', role: 'Monter', location: '', startDate: '', endDate: '', isCurrent: false,
      highlights: [{ id: 'h1', text: 'Nie używałem RabbitMQ.', tool: 'RabbitMQ', keywords: ['RabbitMQ'], action: '', target: '', metric: '' }],
    }];
    expect(findSkillBridgeForGap('Kafka', v)).toBeUndefined();
    expect(hasPositiveSkillEvidence(buildCandidateEvidenceCorpora(v).skills, 'RabbitMQ')).toBe(false);
  });

  it('opis projektu z negacją nie staje się dowodem przez techStack', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.projects = [{ id: 'p1', name: 'Projekt syntetyczny', role: '', description: 'Nie używałem Docker.', techStack: ['Docker'] }];
    expect(findSkillBridgeForGap('Kubernetes', v)).toBeUndefined();
    expect(hasPositiveSkillEvidence(buildCandidateEvidenceCorpora(v).skills, 'Docker')).toBe(false);
  });

  it('deklaracja nauki w tagu nie potwierdza umiejętności pokrewnej', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.skillsMatrix.hardSkills = ['RabbitMQ — w trakcie nauki'];
    expect(findSkillBridgeForGap('Kafka', v)).toBeUndefined();
  });

  it('negacja docelowej umiejętności nie ukrywa mostu z pozytywnego wpisu pokrewnego', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.skillsMatrix.hardSkills = ['Nie znam Kafka', 'RabbitMQ'];
    expect(findSkillBridgeForGap('Kafka', v)?.adjacentSkill).toBe('RabbitMQ');
  });

  it('pozytywna konkretna umiejętność nie jest ukryta przez negację innego narzędzia z definicji', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.personalInfo.summary = 'Nie znam Siemens. Używałem TIA Portal przy diagnostyce urządzeń.';
    v.skillsMatrix.hardSkills = ['Automatyka'];
    expect(findSkillBridgeForGap('TIA Portal', v)).toBeUndefined();
  });

  it('samo TIA Portal nie potwierdza konkretnej umiejętności Sterowniki Siemens S7', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.skillsMatrix.hardSkills = ['TIA Portal', 'Automatyka'];
    expect(findSkillBridgeForGap('Sterowniki Siemens S7', v)?.adjacentSkill).toBe('Automatyka');
  });

  it('pozytywny opis bez tagu daje powiązanie i właściwe źródło', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.history = [{ id: 'positive', company: 'Zakład syntetyczny', role: 'Spawacz', location: '', startDate: '', endDate: '', isCurrent: false,
      description: 'Wykonywałem Spawanie MIG/MAG elementów konstrukcji.', highlights: [],
    }];
    const bridge = findSkillBridgeForGap('Spawanie TIG', v);
    expect(bridge?.adjacentSkill).toBe('Spawanie MIG/MAG');
    expect(bridge?.evidenceFromVault).toBe('Zakład syntetyczny (Spawacz)');
  });

  it('przy pozytywnej liście umiejętności nie przypisuje dowodu do zanegowanej pracy', () => {
    const v = createEmptyVault('Profil syntetyczny');
    v.skillsMatrix.hardSkills = ['RabbitMQ'];
    v.history = [{ id: 'negative', company: 'Niewłaściwa firma', role: 'Magazynier', location: '', startDate: '', endDate: '', isCurrent: false,
      highlights: [{ id: 'h1', text: 'Nie używałem RabbitMQ.', tool: 'RabbitMQ', keywords: [], action: '', target: '', metric: '' }],
    }];
    expect(findSkillBridgeForGap('Kafka', v)?.evidenceFromVault).toBeUndefined();
  });
  it('Excel nie mostuje do Kafki', () => {
    const v = createEmptyVault('Jan', 'jan@example.com');
    v.skillsMatrix.hardSkills = ['Excel'];
    expect(findSkillBridgeForGap('Kafka', v)).toBeUndefined();
  });

  it('nieznana luka bez definicji to undefined, nie generyk', () => {
    const v = createEmptyVault('Jan', 'jan@example.com');
    v.skillsMatrix.hardSkills = ['Python'];
    expect(findSkillBridgeForGap('Spawanie orbitalne (nieistniejące)', v)).toBeUndefined();
  });

  it('jawny most z dowodem nadal działa (Kafka ← RabbitMQ)', () => {
    const v = createEmptyVault('Jan', 'jan@example.com');
    v.skillsMatrix.hardSkills = ['RabbitMQ'];
    v.history = [{
      id: 'e1', company: 'Cloud Corp', role: 'Backend Developer', location: '',
      startDate: '2021-01', endDate: '2023-01', isCurrent: false,
      highlights: [{
        id: 'h1', text: 'Kolejki RabbitMQ', action: '', target: '',
        tool: 'RabbitMQ', metric: '', keywords: ['RabbitMQ'],
      }],
    }];
    const b = findSkillBridgeForGap('Kafka', v);
    expect(b?.adjacentSkill).toBe('RabbitMQ');
  });
});
