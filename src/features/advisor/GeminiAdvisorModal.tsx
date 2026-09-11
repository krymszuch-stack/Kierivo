import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  User,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

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
  // Prop zachowany dla kontraktu wywołań (App.tsx / AdvisorModalHost), ale w obecnym
  // silniku regułowym offline nie jest konsumowany — żadne dane profilu ani Vault
  // nie są przekazywane do przetwarzania ani wysyłane na zewnątrz.
  vault?: MasterVault;
}

const QUICK_PROMPTS = [
  'Jak opisać sukcesy w metodzie STAR?',
  'Dlaczego ATS odrzuca PDF z dwoma kolumnami?',
  'Jak podnieść wynik dopasowania dla ról Senior?',
  'Jakie są typowe błędy lematyzacji w języku polskim?',
];

function createWelcomeMessage(): AdvisorChatMessage {
  return {
    id: 'm-init',
    sender: 'ai',
    // Modal nie woła żadnego modelu AI (odpowiedzi to reguły + `setTimeout`),
    // więc powitanie nie może deklarować ekspertyzy AI — tylko to, czym jest
    // i gdzie kończy się prywatność rozmowy (audyt treści §2.4).
    text: 'Jestem doradcą regułowym CVelocity — odpowiadam na bazie sprawdzonych zasad rekrutacji. Nic z tej rozmowy nie opuszcza przeglądarki. O co chcesz zapytać?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  initialQuestion,
}) => {
  const [initialCache] = useState(readAdvisorConversation);
  const [messages, setMessages] = useState<AdvisorChatMessage[]>(() => {
    const cached = initialCache.messages;
    return cached.length > 0 ? cached : [createWelcomeMessage()];
  });

  const [inputVal, setInputVal] = useState(() => initialCache.draft);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handledInitialQuestionRef = useRef<string | undefined>(undefined);

  const handleSend = useCallback((textToSend?: string) => {
    const query = textToSend || inputVal;
    if (!query.trim()) return;

    const userMsg: AdvisorChatMessage = {
      id: `m-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal('');
    setIsTyping(true);

    // Simulated Advisor Response
    setTimeout(() => {
      let replyText = 'Dobre pytanie! W systemach rekrutacyjnych ATS kluczem jest precyzja słów kluczowych i twarde metryki biznesowe.';

      const qLower = query.toLowerCase();
      if (qLower.includes('star')) {
        // Wzorzec z miejscami do uzupełnienia zamiast gotowca z cudzymi
        // liczbami („o 42% dla 150k użytkowników” namawiał do fabrykowania
        // metryk — reguła 1; audyt treści §2.3).
        replyText = 'Metoda STAR (Situation, Task, Action, Result) to złoty standard. Podawaj wyłącznie metryki, które obronisz na rozmowie. Zamiast pisać "odpowiedzialny za rozwój API", napisz: "Zoptymalizowałem zapytania SQL w PostgreSQL (Action), skracając czas X o [wpisz swoją realną liczbę]% (Result)".';
      } else if (qLower.includes('kolumn') || qLower.includes('pdf')) {
        replyText = 'Większość parserów ATS czyta tekst od lewej do prawej. W układzie dwukolumnowym tekst z lewej i prawej kolumny potrafi się zlepić w jeden nieczytelny ciąg, co prowadzi do utraty punktów dopasowania. Jednokolumnowy układ to najbezpieczniejszy wybór dla czytelności maszynowej.';
      } else if (qLower.includes('senior')) {
        replyText = 'Dla stanowisk Senior / Lead liczy się wpływ na architekturę, mentoring i optymalizację kosztów chmury (FinOps). Zadbaj, aby w najnowszym stanowisku pojawiły się frazy: "Architektura modularna", "Code Review", "Projektowanie systemów rozproszonych" oraz "Wdrażanie standardów bezpieczeństwa".';
      }

      const aiMsg: AdvisorChatMessage = {
        id: `m-${Date.now() + 1}`,
        sender: 'ai',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 700);
  }, [inputVal]);

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
      handleSend(initialQuestion);
    }
  }, [handleSend, initialQuestion, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Okienko Doradcy Kariery"
      description="Rozmowa jest zachowywana tylko w tej sesji przeglądarki."
      size="lg"
    >
      <div className="flex flex-col h-[520px]">
        <div className="flex justify-end pb-2">
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
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 p-2 pr-3" role="log" aria-live="polite" aria-label="Historia rozmowy z Doradcą Kariery">
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
                <span>Doradca analizuje i pisze odpowiedź...</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="border-t border-line/60 pt-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(prompt)}
                className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-line">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Zadaj pytanie doradcy (np. jak uzasadnić przerwę w karierze)..."
            aria-label="Pytanie do Doradcy Kariery"
            className="flex-1 rounded-2xl border border-line bg-sunken px-4 py-2.5 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />

          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Send}
            disabled={!inputVal.trim() || isTyping}
            onClick={() => handleSend()}
          >
            Wyślij
          </Button>
        </div>
      </div>
    </Modal>
  );
};
