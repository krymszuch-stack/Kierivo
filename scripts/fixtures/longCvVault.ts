import { createEmptyVault } from '../../src/lib/sampleVault';

export function createLongCvVault() {
  const vault = createEmptyVault('Profil testowy', 'synthetic@example.invalid');
  vault.personalInfo = {
    ...vault.personalInfo,
    fullName: 'Profil testowy',
    title: 'Technik utrzymania ruchu',
    summary: 'Syntetyczny opis doświadczenia. '.repeat(18),
    location: 'Miasto testowe',
  };
  vault.skillsMatrix = {
    hardSkills: Array.from({ length: 12 }, (_, index) => `Syntetyczna umiejętność ${index + 1}`),
    toolsAndTech: ['Narzędzie testowe A', 'Narzędzie testowe B'],
    softSkills: ['Dokładność', 'Współpraca'],
    certifications: [],
  };
  vault.history = Array.from({ length: 7 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `synthetic-long-exp-${number}`,
      company: `Syntetyczny zakład ${number}`,
      role: `Testowa rola ${number}`,
      location: 'Miasto testowe',
      startDate: `${2012 + index}-01`,
      endDate: `${2012 + index}-12`,
      isCurrent: false,
      description: `Opis testowego stanowiska ${number}. ${'Syntetyczna treść obowiązków. '.repeat(8)}`,
      highlights: Array.from({ length: 3 }, (_, highlightIndex) => ({
        id: `synthetic-long-highlight-${number}-${highlightIndex + 1}`,
        text: `CVLONG_SENTINEL_${number}_${highlightIndex + 1} ${'Syntetyczny punkt doświadczenia służący do sprawdzenia łamania i kolejności treści w dokumencie. '.repeat(3)}`,
        action: '', target: '', tool: '', metric: '', keywords: [],
      })),
    };
  });
  vault.projects = Array.from({ length: 3 }, (_, index) => ({
    id: `synthetic-long-project-${index + 1}`,
    name: `Testowy projekt ${index + 1}`,
    role: 'uczestnik testu',
    description: `${'Syntetyczny opis projektu do weryfikacji pełnego eksportu. '.repeat(6)} PROJLONG_SENTINEL_${index + 1}`,
    techStack: ['Narzędzie testowe A'],
    metrics: '',
    link: '',
  }));
  return vault;
}
