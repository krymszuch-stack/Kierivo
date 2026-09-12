import { StorageKeys, readSessionJson, removeSession, writeSessionJson } from '../../lib/storage';

export interface AdvisorChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  source?: 'rules' | 'ollama';
  model?: string;
}

export interface AdvisorConversationCache {
  messages: AdvisorChatMessage[];
  draft: string;
  savedAt: number;
}

const MAX_MESSAGES = 60;
const MAX_TEXT_LENGTH = 8_000;
const EMPTY_CACHE: AdvisorConversationCache = { messages: [], draft: '', savedAt: 0 };

function isMessage(value: unknown): value is AdvisorChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AdvisorChatMessage>;
  return (
    typeof message.id === 'string' &&
    (message.sender === 'ai' || message.sender === 'user') &&
    typeof message.text === 'string' &&
    message.text.length <= MAX_TEXT_LENGTH &&
    typeof message.timestamp === 'string' &&
    (message.source === undefined || message.source === 'rules' || message.source === 'ollama') &&
    (message.model === undefined || typeof message.model === 'string')
  );
}

export function readAdvisorConversation(): AdvisorConversationCache {
  const value = readSessionJson<unknown>(StorageKeys.advisorConversation, EMPTY_CACHE);
  if (!value || typeof value !== 'object') return EMPTY_CACHE;
  const cache = value as Partial<AdvisorConversationCache>;
  if (!Array.isArray(cache.messages) || !cache.messages.every(isMessage)) return EMPTY_CACHE;
  if (typeof cache.draft !== 'string' || cache.draft.length > MAX_TEXT_LENGTH) return EMPTY_CACHE;
  if (typeof cache.savedAt !== 'number' || !Number.isFinite(cache.savedAt)) return EMPTY_CACHE;
  return { messages: cache.messages.slice(-MAX_MESSAGES), draft: cache.draft, savedAt: cache.savedAt };
}

export function writeAdvisorConversation(messages: AdvisorChatMessage[], draft: string): void {
  writeSessionJson(StorageKeys.advisorConversation, {
    messages: messages.slice(-MAX_MESSAGES),
    draft: draft.slice(0, MAX_TEXT_LENGTH),
    savedAt: Date.now(),
  } satisfies AdvisorConversationCache);
}

export function clearAdvisorConversation(): void {
  removeSession(StorageKeys.advisorConversation);
}