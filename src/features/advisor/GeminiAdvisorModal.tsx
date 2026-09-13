import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, User, RotateCcw, RefreshCw, ArrowUpRight, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/apiClient';
import { StorageKeys, readRaw, writeRaw } from '../../lib/storage';
import { trackProductInsight } from '../../lib/productInsights';
import { getRuleBasedReply } from './advisorRules';
import type { AdvisorContext } from './advisorContext';
import type { NavTabId } from '../../lib/navigation';

import type { MasterVault } from '../../types';
import {
  clearAdvisorConversation,
  readAdvisorConversation,
  writeAdvisorConversation,
  type AdvisorChatMessage,
} from './advisorConversationCache';

export interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: string;
  /**
   * Profil jest używany lokalnie do wykrywania braków; nie wysyłamy go do
   * modelu. Do Ollamy może trafić wyłącznie zredukowany kontekst analizy.
   */
  vault?: MasterVault;
  advisorContext?: AdvisorContext | null;
  onNavigate?: (target: NavTabId) => void;
}

interface OllamaHealthResponse {
  success: boolean;
  provider?: string;
  connected?: boolean;
  models?: Array<{ name: string; size?: number }>;
  activeModel?: string;
  error?: string;
}

interface AdvisorChatResponse {
  success: boolean;
  reply: string;
  provider: string;
  model: string;
}

const QUICK_PROMPTS = [
  'Jak przygotować CV czytelne dla parserów rekrutacyjnych?',
  'Jak opisać realne osiągnięcia bez wymyślania liczb?',
  'Jak pokazać zmianę branży lub lukę w doświadczeniu?',
  'Czy dodawać zdjęcie do CV?',
  'Jak napisać krótką wiadomość do rekrutera?',
];

function createWelcomeMessage(): AdvisorChatMessage {
  return {
    id: 'm-init',
    sender: 'ai',
    text: 'Jestem lokalnym Doradcą regułowym CVelocity. Czytam lokalnie aktualny Master Vault oraz ostatni wynik dopasowania, aby wskazać konkretne luki. Jeśli lokalna Ollama jest dostępna, dostaje wyłącznie zredukowany kontekst analizy — bez danych kontaktowych i pełnej treści CV. Bez niej podaję tylko konkretne wbudowane reguły, nie udaję AI.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    source: 'rules',
  };
}

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  initialQuestion,
  advisorContext,
  onNavigate,
}) => {
  const [initialCache] = useState(readAdvisorConversation);
  const [messages, setMessages] = useState<AdvisorChatMessage[]>(() => {
    const cached = initialCache.messages;
    return cached.length > 0 ? cached : [createWelcomeMessage()];
  });

  const [inputVal, setInputVal] = useState(() => initialCache.draft);
  const [isTyping, setIsTyping] = useState(false);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);

  const [ollamaStatus, setOllamaStatus] = useState<{
    checked: boolean;
    connected: boolean;
    models: Array<{ name: string }>;
    activeModel: string;
    error?: string;
  }>({
    checked: false,
    connected: false,
    models: [],
    activeModel: '',
  });

  const [ollamaEnabled, setOllamaEnabled] = useState<boolean>(() => {
    const saved = readRaw(StorageKeys.advisorOllamaEnabled);
    return saved !== 'false';
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return readRaw(StorageKeys.advisorOllamaModel) || '';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledInitialQuestionRef = useRef<string | undefined>(undefined);

  const checkOllama = useCallback(async () => {
    setIsCheckingOllama(true);
    try {
      const res = await api.get<OllamaHealthResponse>('/ai/ollama/health');
      if (res && res.success) {
        setOllamaStatus({
          checked: true,
          connected: Boolean(res.connected),
          models: res.models || [],
          activeModel: res.activeModel || '',
          error: res.error,
        });
        if (!selectedModel && res.activeModel) {
          setSelectedModel(res.activeModel);
        }
      }
    } catch (err: unknown) {
      setOllamaStatus({
        checked: true,
        connected: false,
        models: [],
        activeModel: '',
        error: err instanceof Error ? err.message : 'Brak odpowiedzi API',
      });
    } finally {
      setIsCheckingOllama(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (isOpen) {
      void checkOllama();
      trackProductInsight('advisor_opened');
    }
  }, [isOpen, checkOllama]);

  const handleToggleOllama = (enabled: boolean) => {
    setOllamaEnabled(enabled);
    writeRaw(StorageKeys.advisorOllamaEnabled, String(enabled));
  };

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    writeRaw(StorageKeys.advisorOllamaModel, modelName);
  };

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const query = textToSend || inputVal;
      if (!query.trim()) return;

      const userMsg: AdvisorChatMessage = {
        id: `m-${Date.now()}`,
        sender: 'user',
        text: query.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      if (!textToSend) setInputVal('');
      setIsTyping(true);

      const canUseOllama = ollamaEnabled && ollamaStatus.connected;

      if (canUseOllama) {
        try {
          const res = await api.post<AdvisorChatResponse>('/advisor/chat', {
            query: query.trim(),
            history: messages.slice(-10),
            model: selectedModel || undefined,
            context: advisorContext ?? undefined,
          });

          if (res && res.success && res.reply) {
            const aiMsg: AdvisorChatMessage = {
              id: `m-${Date.now() + 1}`,
              sender: 'ai',
              text: res.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              source: 'ollama',
              model: res.model || selectedModel || 'ollama',
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsTyping(false);
            return;
          }
        } catch (err: unknown) {
          // Transparent fallback do wbudowanych reguł lokalnych w razie błędu sieci/hosta
          const fallbackText = getRuleBasedReply(query.trim(), advisorContext ?? undefined).text;
          const errDetail = err instanceof Error ? err.message : 'brak połączenia';
          const aiMsg: AdvisorChatMessage = {
            id: `m-${Date.now() + 1}`,
            sender: 'ai',
            text: `${fallbackText}\n\n*(Asysta Ollamy była chwilowo niedostępna: ${errDetail}. Odpowiedź wygenerowano z wbudowanych reguł lokalnych.)*`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'rules',
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsTyping(false);
          return;
        }
      }

      // Tryb reguł lokalnych
      setTimeout(() => {
        const replyText = getRuleBasedReply(query.trim(), advisorContext ?? undefined).text;
        const aiMsg: AdvisorChatMessage = {
          id: `m-${Date.now() + 1}`,
          sender: 'ai',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'rules',
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
      }, 500);
    },
    [advisorContext, inputVal, messages, ollamaEnabled, ollamaStatus.connected, selectedModel]
  );

  useEffect(() => {
    writeAdvisorConversation(messages, inputVal);
  }, [inputVal, messages]);

  const handleNewConversation = () => {
    clearAdvisorConversation();
    setMessages([createWelcomeMessage()]);
    setInputVal('');
    setIsTyping(false);
    handledInitialQuestionRef.current = undefined;
  };

  useEffect(() => {
    if (!isOpen) {
      handledInitialQuestionRef.current = undefined;
      return;
    }

    if (initialQuestion && handledInitialQuestionRef.current !== initialQuestion) {
      handledInitialQuestionRef.current = initialQuestion;
      void handleSend(initialQuestion);
    }
  }, [handleSend, initialQuestion, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const activeModelDisplay = selectedModel || ollamaStatus.activeModel;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Doradca regułowy"
      description="Czyta lokalnie aktualny profil i ostatni wynik dopasowania, aby wykryć konkretne luki. Rozmowa zostaje w przeglądarce; do Ollamy trafia tylko zredukowany kontekst analizy."
      size="lg"
    >
      <div className="flex h-[540px] flex-col">
        {/* Pasek statusu asysty Ollamy i narzędzi */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  ollamaStatus.connected && ollamaEnabled
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-muted/40'
                }`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-ink">
                {ollamaStatus.connected
                  ? `Asysta Ollama: ${ollamaEnabled ? 'włączona' : 'wstrzymana'}`
                  : 'Lokalna AI: niedostępna — działają reguły'}
              </span>
            </div>

            {ollamaStatus.connected ? (
              <>
                <button
                  type="button"
                  onClick={() => handleToggleOllama(!ollamaEnabled)}
                  className="cursor-pointer text-[11px] font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
                >
                  {ollamaEnabled ? 'Wyłącz asystę' : 'Włącz asystę'}
                </button>

                {ollamaStatus.models.length > 1 && (
                  <select
                    value={activeModelDisplay}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={!ollamaEnabled}
                    className="rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-ink focus:border-brand-500 focus:outline-none disabled:opacity-50"
                    aria-label="Wybór modelu lokalnej Ollamy"
                  >
                    {ollamaStatus.models.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => void checkOllama()}
                disabled={isCheckingOllama}
                title="Sprawdź ponownie połączenie z lokalną instancją Ollama"
                className="flex cursor-pointer items-center gap-1 text-[11px] text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingOllama ? 'animate-spin' : ''}`} />
                <span>Sprawdź lokalne AI</span>
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={handleNewConversation}
            className="cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            Nowa rozmowa
          </Button>
        </div>

        {advisorContext?.suggestions.length ? (
          <section className="border-b border-line py-3" aria-label="Najbliższe kroki po analizie CV">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink">
              <Map className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              Najbliższe kroki po analizie
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {advisorContext.suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => {
                    trackProductInsight('advisor_suggestion_clicked');
                    onNavigate?.(suggestion.target);
                    onClose();
                  }}
                  className="group rounded-xl border border-line bg-sunken px-2.5 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink">
                    {suggestion.label}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-muted">{suggestion.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div
          className="flex-1 overflow-y-auto space-y-4 p-2 pr-3"
          role="log"
          aria-live="polite"
          aria-label="Historia rozmowy z Doradcą regułowym"
        >
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'ai' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-200">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] p-4 text-xs leading-relaxed shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-brand-600 text-on-brand rounded-2xl rounded-tr-none'
                      : 'bg-sunken border border-line text-ink rounded-2xl rounded-tl-none'
                  }`}
                >
                  {m.source && m.sender === 'ai' && (
                    <div className="mb-2 flex items-center gap-1.5">
                      {m.source === 'ollama' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium text-brand-700 border border-brand-200/60">
                          <Sparkles className="h-2.5 w-2.5 text-brand-600" aria-hidden="true" />
                          Asysta Ollama {m.model ? `(${m.model})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[9px] font-medium text-muted border border-line">
                          Wbudowane reguły
                        </span>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <span
                    className={`mt-1.5 block font-mono text-[9px] ${
                      m.sender === 'user' ? 'text-on-brand/70 text-right' : 'text-muted'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>

                {m.sender === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink border border-line">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-muted font-mono"
              >
                <Sparkles className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
                <span>
                  {ollamaEnabled && ollamaStatus.connected
                    ? `Doradca konsultuje lokalną Ollamę (${activeModelDisplay || 'model'})...`
                    : 'Dobieram konkretną regułę lokalną...'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-line/60 pt-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSend(prompt)}
                className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-line">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
            placeholder="Zadaj pytanie o CV lub przygotowanie do rekrutacji..."
            aria-label="Pytanie do Doradcy regułowego"
            className="flex-1 rounded-2xl border border-line bg-sunken px-4 py-2.5 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />

          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Send}
            disabled={!inputVal.trim() || isTyping}
            onClick={() => void handleSend()}
          >
            Wyślij
          </Button>
        </div>
      </div>
    </Modal>
  );
};
