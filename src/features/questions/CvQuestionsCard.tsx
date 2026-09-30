import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, SkipForward, Check } from 'lucide-react';
import { MasterVault } from '../../types';
import {
  applyAnswer,
  buildCvQuestionSet,
  loadSkippedQuestionIds,
  MAX_ANSWER_LENGTH,
  previewAnswer,
  pruneSkippedIds,
  saveSkippedQuestionIds,
} from '../../lib/cvQuestionEngine';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { ProgressBar } from '../../components/ui/ProgressBar';

/**
 * Karta pytań uzupełniających — jedno pytanie naraz, z widocznym końcem serii.
 *
 * Cienkie spięcie: cała logika (co zapytać, w jakiej kolejności, gdzie zapisać)
 * siedzi w `src/lib/cvQuestionEngine.ts` i jest testowana w Node bez DOM-u.
 * Tutaj zostaje stan pola tekstowego i nawigacja między pytaniami.
 */

export interface CvQuestionsCardProps {
  profileId: string;
  vault: MasterVault;
  onChange: (vault: MasterVault) => void;
  className?: string;
}

export const CvQuestionsCard: React.FC<CvQuestionsCardProps> = ({
  profileId,
  vault,
  onChange,
  className = '',
}) => {
  // Pominięcia wczytywane raz, przy pierwszym renderze. Zapis idzie do schowka
  // od razu przy kliknięciu „Ignoruj" — nie ma tu czego odkładać, bo to jedna
  // krótka tablica identyfikatorów, a nie serializacja całego vaultu.
  const [skippedIds, setSkippedIds] = useState<string[]>(() => loadSkippedQuestionIds(profileId));
  const [answer, setAnswer] = useState('');
  /**
   * Ile pytań tej serii użytkownik już domknął — odpowiedzią albo pominięciem.
   *
   * Licznik sesyjny, a nie zapisany: po odpowiedzi luka znika z vaultu, więc
   * `questions` się kurczy i sama długość listy nie powie, jak daleko ktoś
   * zaszedł. Bez tego pasek stałby w miejscu na „1/10" przez całą serię.
   */
  const [resolved, setResolved] = useState(0);

  const { questions, totalGaps } = useMemo(
    () => buildCvQuestionSet(vault, skippedIds),
    [vault, skippedIds]
  );

  // Zawsze pierwsze pytanie z listy: po zapisie odpowiedzi luka znika, więc
  // kolejne samo wskakuje na tę pozycję. Trzymanie indeksu w stanie wymagałoby
  // pilnowania, żeby nie wskazywał poza skróconą listę.
  const current = questions[0];

  const preview = useMemo(
    () => (current ? previewAnswer(vault, current, answer) : null),
    [vault, current, answer]
  );

  const persistSkips = useCallback(
    (next: string[]) => {
      // Przycinamy przy każdym zapisie, żeby wpisy o usuniętych stanowiskach
      // nie zostawały w schowku na zawsze.
      const pruned = pruneSkippedIds(vault, next);
      setSkippedIds(pruned);
      saveSkippedQuestionIds(profileId, pruned);
    },
    [profileId, vault]
  );

  const handleSkip = useCallback(() => {
    if (!current) return;
    persistSkips([...skippedIds, current.id]);
    setResolved((count) => count + 1);
    setAnswer('');
  }, [current, persistSkips, skippedIds]);

  const handleSave = useCallback(() => {
    if (!current || !answer.trim()) return;
    onChange(applyAnswer(vault, current, answer));
    setResolved((count) => count + 1);
    setAnswer('');
  }, [current, answer, onChange, vault]);

  // Brak pytań to sukces, nie pusty stan do wypełnienia komunikatem o błędzie.
  // Karta znika z ekranu, zamiast zajmować miejsce zdaniem „nie mam pytań".
  if (!current) return null;

  // Mianownik to długość serii widzianej na jej początku: tyle pytań zostało
  // do domknięcia plus tyle, ile już domknięto. Liczenie od `totalGaps` byłoby
  // uczciwsze arytmetycznie i gorsze w praktyce — przy czterdziestu lukach pasek
  // nie drgnąłby po odpowiedzi i zniechęcał zamiast prowadzić. Ile zostało poza
  // serią, mówi osobne zdanie pod spodem, więc nic tu nie jest ukrywane.
  const seriesLength = resolved + questions.length;
  const position = resolved + 1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.19, 1, 0.22, 1] }}
      aria-labelledby="cv-question-title"
      className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <ProgressBar value={position} max={seriesLength} className="h-1.5" />
        <span className="shrink-0 font-mono text-meta font-bold text-muted">
          {position}/{seriesLength}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-fg">
          <HelpCircle className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-meta font-bold uppercase tracking-[0.18em] text-brand-fg">
            {current.topic}
          </p>

          <h2
            id="cv-question-title"
            className="mt-1.5 text-lg font-black leading-snug tracking-tight text-ink sm:text-xl"
          >
            {current.question}
          </h2>

          <p className="mt-1.5 text-sm text-subtle">{current.hint}</p>
        </div>
      </div>

      <div className="mt-4">
        <Textarea
          label="Twoja odpowiedź"
          value={answer}
          onChange={(event) => setAnswer(event.target.value.slice(0, MAX_ANSWER_LENGTH))}
          maxLength={MAX_ANSWER_LENGTH}
          rows={3}
          placeholder="Wpisz własnymi słowami — trafi do CV dokładnie tak, jak to napiszesz."
        />
        <p className="mt-1 text-right font-mono text-meta text-subtle">
          {answer.length}/{MAX_ANSWER_LENGTH}
        </p>
      </div>

      {/*
        Podgląd przed zapisem, a nie po. Zasada z `SpecializationPicker` mówi,
        że nic nie wchodzi do dokumentu bez świadomej decyzji — a decyzja bez
        pokazania skutku nie jest świadoma.
      */}
      {preview && (
        <div className="mt-3 rounded-xl border border-line/60 bg-sunken p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-subtle">
            Tak będzie wyglądać punkt w CV
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{preview}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-meta text-subtle">
          {totalGaps > questions.length
            ? `Do uzupełnienia jeszcze ${totalGaps - questions.length} poza tą serią`
            : 'To ostatnia seria pytań'}
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" icon={SkipForward} onClick={handleSkip}>
            Ignoruj
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={Check}
            onClick={handleSave}
            disabled={!answer.trim()}
          >
            Zapisz
          </Button>
        </div>
      </div>
    </motion.section>
  );
};
