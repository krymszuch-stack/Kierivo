import { describe, expect, it } from 'vitest';
import { buildCandidateEvidenceCorpora, buildCandidateSkillEvidenceEntries } from '../candidateEvidence';
import { hasPositiveSkillEvidence } from '../skillEvidence';
import { createEmptyVault } from '../sampleVault';

describe('kontekst adnotacji w korpusie kandydata', () => {
  it.each(['Nie używałem RabbitMQ.', 'Uczę się RabbitMQ.', 'Oferta wymaga RabbitMQ.'])('tag nie usuwa ograniczenia opisu: %s', text => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.history = [{ id: 'h', company: 'Firma', role: '', location: '', startDate: '', endDate: '', isCurrent: false,
      highlights: [{ id: 'p', text, tool: 'RabbitMQ', keywords: ['RabbitMQ'], action: '', target: '', metric: '' }],
    }];
    expect(hasPositiveSkillEvidence(buildCandidateEvidenceCorpora(vault).skills, 'RabbitMQ')).toBe(false);
  });

  it('oddzielny pozytywny wpis nadal potwierdza umiejętność', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.personalInfo.summary = 'Nie używałem RabbitMQ w poprzedniej pracy.';
    vault.projects = [{ id: 'p', name: 'Projekt praktyczny', role: 'Autor', description: 'Wdrożyłem RabbitMQ w projekcie własnym.', techStack: ['RabbitMQ'] }];
    expect(hasPositiveSkillEvidence(buildCandidateEvidenceCorpora(vault).skills, 'RabbitMQ')).toBe(true);
    expect(buildCandidateSkillEvidenceEntries(vault).find(entry => entry.sourceLabel)?.sourceLabel).toBe('Projekt praktyczny (Autor)');
  });

  it('jawny tag narzędzia pozostaje dowodem, gdy opis nie zaprzecza tej pozycji', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.projects = [{ id: 'p', name: 'Projekt', role: '', description: 'System asynchronicznych wiadomości.', techStack: ['RabbitMQ'] }];
    expect(hasPositiveSkillEvidence(buildCandidateEvidenceCorpora(vault).skills, 'RabbitMQ')).toBe(true);
  });

  it('nazwy firmy, roli i projektu nie stają się umiejętnościami', () => {
    const vault = createEmptyVault('Profil syntetyczny');
    vault.projects = [{ id: 'p', name: 'RabbitMQ', role: 'Docker', description: 'Przyjmowanie dostaw.', techStack: [] }];
    const corpus = buildCandidateEvidenceCorpora(vault).skills;
    expect(hasPositiveSkillEvidence(corpus, 'RabbitMQ')).toBe(false);
    expect(hasPositiveSkillEvidence(corpus, 'Docker')).toBe(false);
  });

  it.each(['RabbitMQ — w trakcie nauki', 'RabbitMQ: no experience with', 'RabbitMQ3 — currently learning'])('dopisek ogranicza dowód: %s', text => {
    expect(hasPositiveSkillEvidence(text, 'RabbitMQ')).toBe(false);
  });

  it('ograniczenie kolejnego wpisu nie neguje poprzedniej umiejętności', () => {
    expect(hasPositiveSkillEvidence('RabbitMQ\nW trakcie nauki Docker.', 'RabbitMQ')).toBe(true);
    expect(hasPositiveSkillEvidence('RabbitMQ. Uczę się Docker.', 'RabbitMQ')).toBe(true);
    expect(hasPositiveSkillEvidence('RabbitMQ, Docker — w trakcie nauki', 'RabbitMQ')).toBe(true);
    expect(hasPositiveSkillEvidence('RabbitMQ, nie znam Docker', 'RabbitMQ')).toBe(true);
  });
});
