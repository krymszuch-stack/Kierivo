import { describe, expect, it } from 'vitest';
import { mergeMigrationRecords } from '../mergeMigrationRecords';

describe('Łączenie rekordów migracji', () => {
  it('pomija identyczne kopie niezależnie od kolejności pól', () => {
    const target = { id: 'a', notes: { first: 1, second: 2 } };
    const source = { notes: { second: 2, first: 1 }, id: 'a' };
    expect(mergeMigrationRecords([target], [source, { id: 'b' }])).toEqual([target, { id: 'b' }]);
  });
  it('odrzuca różne wersje także wewnątrz jednej listy', () => {
    expect(mergeMigrationRecords([], [{ id: 'a', notes: 'pierwsza' }, { id: 'a', notes: 'druga' }])).toBeNull();
    expect(mergeMigrationRecords([{ id: 'a', notes: 'pierwsza' }, { id: 'a', notes: 'druga' }], [])).toBeNull();
  });
  it('zachowuje surowe rekordy bez ID do odzyskania', () => {
    expect(mergeMigrationRecords<unknown>([null], [null, 42, { title: 'starszy wpis' }])).toEqual([null, null, 42, { title: 'starszy wpis' }]);
  });
});
