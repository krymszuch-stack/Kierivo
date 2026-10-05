import { describe, expect, it } from 'vitest';
import { extractD09Requirements } from '../audit-core/d09/requirementParser';

function byId(items: Awaited<ReturnType<typeof extractD09Requirements>>['requirements'], id: string) {
  return items.find((item) => item.canonicalId === id);
}

describe('D09 requirement parser', () => {
  it('rozróżnia sekcje MUST i NICE bez liczenia częstotliwości jako krytyczności', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Java
- PostgreSQL
- Kubernetes

Mile widziane:
- AWS
- Terraform
`);

    expect(byId(result.requirements, 'java')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'postgresql')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'kubernetes')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'aws')?.priority).toBe('NICE');
    expect(byId(result.requirements, 'terraform')?.priority).toBe('NICE');
  });

  it('jawny marker warunku koniecznego tworzy CORE_MUST', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Warunek konieczny: Java
- PostgreSQL
`);
    expect(byId(result.requirements, 'java')?.priority).toBe('CORE_MUST');
    expect(byId(result.requirements, 'postgresql')?.priority).toBe('MUST');
  });

  it('kanonizuje alias k8s do Kubernetes', async () => {
    const result = await extractD09Requirements(`
Requirements:
- k8s
`);
    expect(byId(result.requirements, 'kubernetes')).toBeDefined();
  });

  it('poprawnie obsługuje specjalne tokeny C++, C# i .NET', async () => {
    const result = await extractD09Requirements(`
Requirements:
- C++
- C#
- .NET
`);
    expect(byId(result.requirements, 'cpp')).toBeDefined();
    expect(byId(result.requirements, 'csharp')).toBeDefined();
    expect(byId(result.requirements, 'dotnet')).toBeDefined();
  });

  it('formalną licencję rozpoznaje, ale oznacza do delegacji D10', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Prawo jazdy kat. C
- Java
`);
    expect(byId(result.requirements, 'license-driving-c')?.kind).toBe('FORMAL_REFERENCE');
  });

  it('nie traktuje zaprzeczonego kryterium jako MUST, nawet gdy zaprzeczenie stoi po nazwie', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Prawo jazdy kat. B nie jest wymagane.
- Angielski nie jest wymagany.
- Nie wymagamy znajomości Java.
`);

    expect(byId(result.requirements, 'license-driving-b')).toBeUndefined();
    expect(byId(result.requirements, 'language-english')).toBeUndefined();
    expect(byId(result.requirements, 'java')).toBeUndefined();
  });

  it('nie uznaje „no requirement”, „not necessary” ani „not needed” za MUST', async () => {
    const result = await extractD09Requirements(`
Requirements:
- No requirement for PowerShell.
- AWS is not necessary.
- JavaScript is not needed.
- Python is required.
`);

    expect(byId(result.requirements, 'powershell')).toBeUndefined();
    expect(byId(result.requirements, 'aws')).toBeUndefined();
    expect(byId(result.requirements, 'javascript')).toBeUndefined();
    expect(byId(result.requirements, 'python')?.priority).toBeDefined();
  });

  it('zachowuje osobne pozytywne wystąpienie tego samego kryterium', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Prawo jazdy kat. B nie jest wymagane.
- Do wyjazdów serwisowych wymagane prawo jazdy kat. B.
`);

    expect(byId(result.requirements, 'license-driving-b')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'license-driving-b')?.sourceText).toContain('wymagane prawo jazdy');
  });

  it('resetuje kontekst MUST po wejściu w Zakres obowiązków', async () => {
    const result = await extractD09Requirements(`
Wymagania:
- Java
- PostgreSQL

Zakres obowiązków:
- Utrzymanie infrastruktury AWS i Terraform
`);

    expect(byId(result.requirements, 'java')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'postgresql')?.priority).toBe('MUST');
    expect(byId(result.requirements, 'aws')).toBeUndefined();
    expect(byId(result.requirements, 'terraform')).toBeUndefined();
  });
});
