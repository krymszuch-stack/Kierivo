import { describe, it, expect } from 'vitest';
import {
  findSkillBridgeForGap,
  generateSkillBridges,
} from '../skillBridgeEngine';
import { MasterVault } from '../../types';
import { createEmptyVault } from '../sampleVault';

describe('Skill Bridge Matrix Engine (skill-bridge-matrix-v1)', () => {
  const createMockVault = (): MasterVault => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.skillsMatrix = {
      hardSkills: ['RabbitMQ', 'Docker', 'PostgreSQL', 'JavaScript', 'Spawanie MIG/MAG', 'SEP G1'],
      toolsAndTech: ['Redis', 'Git', 'Linux'],
      softSkills: ['Komunikatywność'],
      certifications: [],
    };
    vault.history = [
      {
        id: 'exp_1',
        company: 'Cloud Corp',
        role: 'Senior Backend Developer',
        location: 'Warszawa',
        startDate: '2021-01',
        endDate: '2023-01',
        isCurrent: false,
        highlights: [
          {
            id: 'hl_1',
            text: 'Wdrożenie kolejki RabbitMQ i Redis PubSub.',
            action: 'Wdrożenie',
            target: 'RabbitMQ',
            tool: 'RabbitMQ',
            metric: '+50% throughput',
            keywords: ['RabbitMQ', 'Redis'],
          },
        ],
      },
    ];
    return vault;
  };

  describe('Budowanie Mostów Kompetencyjnych (SkillBridge)', () => {
    it('buduje most dla luki Kafka na bazie posiadanego RabbitMQ i dowodu z Cloud Corp', () => {
      const vault = createMockVault();
      const bridge = findSkillBridgeForGap('Kafka', vault);

      expect(bridge).toBeDefined();
      expect(bridge?.missingSkill).toBe('Kafka');
      expect(bridge?.adjacentSkill).toBe('RabbitMQ');
      expect(bridge?.relatedTopics).toContain('publikowanie i subskrypcja');
      expect(bridge?.talkingPoint).toContain('RabbitMQ');
      expect(bridge?.evidenceFromVault).toBe('Cloud Corp (Senior Backend Developer)');
      expect(bridge).not.toHaveProperty('learningCurveDays');
      expect(bridge).not.toHaveProperty('confidenceScore');
      expect(bridge?.bridgeExplanation).toContain('nie zastępuje');
      expect(bridge?.talkingPoint).not.toMatch(/kwestia paru dni|bezproblemowy transfer|natychmiast projektować/i);
    });

    it('buduje most dla uprawnień branżowych (SEP G2 na bazie SEP G1)', () => {
      const vault = createMockVault();
      const bridge = findSkillBridgeForGap('SEP G2 (Cieplne)', vault);

      expect(bridge).toBeDefined();
      expect(bridge?.adjacentSkill).toBe('SEP G1');
      expect(bridge?.talkingPoint).toContain('SEP G1');
      expect(bridge).not.toHaveProperty('confidenceScore');
      expect(bridge?.talkingPoint).toContain('nie potwierdza SEP G2');
      expect(bridge?.talkingPoint).toContain('formalnych uprawnień');
    });

    it('rozpoznaje SEP G1 wybrane z katalogu uprawnień jako powiązany wpis, ale nie zalicza go jako G2', () => {
      const vault = createMockVault();
      vault.profiler.licenses = ['sep_1kv'];
      vault.skillsMatrix.hardSkills = [];

      const bridge = findSkillBridgeForGap('SEP G2', vault);
      expect(bridge?.adjacentSkill).toContain('SEP G1');
      expect(bridge?.talkingPoint).toContain('nie potwierdza SEP G2');
      expect(bridge?.bridgeExplanation).toContain('nie zastępuje wymaganej kwalifikacji');
    });

    it('buduje most dla spawania TIG na bazie posiadanego spawania MIG/MAG', () => {
      const vault = createMockVault();
      const bridge = findSkillBridgeForGap('Spawanie TIG (141)', vault);

      expect(bridge).toBeDefined();
      expect(bridge?.adjacentSkill).toBe('Spawanie MIG/MAG');
      expect(bridge?.talkingPoint).toContain('Spawanie MIG/MAG');
      expect(bridge?.talkingPoint).toContain('nie potwierdza Spawanie TIG (141)');
    });

    it('nie tworzy mostu dla umiejętności, którą profil już zawiera', () => {
      const vault = createMockVault();
      vault.skillsMatrix.hardSkills.push('Apache Kafka 3');

      expect(findSkillBridgeForGap('Kafka', vault)).toBeUndefined();
    });

    it('generuje zbiorczą listę mostów dla wielu brakujących umiejętności', () => {
      const vault = createMockVault();
      const bridges = generateSkillBridges(['Kafka', 'AWS', 'Kubernetes'], vault);

      expect(bridges.length).toBe(3);
      expect(bridges.some((b) => b.missingSkill === 'Kafka')).toBe(true);
      expect(bridges.some((b) => b.missingSkill === 'AWS')).toBe(true);
      expect(bridges.some((b) => b.missingSkill === 'Kubernetes')).toBe(true);
    });
  });
});
