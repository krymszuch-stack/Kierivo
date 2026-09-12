import { describe, expect, it } from 'vitest';
import {
  d10CalibrationGate,
  evaluateD10KnockoutCalibration,
  evaluateD10ParserCalibration,
} from '../audit-core/d10/calibration';

describe('D10 calibration gates', () => {
  it('scores a controlled formal-requirement corpus without false CORE_MUST predictions', async () => {
    const report = await evaluateD10ParserCalibration([
      {
        id: 'LANGUAGE_MUST',
        jobDescription: 'Wymagania:\nWymagany język angielski B2',
        expected: [{ canonicalId: 'language.english', kind: 'LANGUAGE', priority: 'MUST' }],
      },
      {
        id: 'LICENSE_CORE',
        jobDescription: 'Wymagania:\nMandatory: uprawnienia SEP G1',
        expected: [{ canonicalId: 'license.sep.g1', kind: 'LICENSE', priority: 'CORE_MUST' }],
      },
      {
        id: 'PREFERRED_CERT_AND_NEUTRAL_SECTION',
        jobDescription: [
          'Mile widziane:',
          'PMP certification',
          'Zakres obowiązków:',
          'Współpraca z osobami posiadającymi AZ-900',
        ].join('\n'),
        expected: [{ canonicalId: 'cert.pmp', kind: 'CERTIFICATION', priority: 'PREFERRED' }],
      },
      {
        id: 'NO_FORMAL',
        jobDescription: 'Zakres obowiązków:\nBudowa API i utrzymanie PostgreSQL.',
        expected: [],
      },
    ]);

    expect(report.precision).toBe(1);
    expect(report.recall).toBe(1);
    expect(report.priorityAccuracy).toBe(1);
    expect(report.kindAccuracy).toBe(1);
    expect(report.coreMustFalsePositives).toBe(0);
    expect(d10CalibrationGate(report)).toEqual([]);
  });

  it('treats any false formal knockout as a failed calibration gate', async () => {
    const parser = await evaluateD10ParserCalibration([
      {
        id: 'BASE',
        jobDescription: 'Wymagania:\nWymagany język angielski B2',
        expected: [{ canonicalId: 'language.english', kind: 'LANGUAGE', priority: 'MUST' }],
      },
    ]);
    const knockout = evaluateD10KnockoutCalibration([
      { id: 'A', shouldKnockout: false, didKnockout: true },
      { id: 'B', shouldKnockout: true, didKnockout: true },
    ]);

    expect(knockout.falseKnockoutRate).toBeGreaterThan(0);
    expect(d10CalibrationGate(parser, knockout).some((error) => error.includes('false knockout rate'))).toBe(true);
  });
});
