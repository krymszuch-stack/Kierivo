import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAdvisorConversation,
  readAdvisorConversation,
  writeAdvisorConversation,
} from '../../features/advisor/advisorConversationCache';
import { StorageKeys, wipeAppStorage } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage();
});

describe('sesyjny cache rozmowy Doradcy', () => {
  it('odtwarza prawdziwą historię i szkic pola z metadanymi źródła i modelu', () => {
    const messages = [
      {
        id: '1',
        sender: 'user' as const,
        text: 'Moje pytanie',
        timestamp: '10:00',
        source: 'azure_openai' as const,
      },
      {
        id: '2',
        sender: 'ai' as const,
        text: 'Odpowiedź Azure OpenAI',
        timestamp: '10:01',
        source: 'azure_openai' as const,
        model: 'azure-deployment',
      },
    ];
    writeAdvisorConversation('profile-a', messages, 'niedokończone');

    expect(readAdvisorConversation('profile-a')).toMatchObject({ messages, draft: 'niedokończone' });
    expect(readAdvisorConversation('profile-b')).toMatchObject({ messages: [], draft: '' });
  });

  it('odrzuca historię zapisaną przez poprzedniego lokalnego dostawcę', () => {
    sessionStorage.setItem(StorageKeys.advisorConversation, JSON.stringify({
      messages: [{ id: 'old', sender: 'ai', text: 'stara rozmowa', timestamp: '10:00', source: 'ollama' }],
      draft: '',
      savedAt: Date.now(),
    }));

    expect(readAdvisorConversation('profile-a')).toEqual({ messages: [], draft: '', savedAt: 0 });
  });

  it('odrzuca uszkodzony lub niezgodny kształt zamiast fabrykować wiadomości', () => {
    sessionStorage.setItem(StorageKeys.advisorConversation, JSON.stringify({ messages: [{ text: 42 }] }));

    expect(readAdvisorConversation('profile-a')).toEqual({ messages: [], draft: '', savedAt: 0 });
  });

  it('czyści rozmowę jawnie i razem z operacją usuń moje dane', () => {
    const profileKey = `${StorageKeys.advisorConversation}:profile-a`;
    writeAdvisorConversation('profile-a', [], 'pierwszy szkic');
    clearAdvisorConversation('profile-a');
    expect(sessionStorage.getItem(profileKey)).toBeNull();

    writeAdvisorConversation('profile-a', [], 'drugi szkic');
    wipeAppStorage();
    expect(sessionStorage.getItem(profileKey)).toBeNull();
  });
});
