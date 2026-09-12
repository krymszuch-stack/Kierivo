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
      },
      {
        id: '2',
        sender: 'ai' as const,
        text: 'Odpowiedź asysty Ollama',
        timestamp: '10:01',
        source: 'ollama' as const,
        model: 'qwen-chat:latest',
      },
    ];
    writeAdvisorConversation(messages, 'niedokończone');

    expect(readAdvisorConversation()).toMatchObject({ messages, draft: 'niedokończone' });
  });

  it('odrzuca uszkodzony lub niezgodny kształt zamiast fabrykować wiadomości', () => {
    sessionStorage.setItem(StorageKeys.advisorConversation, JSON.stringify({ messages: [{ text: 42 }] }));

    expect(readAdvisorConversation()).toEqual({ messages: [], draft: '', savedAt: 0 });
  });

  it('czyści rozmowę jawnie i razem z operacją usuń moje dane', () => {
    writeAdvisorConversation([], 'pierwszy szkic');
    clearAdvisorConversation();
    expect(sessionStorage.getItem(StorageKeys.advisorConversation)).toBeNull();

    writeAdvisorConversation([], 'drugi szkic');
    wipeAppStorage();
    expect(sessionStorage.getItem(StorageKeys.advisorConversation)).toBeNull();
  });
});