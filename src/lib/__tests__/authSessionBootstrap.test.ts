import { describe, expect, it } from 'vitest';
import { createAuthSessionBootstrapGuard } from '../authSessionBootstrap';

describe('bootstrap sesji chmurowej', () => {
  it('odrzuca początkowy snapshot, jeśli listener wcześniej zgłosił nowe zdarzenie auth', () => {
    const guard = createAuthSessionBootstrapGuard();
    const snapshotRevision = guard.begin();

    guard.noteAuthEvent();

    expect(guard.canApply(snapshotRevision)).toBe(false);
  });

  it('pozwala zastosować snapshot, gdy przed nim nie wystąpiło zdarzenie auth', () => {
    const guard = createAuthSessionBootstrapGuard();
    const snapshotRevision = guard.begin();

    expect(guard.canApply(snapshotRevision)).toBe(true);
  });

  it('nie przywraca snapshotu po kilku zdarzeniach listenera', () => {
    const guard = createAuthSessionBootstrapGuard();
    const snapshotRevision = guard.begin();

    guard.noteAuthEvent();
    guard.noteAuthEvent();

    expect(guard.canApply(snapshotRevision)).toBe(false);
  });
});
