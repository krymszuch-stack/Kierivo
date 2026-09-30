import { describe, expect, it, vi } from 'vitest';
import { mountAfterStorageRestore } from '../storageBootstrap';

describe('start aplikacji po odtworzeniu IndexedDB', () => {
  it('nie uruchamia migracji ani pierwszego renderu, dopóki kopia danych się nie odtworzy', async () => {
    let finishRestore!: () => void;
    const storageRestore = new Promise<void>((resolve) => {
      finishRestore = resolve;
    });
    const order: string[] = [];
    const prepare = vi.fn(() => order.push('migracje'));
    const mount = vi.fn(() => order.push('render'));

    const startup = mountAfterStorageRestore(storageRestore, prepare, mount);
    await Promise.resolve();

    expect(prepare).not.toHaveBeenCalled();
    expect(mount).not.toHaveBeenCalled();

    finishRestore();
    await startup;

    expect(order).toEqual(['migracje', 'render']);
  });
});
