import { describe, expect, it } from 'vitest';
import { buildEvidenceId } from '../audit-core/hash';

describe('Audit Core Evidence IDs', () => {
  it('identyczny payload z inną kolejnością kluczy daje ten sam identyfikator', async () => {
    const a = await buildEvidenceId(
      'D08.v2',
      'CV',
      'pdf.layout',
      { clippingRatio: 0.1, nested: { b: 2, a: 1 } },
      'DERIVED_DETERMINISTIC',
    );
    const b = await buildEvidenceId(
      'D08.v2',
      'CV',
      'pdf.layout',
      { nested: { a: 1, b: 2 }, clippingRatio: 0.1 },
      'DERIVED_DETERMINISTIC',
    );

    expect(a).toBe(b);
    expect(a).toMatch(/^EV_[0-9a-f]{20}$/);
  });

  it('zmiana payloadu zmienia Evidence ID', async () => {
    const base = await buildEvidenceId(
      'D08.v2',
      'CV',
      'pdf.layout',
      { clippingRatio: 0.1 },
      'DERIVED_DETERMINISTIC',
    );
    const changed = await buildEvidenceId(
      'D08.v2',
      'CV',
      'pdf.layout',
      { clippingRatio: 0.2 },
      'DERIVED_DETERMINISTIC',
    );

    expect(changed).not.toBe(base);
  });
});
