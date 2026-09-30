import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  HelpCircle,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MessageCircleQuestion,
  LifeBuoy,
  Wand2,
  Target,
  Zap,
  Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MasterVault, JobOffer, InterviewCheatSheet } from '../../types';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { EmptyState } from '../../components/ui/EmptyState';
import { parseJobDescriptionLocal, ParsedJobDescription } from '../../lib/jdParser';
import {
  buildLocalInterviewCheatSheet,
  generateCheatSheetEnrichmentWithAI,
  mergeGeminiCheatSheetEnrichment,
} from '../../lib/interviewCheatSheetEngine';
import { STARStoryView } from '../star/STARStoryView';
import { DrillModeModal } from '../drill/DrillModeModal';
import { DrillQuestion, DEFAULT_DRILL_QUESTIONS } from '../../lib/drillEngine';
import { ElevatorPitchModal } from '../pitch/ElevatorPitchModal';
import { InterviewLoopModal } from '../loop/InterviewLoopModal';

export interface InterviewCheatSheetViewProps {
  vault: MasterVault;
  jobOffer: JobOffer;
  className?: string;
}

type SectionKey = 'questions' | 'star' | 'glossary' | 'redFlags' | 'ask' | 'emergency';

/**
 * Most między `JobOffer` (to, czym dysponuje interfejs) a `ParsedJobDescription`
 * (to, czego potrzebuje silnik). Lokalny parser wyciąga, co się da, z treści
 * ogłoszenia, a pola, które oferta zna wprost — tytuł, firma, stos — nadpisują
 * jego zgadywanie: dane strukturalne biją heurystykę na tekście.
 */
function toParsedJobDescription(jobOffer: JobOffer): ParsedJobDescription {
  const rawText = jobOffer.rawDescription || jobOffer.description || '';
  const parsed = jobOffer.parsedJd ?? parseJobDescriptionLocal(rawText, jobOffer.title || 'Stanowisko');

  const techStack = jobOffer.techStack ?? [];
  const requirements = jobOffer.requirements ?? [];

  return {
    ...parsed,
    jobTitle: jobOffer.title || parsed.jobTitle,
    companyName: jobOffer.company || parsed.companyName,
    toolsAndTech: techStack.length > 0 ? techStack : parsed.toolsAndTech,
    coreResponsibilities:
      parsed.coreResponsibilities?.length > 0 ? parsed.coreResponsibilities : requirements,
    mandatoryRequirements:
      parsed.mandatoryRequirements && parsed.mandatoryRequirements.length > 0
        ? parsed.mandatoryRequirements
        : requirements,
  };
}

const QA_CATEGORY_LABEL: Record<string, string> = {
  BEHAVIORAL: 'Behawioralne',
  TECHNICAL: 'Techniczne',
  MOTIVATION: 'Motywacja',
  SITUATIONAL: 'Sytuacyjne',
};

const GLOSSARY_CATEGORY_LABEL: Record<string, string> = {
  HARD_SKILL: 'Umiejętność',
  TOOL: 'Narzędzie',
  DOMAIN_CONCEPT: 'Pojęcie',
  ACRONYM: 'Skrót',
};

const ASK_CATEGORY_LABEL: Record<string, string> = {
  ROLE_SCOPE: 'Zakres roli',
  TEAM_CULTURE: 'Zespół',
  GROWTH: 'Rozwój',
  BUSINESS_CONTEXT: 'Biznes',
};

export const InterviewCheatSheetView: React.FC<InterviewCheatSheetViewProps> = ({
  vault,
  jobOffer,
  className = '',
}) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    questions: true,
    star: true,
    glossary: false,
    redFlags: false,
    ask: false,
    emergency: false,
  });
  const [enrichment, setEnrichment] = useState<InterviewCheatSheet | null>(null);
  const [consentToAiProcessing, setConsentToAiProcessing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isDrillOpen, setIsDrillOpen] = useState(false);
  const [isPitchOpen, setIsPitchOpen] = useState(false);
  const [isLoopModalOpen, setIsLoopModalOpen] = useState(false);

  const parsedJD = useMemo(() => toParsedJobDescription(jobOffer), [jobOffer]);

  // Szkielet jest czystą funkcją (parsedJD, vault) — liczy się lokalnie, bez
  // tokenów i bez sieci, więc `useMemo` wystarczy za całe zarządzanie stanem.
  const localCheatSheet = useMemo(
    () =>
      buildLocalInterviewCheatSheet(
        parsedJD,
        vault,
        jobOffer.title || '',
        jobOffer.company || ''
      ),
    [parsedJD, vault, jobOffer.title, jobOffer.company]
  );

  const cheatSheet = enrichment ?? localCheatSheet;
  const isEnriched = cheatSheet.generationMode === 'GEMINI_ENRICHED';

  // Budowanie pytań do DrillMode z pytań oferty + domyślnych
  const drillQuestions: DrillQuestion[] = useMemo(() => {
    const fromCheatSheet: DrillQuestion[] = cheatSheet.qaBank.map((qa) => ({
      id: qa.id,
      question: qa.question,
      category: qa.category === 'TECHNICAL' ? 'TECHNICAL' : 'BEHAVIORAL',
      hint: 'Wskazówka ze ściągi rekrutacyjnej dopasowanej do tej oferty.',
      targetDurationSec: 60,
      referenceNotes: qa.modelAnswer,
    }));

    return [...fromCheatSheet, ...DEFAULT_DRILL_QUESTIONS];
  }, [cheatSheet.qaBank]);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnrich = async () => {
    if (!consentToAiProcessing) {
      setEnrichError('Zaznacz zgodę na wysłanie wymienionych danych do modelu AI.');
      return;
    }
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const topRequirements = [
        ...(parsedJD.mandatoryRequirements ?? []),
        ...parsedJD.requiredHardSkills,
      ].slice(0, 8);

      const { enrichment: payload } = await generateCheatSheetEnrichmentWithAI(
        jobOffer.title || parsedJD.jobTitle,
        jobOffer.company || parsedJD.companyName,
        jobOffer.rawDescription || jobOffer.description || '',
        vault,
        topRequirements,
        consentToAiProcessing
      );

      setEnrichment(mergeGeminiCheatSheetEnrichment(localCheatSheet, payload));
    } catch (err) {
      setEnrichError(
        err instanceof Error
          ? err.message
          : 'Nie udało się wzbogacić ściągi. Szkielet poniżej pozostaje aktualny.'
      );
    } finally {
      setIsEnriching(false);
    }
  };

  const sectionHeader = (
    key: SectionKey,
    icon: React.ReactNode,
    label: string,
    count?: number
  ) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      className="flex w-full items-center justify-between text-left focus-visible:outline-none"
    >
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
          {label}
          {count !== undefined ? ` (${count})` : ''}
        </h4>
      </div>
      {openSections[key] ? (
        <ChevronUp className="h-4 w-4 text-muted" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted" />
      )}
    </button>
  );

  const collapsible = (key: SectionKey, className: string, children: React.ReactNode) => (
    <AnimatePresence>
      {openSections[key] && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-elevated p-4 shadow-raised">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
            Ściąga na rozmowę rekrutacyjną
          </h3>
          <p className="text-[10px] font-mono lowercase tracking-wide text-muted">
            interview cheat sheet
          </p>
          <p className="text-[11px] text-muted">
            Zbudowana lokalnie z Twojego Master Vaultu i treści oferty — bez zużycia tokenów.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={Radio}
            onClick={() => setIsLoopModalOpen(true)}
          >
            Interview Loop 🎙️
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={Zap}
            onClick={() => setIsPitchOpen(true)}
          >
            Elevator Pitch ⚡
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Target}
            onClick={() => setIsDrillOpen(true)}
          >
            Uruchom Mock Drill 🎯
          </Button>
          <Chip variant={isEnriched ? 'brand' : 'neutral'} className="text-[10px] py-px">
            {isEnriched ? 'Wzbogacona przez AI' : 'Szkielet lokalny · 0 tokenów'}
          </Chip>
          {!isEnriched && (
            <Button
              size="sm"
              variant="secondary"
              icon={Wand2}
              loading={isEnriching}
              onClick={handleEnrich}
            disabled={!consentToAiProcessing}
            >
              Wzbogać przez AI
            </Button>
          )}
        </div>
      </div>

      {!isEnriched && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs">
          <p className="text-ink">
            Wzbogacenie prześle do dostawcy AI skonfigurowanego w projekcie (Azure OpenAI lub lokalna Ollama, zależnie od środowiska)
            nazwę firmy i stanowiska, treść oferty oraz wybrane dane Vaultu:
            podsumowanie, umiejętności, doświadczenie i projekty. Dane kontaktowe i zdjęcie są pomijane, ale pozostała treść
            może nadal identyfikować osobę.
          </p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-ink">
            <input
              type="checkbox"
              checked={consentToAiProcessing}
              onChange={(event) => setConsentToAiProcessing(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span>Wyrażam zgodę na wysłanie wymienionych danych do modelu AI, aby wygenerować tę ściągę.</span>
          </label>
        </div>
      )}

      {enrichError && (
        <Alert variant="warning" title="Wzbogacenie nie powiodło się">
          {enrichError}
        </Alert>
      )}

      {cheatSheet.personalizedFraming && (
        <Alert variant="info" title="Dlaczego ta rola i ta firma" icon={Sparkles}>
          {cheatSheet.personalizedFraming}
        </Alert>
      )}

      {/* 1. Bank pytań */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'questions',
          <HelpCircle className="h-4 w-4 text-brand-600" />,
          '1. Prawdopodobne Pytania Rekrutacyjne',
          cheatSheet.qaBank.length
        )}
        {collapsible(
          'questions',
          'space-y-3 pt-2',
          cheatSheet.qaBank.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="Brak pytań do wygenerowania"
              description="Wklej treść ogłoszenia — pytania budowane są z jego wymagań."
            />
          ) : (
            cheatSheet.qaBank.map((qa) => (
              <div
                key={qa.id}
                className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold leading-snug text-ink">{qa.question}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Chip variant="neutral" className="text-[10px] py-px">
                      {QA_CATEGORY_LABEL[qa.category] ?? qa.category}
                    </Chip>
                    {qa.source === 'GEMINI_PERSONALIZED' && (
                      <Chip variant="brand" className="text-[10px] py-px">
                        AI
                      </Chip>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-200/50 bg-brand-50/50 p-2.5 text-[11px] text-brand-fg">
                  <strong>Wskazówka odpowiedzi:</strong> {qa.modelAnswer}
                </div>
              </div>
            ))
          )
        )}
      </Card>

      {/* 2. Historie STAR */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'star',
          <Award className="h-4 w-4 text-success-fg" />,
          '2. Szkice STAR na podstawie punktów z profilu',
          cheatSheet.starTalkingPoints.length
        )}
        {collapsible(
          'star',
          'space-y-3 pt-2',
          <STARStoryView vault={vault} />
        )}
      </Card>

      {/* 3. Glosariusz */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'glossary',
          <Sparkles className="h-4 w-4 text-violet" />,
          '3. Glosariusz Pojęć z Oferty',
          cheatSheet.glossary.length
        )}
        {collapsible(
          'glossary',
          'grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2',
          cheatSheet.glossary.map((term) => (
            <div
              key={term.id}
              className="space-y-1 rounded-xl border border-line bg-surface p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-brand-fg">{term.term}</span>
                <Chip variant="neutral" className="text-[10px] py-px">
                  {GLOSSARY_CATEGORY_LABEL[term.category] ?? term.category}
                </Chip>
              </div>
              <p className="text-[11px] text-muted">{term.definition}</p>
            </div>
          ))
        )}
      </Card>

      {/* 4. Checklista wymagań */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'redFlags',
          <AlertTriangle className="h-4 w-4 text-warning-fg" />,
          '4. O To Na Pewno Zapytają',
          cheatSheet.redFlagsChecklist.length
        )}
        {collapsible(
          'redFlags',
          'space-y-2 pt-2',
          cheatSheet.redFlagsChecklist.map((item) => (
            <div
              key={item.id}
              className="space-y-1 rounded-xl border border-line bg-surface p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold leading-snug text-ink">{item.label}</span>
                <Chip
                  variant={item.severity === 'MUST_KNOW' ? 'danger' : 'warning'}
                  className="shrink-0 text-[10px] py-px"
                >
                  {item.severity === 'MUST_KNOW' ? 'Konieczne' : 'Warto'}
                </Chip>
              </div>
              <p className="text-[11px] text-muted">{item.detail}</p>
            </div>
          ))
        )}
      </Card>

      {/* 5. Pytania do rekrutera */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'ask',
          <MessageCircleQuestion className="h-4 w-4 text-brand-600" />,
          '5. Pytania, Które Warto Zadać',
          cheatSheet.questionsToAsk.length
        )}
        {collapsible(
          'ask',
          'space-y-2 pt-2',
          cheatSheet.questionsToAsk.map((item) => (
            <div
              key={item.id}
              className="space-y-1 rounded-xl border border-line bg-surface p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold leading-snug text-ink">{item.question}</span>
                <Chip variant="neutral" className="shrink-0 text-[10px] py-px">
                  {ASK_CATEGORY_LABEL[item.category] ?? item.category}
                </Chip>
              </div>
              <p className="text-[11px] text-muted">{item.rationale}</p>
            </div>
          ))
        )}
      </Card>

      {/* 6. Zwroty ratunkowe */}
      <Card tone="raised" className="space-y-3">
        {sectionHeader(
          'emergency',
          <LifeBuoy className="h-4 w-4 text-violet" />,
          '6. Zwroty Ratunkowe',
          cheatSheet.emergencyPhrases.length
        )}
        {collapsible(
          'emergency',
          'space-y-2 pt-2',
          cheatSheet.emergencyPhrases.map((phrase) => (
            <div
              key={phrase.id}
              className="space-y-1 rounded-xl border border-line bg-surface p-3 text-xs"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                {phrase.scenario}
              </span>
              <p className="text-[11px] font-bold text-ink">{phrase.phrasePL}</p>
              {phrase.phraseEN && (
                <p className="text-[11px] italic text-muted">{phrase.phraseEN}</p>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Modal trybu DrillMode */}
      <DrillModeModal
        isOpen={isDrillOpen}
        onClose={() => setIsDrillOpen(false)}
        customQuestions={drillQuestions}
      />

      {/* Modal Elevator Pitch Generator */}
      <ElevatorPitchModal
        isOpen={isPitchOpen}
        onClose={() => setIsPitchOpen(false)}
        vault={vault}
      />

      {/* Modal Interview Loop Manager */}
      <InterviewLoopModal
        isOpen={isLoopModalOpen}
        onClose={() => setIsLoopModalOpen(false)}
        vault={vault}
        jobOffer={jobOffer}
      />
    </div>
  );
};
