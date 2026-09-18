import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  User,
  RotateCcw,
  RefreshCw,
  ArrowUpRight,
  Map,
  CircleHelp,
  ExternalLink,
  MessageSquare,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/apiClient';
import { StorageKeys, readRaw, writeRaw } from '../../lib/storage';
import { trackProductInsight } from '../../lib/productInsights';
import type { AdvisorContext } from './advisorContext';
import type { NavTabId } from '../../lib/navigation';
import { SectionRewriterView } from './SectionRewriterView';

import type { MasterVault } from '../../types';
import {
  clearAdvisorConversation,
  readAdvisorConversation,
  writeAdvisorConversation,
  type AdvisorChatMessage,
} from './advisorConversationCache';
import {
  checkOllamaWithTimeout,
  resolveDefaultAdvisorTab,
  type OllamaHealthState,
} from './ollamaHealthChecker';

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

const FAQ_ENTRIES: Array<{
  question: string;
  answer: string;
  action: string;
  target: NavTabId;
}> = [
  {
    question: 'Od czego zacząć?',
    answer: 'Najpierw dodaj lub zaimportuj swoje CV. Master Vault będzie wspólnym źródłem faktów dla kolejnych dokumentów.',
    action: 'Otwórz Profil',
    target: 'profil',
  },
  {
    question: 'Jak sprawdzić ofertę?',
    answer: 'Wklej treść ogłoszenia. Zobaczysz własną analizę dopasowania i wymagania, dla których w profilu brakuje potwierdzenia.',
    action: 'Sprawdź dopasowanie',
    target: 'aplikuj',
  },
  {
    question: 'Co zrobić z tabelami i układem CV?',
    answer: 'Otwórz Audyt ATS. Sprawdzisz tam kolejność odczytu, nagłówki, tabele i znaki wymagające uwagi.',
    action: 'Otwórz Audyt ATS',
    target: 'ats-lab',
  },
  {
    question: 'Gdzie znajdę gotowe porady?',
    answer: 'W Poradach są krótkie materiały o strukturze CV, zmianie branży i przygotowaniu do rozmowy.',
    action: 'Przejdź do Porad',
    target: 'porady',
  },
];

function createWelcomeMessage(): AdvisorChatMessage {
  return {
    id: 'm-init',
    sender: 'ai',
    text: 'Lokalna Ollama jest gotowa. Mogę pomóc na podstawie zredukowanego kontekstu aktualnej analizy — bez danych kontaktowych i pełnej treści CV.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

interface AdvisorFaqSectionProps {
  selectedFaq: (typeof FAQ_ENTRIES)[0];
  onSelectFaq: (faq: (typeof FAQ_ENTRIES)[0]) => void;
  onNavigate?: (target: NavTabId) => void;
  onClose: () => void;
}

const AdvisorFaqSection: React.FC<AdvisorFaqSectionProps> = ({
  selectedFaq,
  onSelectFaq,
  onNavigate,
  onClose,
}) => (
  <section className="rounded-2xl border border-line bg-surface p-4" aria-label="Najczęściej zadawane pytania">
    <div className="mb-3 flex items-center gap-2">
      <CircleHelp className="h-4 w-4 text-brand-600" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-bold text-ink">FAQ: co możesz zrobić teraz?</h3>
        <p className="text-[11px] text-muted">Kliknij pytanie — pokażę odpowiedź i właściwe miejsce w aplikacji.</p>
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {FAQ_ENTRIES.map((entry) => (
        <button
          key={entry.question}
          type="button"
          onClick={() => onSelectFaq(entry)}
          className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
            selectedFaq.question === entry.question
              ? 'border-brand-300 bg-brand-50 text-brand-fg'
              : 'border-line bg-sunken text-ink hover:border-brand-200'
          }`}
        >
          {entry.question}
        </button>
      ))}
    </div>
    <div className="mt-3 rounded-xl border border-line bg-sunken p-3">
      <p className="text-xs leading-relaxed text-ink">{selectedFaq.answer}</p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={ExternalLink}
        onClick={() => {
          onNavigate?.(selectedFaq.target);
          onClose();
        }}
        className="mt-3"
      >
        {selectedFaq.action}
      </Button>
    </div>
  </section>
);

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  initialQuestion,
  advisorContext,
  onNavigate,
}) => {
  const [initialCache] = useState(readAdvisorConversation);
  const [messages, setMessages] = useState<AdvisorChatMessage[]>(() => {
    // Wersje sprzed FAQ zapisywały odpowiedzi regułowe jako rozmowę. Po zmianie
    // kontraktu nie mogą wracać z cache i sprawiać wrażenia działania bez modelu.
    const cached = initialCache.messages.filter((message) => message.source !== 'rules');
    return cached.length > 0 ? cached : [createWelcomeMessage()];
  });

  const [inputVal, setInputVal] = useState(() => initialCache.draft);
  const [isTyping, setIsTyping] = useState(false);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [healthState, setHealthState] = useState<OllamaHealthState>('checking');
  const [selectedFaq, setSelectedFaq] = useState(FAQ_ENTRIES[0]);
  const [advisorTab, setAdvisorTab] = useState<'chat' | 'rewriter'>('rewriter');
  const userSelectedTabRef = useRef(false);

  const handleTabChange = (tab: 'chat' | 'rewriter') => {
    userSelectedTabRef.current = true;
    setAdvisorTab(tab);
  };

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
    setHealthState('checking');
    try {
      const res = await checkOllamaWithTimeout(
        (signal) => api.get<OllamaHealthResponse>('/ai/ollama/health', { signal }),
        5000
      );

      setHealthState(res.state);
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

      if (!userSelectedTabRef.current) {
        setAdvisorTab(resolveDefaultAdvisorTab(res.state));
      }
    } catch (err: unknown) {
      setHealthState('unavailable');
      setOllamaStatus({
        checked: true,
        connected: false,
        models: [],
        activeModel: '',
        error: err instanceof Error ? err.message : 'Brak odpowiedzi API',
      });
      if (!userSelectedTabRef.current) {
        setAdvisorTab('rewriter');
      }
    } finally {
      setIsCheckingOllama(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (isOpen) {
      userSelectedTabRef.current = false;
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

      if (!canUseOllama) {
        setIsTyping(false);
        return;
      }

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
          return;
        }
        throw new Error('Lokalna Ollama nie zwróciła odpowiedzi.');
      } catch (err: unknown) {
        const errDetail = err instanceof Error ? err.message : 'brak połączenia';
        const aiMsg: AdvisorChatMessage = {
          id: `m-${Date.now() + 1}`,
          sender: 'ai',
          text: `Nie udało się uzyskać odpowiedzi z lokalnej Ollamy (${errDetail}). Nie zastępuję jej automatyczną odpowiedzią. Skorzystaj z FAQ albo spróbuj ponownie, gdy model będzie dostępny.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
      }
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

    if (ollamaEnabled && ollamaStatus.connected && initialQuestion && handledInitialQuestionRef.current !== initialQuestion) {
      handledInitialQuestionRef.current = initialQuestion;
      void handleSend(initialQuestion);
    }
  }, [handleSend, initialQuestion, isOpen, ollamaEnabled, ollamaStatus.connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const activeModelDisplay = selectedModel || ollamaStatus.activeModel;
  const advisorAvailable = ollamaEnabled && ollamaStatus.connected;

  if (!advisorAvailable) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Doradca lokalny"
        description="Czat konwersacyjny to funkcja opcjonalna — wymaga lokalnego modelu Ollama na Twoim urządzeniu. Asystent Rewritingu działa zawsze, bez dodatkowej konfiguracji."
        size="lg"
      >
        <div className="space-y-4">
          {/* Zakładki główne Doradcy */}
          <div className="flex items-center gap-2 border-b border-line pb-2.5">
            <button
              type="button"
              onClick={() => handleTabChange('chat')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
                advisorTab === 'chat'
                  ? 'bg-brand-600 text-on-brand shadow-xs'
                  : 'border border-line bg-sunken text-muted hover:text-ink'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Konsultacja & FAQ</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('rewriter')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
                advisorTab === 'rewriter'
                  ? 'bg-brand-600 text-on-brand shadow-xs'
                  : 'border border-line bg-sunken text-muted hover:text-ink'
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Asystent Rewritingu (STAR / ATS)</span>
            </button>
          </div>

          {advisorTab === 'rewriter' ? (
            <div className="space-y-6">
              <SectionRewriterView
                initialRole={advisorContext?.offerTitle}
                onNavigateToProfile={() => {
                  onNavigate?.('profil');
                  onClose();
                }}
              />
              <AdvisorFaqSection
                selectedFaq={selectedFaq}
                onSelectFaq={setSelectedFaq}
                onNavigate={onNavigate}
                onClose={onClose}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-sunken p-3">
                <div className="max-w-md">
                  <p className="text-xs font-semibold text-ink">
                    {healthState === 'checking'
                      ? 'Sprawdzam lokalną Ollamę…'
                      : 'Lokalna Ollama jest teraz niedostępna.'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Czat konwersacyjny to funkcja opcjonalna — wymaga lokalnego modelu Ollama na Twoim urządzeniu. Asystent Rewritingu działa zawsze, bez dodatkowej konfiguracji.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleTabChange('rewriter')}
                  >
                    Przejdź do Asystenta Rewritingu →
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => void checkOllama()}
                    disabled={healthState === 'checking'}
                  >
                    Sprawdź ponownie
                  </Button>
                </div>
              </div>

              {advisorContext?.suggestions.length ? (
                <section aria-label="Najbliższe kroki po analizie CV">
                  <p className="mb-2 text-xs font-semibold text-ink">Wynik analizy podpowiada:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {advisorContext.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => {
                          trackProductInsight('advisor_suggestion_clicked');
                          onNavigate?.(suggestion.target);
                          onClose();
                        }}
                        className="rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                      >
                        <span className="text-xs font-semibold text-ink">{suggestion.label}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-muted">{suggestion.description}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <AdvisorFaqSection
                selectedFaq={selectedFaq}
                onSelectFaq={setSelectedFaq}
                onNavigate={onNavigate}
                onClose={onClose}
              />
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Doradca lokalny"
      description="Czyta lokalnie aktualny profil i ostatni wynik dopasowania, aby wykryć konkretne luki. Rozmowa zostaje w przeglądarce; do Ollamy trafia tylko zredukowany kontekst analizy (bez danych kontaktowych i pełnej treści CV)."
      size="lg"
    >
      <div className="flex h-[560px] flex-col">
        {/* Zakładki główne Doradcy */}
        <div className="flex items-center gap-2 border-b border-line pb-2.5 mb-2">
          <button
            type="button"
            onClick={() => handleTabChange('chat')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
              advisorTab === 'chat'
                ? 'bg-brand-600 text-on-brand shadow-xs'
                : 'border border-line bg-sunken text-muted hover:text-ink'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Rozmowa z Doradcą</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('rewriter')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
              advisorTab === 'rewriter'
                ? 'bg-brand-600 text-on-brand shadow-xs'
                : 'border border-line bg-sunken text-muted hover:text-ink'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>Asystent Rewritingu (STAR / ATS)</span>
          </button>
        </div>

        {advisorTab === 'rewriter' ? (
          <div className="flex-1 overflow-y-auto space-y-6 p-1">
            <SectionRewriterView
              initialRole={advisorContext?.offerTitle}
              onNavigateToProfile={() => {
                onNavigate?.('profil');
                onClose();
              }}
            />
            <AdvisorFaqSection
              selectedFaq={selectedFaq}
              onSelectFaq={setSelectedFaq}
              onNavigate={onNavigate}
              onClose={onClose}
            />
          </div>
        ) : (
          <>
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
                disabled={healthState === 'checking'}
                title="Sprawdź ponownie połączenie z lokalną instancją Ollama"
                className="flex cursor-pointer items-center gap-1 text-[11px] text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${healthState === 'checking' ? 'animate-spin' : ''}`} />
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
        </>
        )}
      </div>
    </Modal>
  );
};
