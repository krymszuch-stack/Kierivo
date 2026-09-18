import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerConfetti } from '../confetti';

describe('triggerConfetti - obsługa prefers-reduced-motion', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('nie wykonuje żadnych akcji i nie tworzy canvasu, gdy prefers-reduced-motion: reduce jest aktywne', () => {
    const appendChildSpy = vi.fn();
    const createElementSpy = vi.fn();

    globalThis.window = {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    } as unknown as Window & typeof globalThis;

    globalThis.document = {
      createElement: createElementSpy,
      body: {
        appendChild: appendChildSpy,
        removeChild: vi.fn(),
        contains: vi.fn(),
      },
    } as unknown as Document;

    triggerConfetti();

    expect(createElementSpy).not.toHaveBeenCalled();
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  it('tworzy element canvas i uruchamia animację, gdy prefers-reduced-motion nie jest aktywne', () => {
    const appendChildSpy = vi.fn();
    const mockCanvas = {
      style: {},
      getContext: vi.fn().mockReturnValue({
        clearRect: vi.fn(),
        save: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillRect: vi.fn(),
        restore: vi.fn(),
      }),
      width: 0,
      height: 0,
    };

    globalThis.window = {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
      }),
      requestAnimationFrame: vi.fn(),
    } as unknown as Window & typeof globalThis;

    globalThis.document = {
      createElement: vi.fn().mockReturnValue(mockCanvas),
      body: {
        appendChild: appendChildSpy,
        removeChild: vi.fn(),
        contains: vi.fn(),
      },
    } as unknown as Document;

    triggerConfetti({ count: 10 });

    expect(globalThis.document.createElement).toHaveBeenCalledWith('canvas');
    expect(appendChildSpy).toHaveBeenCalledWith(mockCanvas);
    expect(globalThis.window.requestAnimationFrame).toHaveBeenCalled();
  });
});
