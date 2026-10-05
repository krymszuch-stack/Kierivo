import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.unmock('../extract/atsExtract');
vi.mock('child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('child_process')>(),
  spawn: mockSpawn,
}));

import { runAtsExtract } from '../extract/atsExtract';

function queuePythonOutput(output: unknown): void {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.kill = vi.fn();
  mockSpawn.mockReturnValueOnce(process);
  queueMicrotask(() => {
    process.stdout.emit('data', JSON.stringify(output));
    process.emit('close', 0);
  });
}

describe('ekstrakcja metadanych z PDF', () => {
  afterEach(() => {
    delete process.env.PYTHON_BIN;
    vi.clearAllMocks();
  });

  it('zachowuje jawny wynik false jako wykonany pomiar', async () => {
    process.env.PYTHON_BIN = 'python-test';
    queuePythonOutput({ rawText: 'CV', hasActualText: false, hasInvisibleText: false });

    await expect(runAtsExtract('synthetic.pdf')).resolves.toEqual({
      rawText: 'CV',
      hasActualText: false,
      hasInvisibleText: false,
    });
  });

  it('brakujące albo nieboolowskie metadane pozostawia jako nieznane', async () => {
    process.env.PYTHON_BIN = 'python-test';
    queuePythonOutput({ rawText: 'CV', hasActualText: 'false' });

    await expect(runAtsExtract('synthetic.pdf')).resolves.toEqual({
      rawText: 'CV',
      hasActualText: null,
      hasInvisibleText: null,
    });
  });
});
