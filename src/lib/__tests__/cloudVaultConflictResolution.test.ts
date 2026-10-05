import { describe, expect, it, vi } from 'vitest';
import { applyCloudConflictResultForCurrentOwner } from '../cloudVaultConflictResolution';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('wynik asynchronicznego rozstrzygnięcia konfliktu chmury', () => {
  it('nie stosuje wyboru starego konta, gdy zmienia się ono podczas zapisu', async () => {
    const operation = deferred<'cloud'>();
    let currentOwnerId: string | null = 'konto-a';
    const apply = vi.fn();

    const pending = applyCloudConflictResultForCurrentOwner(
      'konto-a',
      () => currentOwnerId,
      () => operation.promise,
      apply,
    );
    currentOwnerId = 'konto-b';
    operation.resolve('cloud');

    await expect(pending).resolves.toEqual({ applied: false });
    expect(apply).not.toHaveBeenCalled();
  });

  it('stosuje wybór tylko do konta, które nadal jest aktywne', async () => {
    const apply = vi.fn();
    const resolution = await applyCloudConflictResultForCurrentOwner(
      'konto-a',
      () => 'konto-a',
      async () => 'cloud' as const,
      apply,
    );

    expect(resolution).toEqual({ applied: true, result: 'cloud' });
    expect(apply).toHaveBeenCalledOnce();
  });
});
