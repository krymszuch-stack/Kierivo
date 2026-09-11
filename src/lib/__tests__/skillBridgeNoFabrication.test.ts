import { describe, it, expect } from 'vitest';
import { findSkillBridgeForGap } from '../skillBridgeEngine';
import { createEmptyVault } from '../sampleVault';

/**
 * F12: żaden most bez jawnej definicji i dowodu. `Excel → Kafka 75%`
 * nie wraca.
 */
describe('skillBridge — zakaz fabrykacji', () => {
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
