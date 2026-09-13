import React, { useState } from 'react';
import {
  Star,
  Sparkles,
  Mail,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Save,
  MessageSquare,
} from 'lucide-react';
import {
  InterviewLoopSession,
  PostCallDebrief,
  MasterVault,
} from '../../types';
import {
  generateFollowUpEmail,
  saveInterviewSession,
} from '../../lib/interviewLoopEngine';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { showToast } from '../../store/useToastStore';
import { contributeInterviewQuestion } from '../../lib/crowdsourceIntel';

export interface PostCallDebriefViewProps {
  session: InterviewLoopSession;
  vault: MasterVault;
  onUpdateSession: (updated: InterviewLoopSession) => void;
  onClose: () => void;
}

export const PostCallDebriefView: React.FC<PostCallDebriefViewProps> = ({
  session,
  vault,
  onUpdateSession,
  onClose,
}) => {
  const candidateName = vault.personalInfo?.fullName || 'Kandydat';

  // Ocena startuje bez wyboru. Domyślna „4" archiwizowała się jako fakt po
  // jednym kliknięciu „zapisz", choć użytkownik niczego nie ocenił (reguła 1).
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(
    session.postCallDebrief?.overallRating ?? null
  );
  // Pole startuje puste. Podpowiedź „dyskusja o architekturze systemu"
  // wpisywała się do zapisanego debriefu i do maila follow-up jako rzecz,
  // która rzekomo się wydarzyła — czyli wymyślona treść w dokumencie idącym
  // do rekrutera (reguła 1). Przykład zostaje w `placeholder`.
  const [whatWentWell, setWhatWentWell] = useState(
    session.postCallDebrief?.whatWentWell || ''
  );
  const [topicsToClarify, setTopicsToClarify] = useState(
    session.postCallDebrief?.topicsToClarifyInFollowUp || ''
  );

  /**
   * Pytania faktycznie zadane na rozmowie.
   *
   * Najcenniejsza rzecz, jaka wychodzi z tego ekranu: nie ma jej w żadnym
   * publicznym ogłoszeniu. Trafia do wspólnej bazy anonimowo — bez konta,
   * bez `user_id`, wyłącznie para firma + stanowisko + pytanie.
   */
  const [trickyQuestions, setTrickyQuestions] = useState<string[]>(
    session.postCallDebrief?.trickyQuestions ?? []
  );
  const [questionDraft, setQuestionDraft] = useState('');

  const handleAddQuestion = () => {
    const question = questionDraft.trim();
    if (question.length < 3) return;

    setTrickyQuestions((prev) => [...prev, question]);
    setQuestionDraft('');

    contributeInterviewQuestion(session.companyName, session.roleTitle ?? '', question);
  };


  const [generatedEmail, setGeneratedEmail] = useState<string>(() => {
    return (
      session.postCallDebrief?.generatedFollowUpEmail ||
      generateFollowUpEmail(session, candidateName, {
        whatWentWell,
        topicsToClarifyInFollowUp: topicsToClarify,
      })
    );
  });

  const [copied, setCopied] = useState(false);

  const handleRegenerateEmail = () => {
    const email = generateFollowUpEmail(session, candidateName, {
      whatWentWell,
      topicsToClarifyInFollowUp: topicsToClarify,
    });
    setGeneratedEmail(email);
  };

  const handleSaveDebrief = () => {
    if (rating === null) return;

    const debrief: PostCallDebrief = {
      overallRating: rating,
      whatWentWell,
      trickyQuestions,
      topicsToClarifyInFollowUp: topicsToClarify,
      generatedFollowUpEmail: generatedEmail,
      completedAt: new Date().toISOString(),
    };

    const updatedSession: InterviewLoopSession = {
      ...session,
      status: 'COMPLETED',
      postCallDebrief: debrief,
      updatedAt: new Date().toISOString(),
    };

    saveInterviewSession(updatedSession);
    onUpdateSession(updatedSession);

    showToast('Zapisano debrief rozmowy', {
      message: `Sesja dla ${session.companyName} została pomyślnie zarchiwizowana.`,
      variant: 'success',
    });
    onClose();
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail);
      setCopied(true);
      showToast('Skopiowano treść e-maila do schowka', {
        message: `Gotowy e-mail follow-up do ${session.companyName}`,
        variant: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Schowek bywa zablokowany (niewidoczna karta, brak uprawnień, http) —
      // milczenie wyglądałoby jak skopiowanie. Użytkownik ma treść w polu
      // obok, więc wystarczy wskazać ręczną drogę.
      showToast('Nie udało się skopiować', {
        message: 'Zaznacz treść e-maila w polu powyżej i skopiuj ją ręcznie.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Samoocena i Subiektywne Wrażenie */}
      <div className="rounded-2xl border border-line bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-xs font-bold text-ink uppercase tracking-wider block">
            Ogólna Ocena Przebiegu Spotkania:
          </span>
          <span className="text-[11px] text-muted">
            Jak oceniasz chemię z zespołem i poziom swoich odpowiedzi?
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-elevated p-1.5 rounded-xl border border-line">
          {([1, 2, 3, 4, 5] as const).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 text-muted hover:text-amber-500 transition-colors"
            >
              <Star
                className={`h-5 w-5 ${
                  rating !== null && star <= rating
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-muted/40'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 2. Pytania debriefowe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
          <label className="font-mono text-xs font-bold text-ink uppercase tracking-wider block">
            Co poszło najlepiej? (Kluczowy sukces)
          </label>
          <input
            type="text"
            value={whatWentWell}
            onChange={(e) => setWhatWentWell(e.target.value)}
            placeholder="np. szczegółowe wyjaśnienie wdrożenia kolejki zdarzeń..."
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
          <label className="font-mono text-xs font-bold text-ink uppercase tracking-wider block">
            Temat do doprecyzowania w follow-up:
          </label>
          <input
            type="text"
            value={topicsToClarify}
            onChange={(e) => setTopicsToClarify(e.target.value)}
            placeholder="np. doświadczenie z konfiguracją klastra Kafka..."
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 2b. Pytania z rozmowy — zasilają wspólną bazę wiedzy */}
      <div className="rounded-2xl border border-line bg-elevated p-4 space-y-3">
        <div>
          <label
            htmlFor="debrief-question"
            className="font-mono text-xs font-bold uppercase tracking-wider text-ink"
          >
            Pytania, które faktycznie padły:
          </label>
          <p className="mt-1 text-[11px] text-muted">
            Zapisujemy je anonimowo — bez Twojego konta i bez notatek. Dzięki temu
            następna osoba idąca do {session.companyName} wie, na co się przygotować.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            id="debrief-question"
            type="text"
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddQuestion();
              }
            }}
            placeholder="np. Jak rozwiązywałeś konflikt w zespole?"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
            disabled={questionDraft.trim().length < 3}
          >
            Dodaj pytanie
          </Button>
        </div>

        {trickyQuestions.length > 0 && (
          <ul className="space-y-1.5">
            {trickyQuestions.map((question, index) => (
              <li
                key={`${index}-${question}`}
                className="rounded-lg border border-line/70 bg-surface px-3 py-2 text-xs leading-relaxed text-ink"
              >
                {question}
              </li>
            ))}
          </ul>
        )}
      </div>



      {/* 3. Generator Follow-up Email */}
      <div className="rounded-2xl border border-line bg-elevated p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-600" />
            <span className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
              Wygenerowany e-mail follow-up (Podziękowanie):
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={handleRegenerateEmail}
            >
              Przebuduj
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopyEmail}
            >
              {copied ? 'Skopiowano!' : 'Kopiuj e-mail'}
            </Button>
          </div>
        </div>

        <textarea
          rows={8}
          value={generatedEmail}
          onChange={(e) => setGeneratedEmail(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface p-3.5 font-sans text-xs text-ink leading-relaxed shadow-inner placeholder:text-muted focus:border-brand-500 focus:outline-none resize-y"
        />
      </div>

      {/* Przycisk Zapisz Debrief */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {rating === null && (
          <span className="text-xs text-muted">
            Wybierz ocenę, żeby zapisać debrief.
          </span>
        )}
        <Button
          type="button"
          variant="primary"
          size="md"
          icon={Save}
          disabled={rating === null}
          onClick={handleSaveDebrief}
        >
          Zapisz i Zakończ Sesję
        </Button>
      </div>
    </div>
  );
};
