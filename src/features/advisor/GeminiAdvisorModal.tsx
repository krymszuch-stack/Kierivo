import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createAdvisorRequestGuard } from './advisorRequestGuard';
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
import { ApiError, api } from '../../lib/apiClient';
import { trackProductInsight } from '../../lib/productInsights';
import type { AdvisorContext } from './advisorContext';
import { getAnalysisFreshnessDetails } from '../../lib/analysisFreshness';
import { useAnalysisClock } from '../../hooks/useAnalysisClock';
import { Card } from '../../components/ui/Card';
import type { NavTabId } from '../../lib/navigation';
import { SectionRewriterView } from './SectionRewriterView';
import { useAuth } from '../../context/AuthContext';
import { ANONYMOUS_PROFILE_ID } from '../../lib/localProfile';

import type { MasterVault } from '../../types';
import {
  clearAdvisorConversation,
  readAdvisorConversation,
  writeAdvisorConversation,
  type AdvisorChatMessage,
} from './advisorConversationCache';
import {
  checkAdvisorWithTimeout,
  resolveDefaultAdvisorTab,
  type AdvisorAvailabilityState,
} from './advisorAvailability';

export interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: string;
  /** Dane profilu nie są wysyłane; do API może trafić wyłącznie jawnie pokazany, ograniczony kontekst analizy. */
  vault?: MasterVault;
  advisorContext?: AdvisorContext | null;
  onNavigate?: (target: NavTabId) => void;
}

interface AdvisorStatusResponse {
  success: boolean;
  provider?: string;
  available?: boolean;
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
    text: 'Doradca zaufany korzysta z Azure OpenAI przez API. Wpisana treść i ograniczony kontekst analizy są wysyłane do modelu dopiero po Twoim potwierdzeniu.',
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
  advisorContext: storedAdvisorContext,
  vault,
  onNavigate,
}) => {
  const analysisNow = useAnalysisClock();
  const contextFreshness = getAnalysisFreshnessDetails(storedAdvisorContext, vault?.updatedAt, analysisNow);
  const advisorContext = contextFreshness.state === 'current' ? storedAdvisorContext : null;
  const contextNotice = storedAdvisorContext && contextFreshness.state !== 'current' ? (
    <Card tone="flat" className="mb-4 border-warning/40 p-4 text-sm" role="status">
      <p className="font-semibold text-warning-fg">Kontekst analizy wymaga odświeżenia</p>
      <p className="mt-2 text-muted">{contextFreshness.note}</p>
      <p className="mt-2 text-muted">Doradca nie dołączy poprzedniego wyniku ani listy braków do pytania.</p>
      <Button variant="outline" className="mt-3" onClick={() => { onNavigate?.('aplikuj'); onClose(); }}>Przejdź do ponownej analizy</Button>
    </Card>
  ) : null;
  const { user, mode, session } = useAuth();
  const profileId = user?.id ?? ANONYMOUS_PROFILE_ID;
  const authScope = useMemo(() => ({ profileId, mode, session }), [profileId, mode, session]);
  const [initialCache] = useState(() => readAdvisorConversation(profileId));
  const [conversationProfileId, setConversationProfileId] = useState(profileId);
  const [messages, setMessages] = useState<AdvisorChatMessage[]>(() => {
    // Stara rozmowa mogła zostać lokalnie w Ollamie; nie przenosimy jej historii do Azure.
    const cached = initialCache.messages.filter((message) => message.source === 'azure_openai');
    return cached.length > 0 ? cached : [createWelcomeMessage()];
  });
  const visibleMessages = conversationProfileId === profileId ? messages : [createWelcomeMessage()];

  const [inputVal, setInputVal] = useState(() => initialCache.draft);
  const visibleInput = conversationProfileId === profileId ? inputVal : '';
  const [isTyping, setIsTyping] = useState(false);
  const [azureConsent, setAzureConsent] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState(FAQ_ENTRIES[0]);
  const [advisorTab, setAdvisorTab] = useState<'chat' | 'rewriter'>('rewriter');
  const userSelectedTabRef = useRef(false);

  // Zachowaj oddzielny szkic i historię po przełączeniu konta w tej samej karcie.
  useEffect(() => {
    if (conversationProfileId === profileId) return;
    const cache = readAdvisorConversation(profileId);
    setMessages(cache.messages.length > 0 ? cache.messages : [createWelcomeMessage()]);
    setInputVal(cache.draft);
    setConversationProfileId(profileId);
    setAzureConsent(false);
    setIsTyping(false);
  }, [conversationProfileId, profileId]);

  const handleTabChange = (tab: 'chat' | 'rewriter') => {
    userSelectedTabRef.current = true;
    setAdvisorTab(tab);
  };

  const [advisorStatusSnapshot, setAdvisorStatus] = useState<{
    scope: typeof authScope;
    state: AdvisorAvailabilityState;
    checked: boolean;
    connected: boolean;
    models: Array<{ name: string }>;
    activeModel: string;
    error?: string;
  }>({
    scope: authScope,
    state: 'checking',
    checked: false,
    connected: false,
    models: [],
    activeModel: '',
  });
  // Poprzedni status przestaje obowiązywać już w renderze nowej sesji,
  // zanim efekt rozpocznie ponowne sprawdzanie.
  const advisorStatus = advisorStatusSnapshot.scope === authScope
    ? advisorStatusSnapshot
    : { ...advisorStatusSnapshot, checked: false, connected: false, state: 'checking' as const, error: undefined };
  const healthState = advisorStatus.state;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [advisorRequestGuard] = useState(createAdvisorRequestGuard);
  const [advisorStatusGuard] = useState(createAdvisorRequestGuard);
  useLayoutEffect(() => () => advisorStatusGuard.invalidate(), [advisorStatusGuard, authScope, isOpen]);
  // Cleanup przy zmianie profilu działa w fazie commit, przed obsługą obietnic.
  // Sama zgodność ID nie wystarcza dla przejścia A → B → A.
  useLayoutEffect(() => () => advisorRequestGuard.invalidate(), [advisorRequestGuard, profileId]);
  const handledInitialQuestionRef = useRef<string | undefined>(undefined);

  const checkAdvisor = useCallback(async () => {
    // Ponowne sprawdzenie zastępuje poprzednie; spóźniony wynik nie ma pierwszeństwa.
    advisorStatusGuard.invalidate();
    const statusToken = advisorStatusGuard.begin()!;
    setAdvisorStatus({ scope: authScope, state: 'checking', checked: false, connected: false, models: [], activeModel: '' });
    try {
      const res = await checkAdvisorWithTimeout(
        (signal) => api.get<AdvisorStatusResponse>('/advisor/status', { signal }),
        5000
      );

      if (!advisorStatusGuard.isCurrent(statusToken)) return;
      setAdvisorStatus({
        scope: authScope,
        state: res.state,
        checked: true,
        connected: Boolean(res.connected),
        models: res.models || [],
        activeModel: res.activeModel || '',
        error: res.error,
      });


      if (!userSelectedTabRef.current) {
        setAdvisorTab(resolveDefaultAdvisorTab(res.state));
      }
    } catch (err: unknown) {
      if (!advisorStatusGuard.isCurrent(statusToken)) return;
      setAdvisorStatus({
        scope: authScope,
        state: 'unavailable',
        checked: true,
        connected: false,
        models: [],
        activeModel: '',
        error: err instanceof ApiError && err.status === 401
          ? 'Zaloguj się, aby korzystać z Doradcy Azure.'
          : err instanceof ApiError && err.status === 501
            ? 'Tryb lokalny nie obsługuje Doradcy Azure. Wymagane są konto chmurowe i logowanie.'
            : err instanceof Error ? err.message : 'Brak odpowiedzi API',
      });
      if (!userSelectedTabRef.current) {
        setAdvisorTab('rewriter');
      }
    } finally {
      advisorStatusGuard.finish(statusToken);
    }
  }, [advisorStatusGuard, authScope]);

  useEffect(() => {
    if (isOpen) {
      void checkAdvisor();
    }
  }, [isOpen, checkAdvisor]);
  useEffect(() => {
    if (isOpen) {
      userSelectedTabRef.current = false;
      trackProductInsight('advisor_opened');
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const query = textToSend || inputVal;
      if (conversationProfileId !== profileId || !query.trim() || !advisorStatus.connected || !azureConsent) return;
      // Blokada refem zamyka wyścig dwóch kliknięć przed następnym renderem Reacta.
      const requestToken = advisorRequestGuard.begin();
      if (!requestToken) return;

      const userMsg: AdvisorChatMessage = {
        id: `m-${Date.now()}`,
        sender: 'user',
        source: 'azure_openai',
        text: query.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      if (!textToSend) setInputVal('');
      setIsTyping(true);

      try {
        const res = await api.post<AdvisorChatResponse>('/advisor/chat', {
          query: query.trim(),
          history: messages.slice(-10),
          // Ponowna kontrola przy wysłaniu zamyka okno między renderem a kliknięciem.
          context: getAnalysisFreshnessDetails(storedAdvisorContext, vault?.updatedAt).state === 'current'
            ? storedAdvisorContext ?? undefined : undefined,
          consentToAzure: true,
        });

        if (!advisorRequestGuard.isCurrent(requestToken)) return;
        if (res && res.success && res.reply) {
          const aiMsg: AdvisorChatMessage = {
            id: `m-${Date.now() + 1}`,
            sender: 'ai',
            text: res.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'azure_openai',
            model: res.model || 'Azure OpenAI',
          };
          setMessages((prev) => [...prev, aiMsg]);
          return;
        }
        throw new Error('Azure OpenAI nie zwróciło odpowiedzi.');
      } catch (err: unknown) {
        if (!advisorRequestGuard.isCurrent(requestToken)) return;
        const errDetail = err instanceof Error ? err.message : 'brak połączenia';
        const aiMsg: AdvisorChatMessage = {
          id: `m-${Date.now() + 1}`,
          sender: 'ai',
          text: `Nie udało się uzyskać odpowiedzi z Azure OpenAI (${errDetail}). Nie zastępuję jej automatyczną odpowiedzią. Spróbuj ponownie później.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } finally {
        if (advisorRequestGuard.finish(requestToken)) setIsTyping(false);
      }
    },
    [storedAdvisorContext, vault, azureConsent, conversationProfileId, inputVal, messages, profileId, advisorStatus.connected, advisorRequestGuard]
  );

  useEffect(() => {
    if (conversationProfileId !== profileId) return;
    writeAdvisorConversation(profileId, messages, inputVal);
  }, [conversationProfileId, inputVal, messages, profileId]);

  const handleNewConversation = () => {
    if (advisorRequestGuard.isBusy()) return;
    clearAdvisorConversation(profileId);
    setMessages([createWelcomeMessage()]);
    setInputVal('');
    setIsTyping(false);
    handledInitialQuestionRef.current = undefined;
  };

  const closeAdvisor = useCallback(() => {
    setAzureConsent(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      handledInitialQuestionRef.current = undefined;
      return;
    }

    if (azureConsent && advisorStatus.connected && initialQuestion && handledInitialQuestionRef.current !== initialQuestion) {
      handledInitialQuestionRef.current = initialQuestion;
      void handleSend(initialQuestion);
    }
  }, [azureConsent, handleSend, initialQuestion, isOpen, advisorStatus.connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const activeModelDisplay = 'Azure OpenAI';
  const advisorAvailable = advisorStatus.connected;

  if (!advisorAvailable) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={closeAdvisor}
        title="Doradca zaufany"
        description="Czat i propozycje redakcji korzystają z Azure OpenAI przez API. Wpisana treść jest wysyłana dopiero po potwierdzeniu; profil nie jest dołączany automatycznie."
        size="lg"
      >
        <div className="space-y-4">
          {contextNotice}
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
                key={profileId}
                initialRole={advisorContext?.offerTitle}
                azureAvailable={advisorStatus.connected}
                onNavigateToProfile={() => {
                  onNavigate?.('profil');
                  onClose();
                }}
              />
              <AdvisorFaqSection
                selectedFaq={selectedFaq}
                onSelectFaq={setSelectedFaq}
                onNavigate={onNavigate}
                onClose={closeAdvisor}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-sunken p-3">
                <div className="max-w-md">
                  <p className="text-xs font-semibold text-ink">
                    {healthState === 'checking'
                      ? 'Sprawdzam konfigurację Doradcy Azure…'
                      : advisorStatus.error || 'Doradca Azure jest niedostępny w tej instalacji.'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Wymagany jest tryb chmurowy, logowanie i konfiguracja Azure OpenAI. Bez nich aplikacja nie udaje odpowiedzi modelu.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => void checkAdvisor()}
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
                onClose={closeAdvisor}
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
      onClose={closeAdvisor}
      title="Doradca zaufany"
      description="Korzysta z Azure OpenAI przez serwerowe API. Wysyłana jest wpisana treść oraz ograniczony kontekst analizy; cały profil nie jest dołączany automatycznie."
      size="lg"
    >
      <div className="flex h-[560px] flex-col">
        {contextNotice}
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
              key={profileId}
              initialRole={advisorContext?.offerTitle}
              azureAvailable={advisorStatus.connected}
              onNavigateToProfile={() => {
                onNavigate?.('profil');
                onClose();
              }}
            />
            <AdvisorFaqSection
              selectedFaq={selectedFaq}
              onSelectFaq={setSelectedFaq}
              onNavigate={onNavigate}
              onClose={closeAdvisor}
            />
          </div>
        ) : (
          <>
            {/* Ten status opisuje konfigurację, nie gwarantuje dostępności deploymentu. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  advisorStatus.connected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-muted/40'
                }`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-ink">
                {advisorStatus.connected ? 'Azure OpenAI: skonfigurowane' : 'Azure OpenAI: niedostępne'}
              </span>
            </div>

            {!advisorStatus.connected ? (
              <button
                type="button"
                onClick={() => void checkAdvisor()}
                disabled={healthState === 'checking'}
                title="Sprawdź ponownie konfigurację Azure OpenAI"
                className="flex cursor-pointer items-center gap-1 text-[11px] text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${healthState === 'checking' ? 'animate-spin' : ''}`} />
                <span>Sprawdź konfigurację AI</span>
              </button>
            ) : null}
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
            {visibleMessages.map((m) => (
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
                      {m.source === 'azure_openai' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium text-brand-700 border border-brand-200/60">
                          <Sparkles className="h-2.5 w-2.5 text-brand-600" aria-hidden="true" />
                          Azure OpenAI {m.model ? `(${m.model})` : ''}
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
                  {advisorStatus.connected
                    ? `Doradca przygotowuje feedback przez ${activeModelDisplay}...`
                    : 'Azure OpenAI jest niedostępne.'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-line/60 pt-3 pb-2">
          <label className="mb-3 flex items-start gap-2 rounded-xl border border-line bg-sunken p-2.5 text-[11px] leading-relaxed text-muted">
            <input
              type="checkbox"
              checked={azureConsent}
              onChange={(event) => setAzureConsent(event.target.checked)}
              className="mt-0.5 accent-brand-600"
            />
            <span>Potwierdzam wysłanie mojego pytania, ostatnich wiadomości rozmowy i ograniczonego kontekstu analizy do Azure OpenAI przez API. Nie wysyłaj tu danych, których nie chcesz przekazać dostawcy modelu.</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSend(prompt)}
                disabled={!azureConsent || isTyping}
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
            value={visibleInput}
            maxLength={4000}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && void handleSend()}
            placeholder="Zadaj pytanie o CV lub przygotowanie do rekrutacji..."
            aria-label="Pytanie do Doradcy zaufanego"
            className="flex-1 rounded-2xl border border-line bg-sunken px-4 py-2.5 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />

          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Send}
            disabled={!inputVal.trim() || isTyping || !azureConsent}
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
