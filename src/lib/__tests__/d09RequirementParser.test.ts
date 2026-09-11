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
});
