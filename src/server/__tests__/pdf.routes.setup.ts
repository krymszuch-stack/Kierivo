import { vi } from 'vitest';

vi.mock('../extract/atsExtract', () => ({
  runAtsExtract: vi.fn(),
}));