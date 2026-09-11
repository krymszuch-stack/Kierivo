import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, User, RotateCcw } from 'lucide-react';
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
  /**
   * Prop pozostaje dla kompatybilności hosta, ale obecny Doradca regułowy go
   * nie odczytuje. Nie należy z tego wywodzić personalizacji odpowiedzi.
   */
  vault?: MasterVault;
}

const QUICK_PROMPTS = [
  'Jak opisać sukcesy w metodzie STAR?',
  'Jak przygotować CV czytelne dla parserów rekrutacyjnych?',
  'Jak opisać doświadczenie przy aplikacji na rolę Senior?',
  'Jak unikać sztucznego upychania słów kluczowych?',
];

function createWelcomeMessage(): AdvisorChatMessage {
  return {
    id: 'm-init',
    sender: 'ai',
    text: 'Jestem lokalnym Doradcą regułowym CVelocity. Odpowiadam z wbudowanych zasad i dostaję tylko treść pytania, które wpiszesz lub wybierzesz. Nie czytam automatycznie Master Vaultu ani aplikacji i nie wysyłam tej rozmowy do modelu AI.',
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

    // Odpowiedzi są lokalnymi regułami, nie wywołaniem modelu językowego.
    setTimeout(() => {
      let replyText = 'W CV warto używać konkretnych fraz z ogłoszenia tylko wtedy, gdy opisują Twoje prawdziwe doświadczenie. Wynik CVelocity jest wskazówką do redakcji dokumentu, nie przewidywaniem decyzji rekrutera.';

      const qLower = query.toLowerCase();
      if (qLower.includes('star')) {
        replyText = 'Metoda STAR porządkuje opis na Situation, Task, Action i Result. Podawaj wyłącznie metryki, które możesz obronić na rozmowie. Zamiast „odpowiedzialny za rozwój API” możesz użyć wzoru: „Zoptymalizowałem [co zrobiłeś] przez [narzędzie lub działanie], co zmieniło [Twój realny, weryfikowalny rezultat]”.';
      } else if (qLower.includes('kolumn') || qLower.includes('pdf') || qLower.includes('parser')) {
        replyText = 'Układ wielokolumnowy, tekst w grafikach i niestandardowe nagłówki mogą utrudniać automatyczny odczyt dokumentu. Jednokolumnowy układ, zwykła warstwa tekstowa i standardowe sekcje są konserwatywnym wyborem. CVelocity nie testuje jednak dokumentu wewnątrz konkretnego zewnętrznego ATS.';
      } else if (qLower.includes('senior')) {
        replyText = 'Przy roli Senior pokaż zakres odpowiedzialności, decyzje techniczne, mentoring i wpływ na wynik zespołu tylko tam, gdzie faktycznie należały do Twojej pracy. Zamiast dopisywać modne frazy, powiąż technologie i decyzje z konkretnymi projektami oraz własnymi rezultatami.';
      } else if (qLower.includes('słów') || qLower.includes('keyword') || qLower.includes('upychan')) {
        replyText = 'Frazy z ogłoszenia powinny występować w naturalnym kontekście. Dodaj narzędzie lub kompetencję do opisu projektu tylko wtedy, gdy naprawdę z niej korzystałeś. Powtarzanie słowa bez kontekstu może pogorszyć czytelność dla człowieka, a CVelocity nie obiecuje, że zwiększy to wynik dowolnego zewnętrznego ATS.';
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
      title="Doradca regułowy"
      description="Dostaje tylko wpisane pytanie lub szybki prompt. Nie czyta automatycznie Vaultu ani aplikacji; rozmowa zostaje w przeglądarce."
      size="lg"
    >
      <div className="flex h-[520px] flex-col">
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

        <div className="flex-1 overflow-y-auto space-y-4 p-2 pr-3" role="log" aria-live="polite" aria-label="Historia rozmowy z Doradcą regułowym">
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
                <span>Doradca przygotowuje odpowiedź z lokalnych reguł...</span>
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
                onClick={() => handleSend(prompt)}
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
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
            onClick={() => handleSend()}
          >
            Wyślij
          </Button>
        </div>
      </div>
    </Modal>
  );
};
