import { describe, expect, it } from 'vitest';
import { createAdvisorRequestGuard } from '../advisorRequestGuard';

describe('Izolacja żądań Doradcy', () => {
  it('blokuje drugi start do zakończenia bieżącego żądania', () => {
    const guard = createAdvisorRequestGuard();
    const first = guard.begin()!;
    expect(guard.begin()).toBeNull();
    expect(guard.isCurrent(first)).toBe(true);
    expect(guard.finish(first)).toBe(true);
    expect(guard.isBusy()).toBe(false);
    expect(guard.begin()).not.toBeNull();
  });
  it('odrzuca odpowiedź po unieważnieniu, także po powrocie do tego samego profilu', () => {
    const guard = createAdvisorRequestGuard();
    const first = guard.begin()!;
    guard.invalidate();
    guard.invalidate();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.finish(first)).toBe(false);
  });
  it('stare finally nie zwalnia blokady nowego żądania', () => {
    const guard = createAdvisorRequestGuard();
    const old = guard.begin()!;
    guard.invalidate();
    const current = guard.begin()!;
    expect(guard.finish(old)).toBe(false);
    expect(guard.isBusy()).toBe(true);
    expect(guard.isCurrent(current)).toBe(true);
    expect(guard.finish(current)).toBe(true);
  });
});
