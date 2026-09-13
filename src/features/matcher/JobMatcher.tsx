import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  FileText,
  Eye,
  Wrench,
  Truck,
  Code2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  MasterVault,
  TailoredResume,
  CoverLetter,
  AtsCheckResult,
  JobOffer,
  ApplicationDocumentSnapshot,
} from '../../types';
import type { FetchJdUrlResponse } from '../../types/api';
import { ApiError, api } from '../../lib/apiClient';
import type { ParsedJobDescription } from '../../lib/jdParser';
import { parseJobDescriptionResponse } from '../../lib/jdSchema';
import { parseJobDescriptionLocal } from '../../lib/jdParser';
import { JDInputModes } from './JDInputModes';
import { JobFeasibilityAdvisor } from './JobFeasibilityAdvisor';
import type { MobilityPreferences } from '../../lib/commuteCalculator';
import { RealtimeLivePreview } from './RealtimeLivePreview';
import { DocumentRenderer } from './DocumentRenderer';
import { simulateAtsCheck } from '../../lib/atsSimulator';
import { generateAntiTemplateCoverLetter } from '../../lib/coverLetterEngine';
import { triggerConfetti } from '../../lib/confetti';
import { consumeAiLocally } from '../../store/useEntitlements';
import { contributeJobIntel } from '../../lib/crowdsourceIntel';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { useApplications } from '../../store/useApplications';
import { JobApplication } from '../../types';
import { showToast } from '../../store/useToastStore';
import { buildAdvisorContext, type AdvisorContext } from '../advisor/advisorContext';

interface JobPreset {
  id: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  company: string;
  salary: string;
  offer: Partial<JobOffer>;
}

const SAMPLE_PRESETS: JobPreset[] = [
  {
    id: 'preset-hvac',
    badge: 'Techniczna / HVAC',
    icon: Wrench,
    title: 'Monter & Serwisant Pieców Gazowych',
    company: 'EkoTerm Serwis Sp. z o.o.',
    salary: '7 500 - 10 500 PLN brutto',
    offer: {
      id: 'preset-hvac',
      title: 'Monter & Serwisant Pieców Gazowych',
      company: 'EkoTerm Serwis Sp. z o.o.',
      salary: '7 500 - 10 500 PLN brutto',
      portal: 'Przykładowe ogłoszenie',
      requirements: ['Uprawnienia SEP G3 (eksploatacja)', 'Certyfikat F-Gaz', 'Diagnostyka kotłów gazowych (Junkers / Bosch)', 'Prawo jazdy kat. B'],
      description: `Poszukujemy doświadczonego Montera i Serwisanta urządzeń grzewczych i pomp ciepła na terenie województwa mazowieckiego.
Wymagania:
- Ważne uprawnienia SEP G3 (eksploatacja, mile widziany dozór)
- Certyfikat F-Gaz dla personelu (kategoria I)
- Doświadczenie w montażu, uruchamianiu i przeglądach kotłów gazowych (Junkers, Bosch, Vaillant, Viessmann)
- Umiejętność czytania dokumentacji technicznej i schematów hydraulicznych
- Prawo jazdy kat. B i dyspozycyjność do pracy w terenie`,
    },
  },
  {
    id: 'preset-wms',
    badge: 'Logistyka / Magazyn',
    icon: Truck,
    title: 'Operator Wózka Widłowego / Magazynier WMS',
    company: 'LogiCenter Hub Polska',
    salary: '5 800 - 7 200 PLN brutto',
    offer: {
      id: 'preset-wms',
      title: 'Operator Wózka Widłowego / Magazynier WMS',
      company: 'LogiCenter Hub Polska',
      salary: '5 800 - 7 200 PLN brutto',
      portal: 'Przykładowe ogłoszenie',
      requirements: ['Uprawnienia UDT na wózki jezdniowe podnośnikowe', 'Obsługa skanerów kodów kreskowych i systemów WMS', 'Doświadczenie w kompletacji zamówień', 'Dbałość o standardy BHP'],
      description: `Centrum logistyczne poszukuje Operatora Wózka Widłowego do obsługi magazynu wysokiego składu.
Wymagania:
- Uprawnienia UDT do obsługi wózków jezdniowych podnośnikowych (kat. II WJO / I WJO)
- Praktyczna znajomość systemów magazynowych WMS i skanerów radiowych
- Doświadczenie w pracach przeładunkowych, kompletacji towarów i inwentaryzacji
- Przestrzeganie zasad BHP i procedur FIFO`,
    },
  },
  {
    id: 'preset-dev',
    badge: 'IT / Software',
    icon: Code2,
    title: 'Senior React Developer (TypeScript)',
    company: 'ScaleApp Software',
    salary: '22 000 - 28 000 PLN netto B2B',
    offer: {
      id: 'preset-dev',
      title: 'Senior React Developer (TypeScript)',
      company: 'ScaleApp Software',
      salary: '22 000 - 28 000 PLN netto B2B',
      portal: 'Przykładowe ogłoszenie',
      requirements: ['React 19 / Next.js', 'TypeScript', 'Architektura SPA / SSR', 'Testy jednostkowe (Vitest / Jest)', 'Optymalizacja Web Vitals'],
      description: `Poszukujemy doświadczonego programisty Frontend do rozwoju platformy webowej.
Wymagania:
- Min. 4 lata komercyjnego doświadczenia z React i TypeScript
- Głęboka znajomość wzorców projektowych, state management i React 19
- Umiejętność pisania testów jednostkowych i integracyjnych
- Znajomość dobrych praktyk optymalizacji wydajności i dostępności WCAG`,
    },
  },
];

export interface JobMatcherProps {
  vault: MasterVault;
  onUpdateVault?: (updated: MasterVault) => void;
  onAdvisorContext?: (context: AdvisorContext) => void;
  className?: string;
}

export const JobMatcher: React.FC<JobMatcherProps> = ({
  vault,
  onUpdateVault,
  onAdvisorContext,
  className = '',
}) => {
  // ATS Matching State
  const [selectedJob, setSelectedJob] = useState<JobOffer | null>(null);
  const [isAtsModalOpen, setIsAtsModalOpen] = useState(false);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [atsResult, setAtsResult] = useState<AtsCheckResult | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [parsedJd, setParsedJd] = useState<ParsedJobDescription | null>(null);
  const [isBaseCvPreviewOpen, setIsBaseCvPreviewOpen] = useState(false);
  // Błąd dopasowania musiałby widzieć modal — wcześniej catch tylko logował,
  // a modal czekał na wyniki w nieskończoność.
  const [matchError, setMatchError] = useState<string | null>(null);

  // Preferencje dojazdu żyją w vaulcie, a nie w stanie widoku: kalkulator ma
  // pamiętać, jak daleko użytkownik mieszka, przy każdej kolejnej ofercie.
  const handleMobilityChange = (mobilityPreferences: MobilityPreferences) => {
    onUpdateVault?.({ ...vault, mobilityPreferences });
  };
  const [isTailoring, setIsTailoring] = useState(false);

  const { saveApplication } = useApplications();

  const handleMatchJob = async (job: JobOffer) => {
    setSelectedJob(job);
    setIsTailoring(true);
    setMatchError(null);
    setIsAtsModalOpen(true);

    try {
      const jdText = job.description || job.requirements?.join(' ') || job.title;

      // 1. Create Tailored Resume
      const tailored: TailoredResume = {
        targetJobTitle: job.title,
        companyName: job.company,
        summary: vault.personalInfo?.summary
          ? vault.personalInfo.summary
          : `Dopasowany profil zawodowy pod stanowisko ${job.title} w firmie ${job.company}.`,
        selectedHighlights: vault.history.flatMap((h) =>
          h.highlights.map((hl) => ({
            experienceId: h.id,
            role: h.role,
            company: h.company,
            originalText: hl.text,
            optimizedText: hl.text,
            source: 'SLOT_FILLING' as const,
            keywordsMatched: hl.keywords || [],
          }))
        ),
        skillsMatched: {
          hardSkills: vault.skillsMatrix?.hardSkills || [],
          toolsAndTech: vault.skillsMatrix?.toolsAndTech || [],
          softSkills: vault.skillsMatrix?.softSkills || [],
        },
        // Wypełniane zaraz po symulacji. Stała w tym miejscu była wartością
        // wymyśloną, którą łatwo przeoczyć przy refaktorze i wypuścić na ekran.
        atsScore: 0,
      };

      // 2. Run Slot Filling & ATS Simulation
      const ats = simulateAtsCheck(tailored, vault, jdText);
      tailored.atsScore = ats.overallScore;
      setAtsResult(ats);
      onAdvisorContext?.(buildAdvisorContext(vault, job, ats));

      if (ats.overallScore >= 90) {
        triggerConfetti({ count: 90, durationMs: 3000 });
      }


      // 3. Generate Anti-Template Cover Letter
      const cl = generateAntiTemplateCoverLetter(job.title, job.company, jdText, vault);
      setCoverLetter(cl);

      setTailoredResume(tailored);
    } catch (err) {
      console.error('Błąd dopasowywania oferty:', err);
      // Bez tego modal wisiał na spinnerze „Kalkulacja..." do zamknięcia ręcznego.
      setMatchError(
        'Nie udało się policzyć dopasowania dla tej oferty. Spróbuj ponownie albo uzupełnij profil w sekcji PROFIL.'
      );
    } finally {
      setIsTailoring(false);
    }
  };

  const handleMatchManual = (manualOffer: Partial<JobOffer>) => {
    const rawText = manualOffer.description || '';
    const parsed =
      manualOffer.parsedJd ||
      parseJobDescriptionLocal(rawText, manualOffer.title || 'Stanowisko');
    const job: JobOffer = {
      id: manualOffer.id || `manual-${Date.now()}`,
      title: manualOffer.title || '',
      company: manualOffer.company || '',
      salary: manualOffer.salary || '',
      location: manualOffer.location || '',
      description: manualOffer.description || '',
      requirements: manualOffer.requirements || [],
      remote: manualOffer.remote ?? false,
      portal: 'Manual',
      techStack: manualOffer.requirements || [],
      parsedJd: parsed,
    };
    setParsedJd(parsed);
    handleMatchJob(job);
  };

  const handleMatchUrl = async (url: string) => {
    setUrlError(null);
    setIsFetchingUrl(true);

    try {
      let fetched: FetchJdUrlResponse & { success: true };
      try {
        fetched = await api.post<FetchJdUrlResponse & { success: true }>('/api/fetch-jd-url', { url });
      } catch (err) {
        setUrlError(
          err instanceof ApiError
            ? err.message
            : 'Nie udało się pobrać oferty z podanego adresu URL.'
        );
        return;
      }

      // Structure the scraped text via the AI parser, falling back to the local
      // heuristic. The response is validated rather than trusted: `res.json()` is
      // `any`, so a shape mismatch would otherwise pass typecheck and leave every
      // field undefined — throwing away a result we paid the model for.
      let parsed: ParsedJobDescription;
      // Podpowiedź licznika na zero = strzał skazany na 402; lokalny parser
      // daje od razu gorszy, ale uczciwy wynik. Prawdę o limicie i tak zna
      // serwer — tu decydujemy tylko, czy warto wysyłać.
      const aiAvailable = consumeAiLocally();
      try {
        if (!aiAvailable) throw new Error('lokalny limit AI wyczerpany');
        const parseData = await api.post<{ parsedJd: unknown }>('/api/parse-jd', {
          rawJdText: fetched.descriptionRaw,
        });
        parsed =
          parseJobDescriptionResponse(parseData.parsedJd) ||
          parseJobDescriptionLocal(fetched.descriptionRaw);
      } catch {
        // Model bywa niedostępny, a limit kwot bywa wyczerpany. Lokalny parser
        // heurystyczny daje gorszy wynik, ale zawsze jakiś — użytkownik nie
        // zostaje z pustym ekranem po tym, jak ofertę udało się już pobrać.
        parsed = parseJobDescriptionLocal(fetched.descriptionRaw);
      }

      // Gdy portal udostępnia dane strukturalne (schema.org/JobPosting), mają one
      // pierwszeństwo przed wynikiem modelu: pochodzą wprost od wystawiającego
      // ofertę, więc tytuł, firma, widełki i tryb pracy są faktem, a nie
      // odczytem z tekstu. Model uzupełnia wtedy tylko to, czego w nich nie ma.
      const fromPortal = fetched.extraction?.structured === true;

      const job: JobOffer = {
        id: `url-${Date.now()}`,
        title: (fromPortal && fetched.title) || parsed.jobTitle || fetched.title || 'Oferta z adresu URL',
        company: (fromPortal && fetched.company) || parsed.companyName || fetched.company || '',
        salary: fetched.salary || parsed.salaryRange || '',
        location: fetched.location || '',
        description: fetched.descriptionRaw,
        requirements: parsed.requiredHardSkills?.length
          ? parsed.requiredHardSkills
          : (fetched.skills ?? []),
        remote: fetched.remote ?? parsed.workModel === 'REMOTE',
        portal: 'URL',
        url,
        techStack: parsed.toolsAndTech?.length ? parsed.toolsAndTech : (fetched.skills ?? []),
        parsedJd: parsed,
      };

      // Ogłoszenie zostało rozpoznane — to jest moment, w którym powstaje
      // cegiełka do wspólnej bazy.
      // Wysyłka jest anonimowa i „best effort": jej błąd nie może przerwać
      // dopasowania, które użytkownik właśnie uruchomił.
      contributeJobIntel({ ...parsed, sourceUrl: url });
      setParsedJd(parsed);

      handleMatchJob(job);
    } catch (err) {
      console.error('Błąd pobierania oferty z URL:', err);
      setUrlError('Błąd połączenia podczas pobierania oferty. Spróbuj wkleić treść ogłoszenia ręcznie.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader
        title="Dopasowanie Ofert & Audyt ATS"
        description="Wklej link do oferty lub jej treść — audyt ATS sprawdzi pokrycie wymagań Twojego CV, a dokumenty aplikacyjne przygotujesz na tej podstawie."
        badge="Analiza bez tokenów AI"
      />

      {/* Input Modes (Live / URL / Manual) */}
      <JDInputModes
        onMatchManual={handleMatchManual}
        onMatchUrl={handleMatchUrl}
        isFetchingUrl={isFetchingUrl}
        urlError={urlError}
      />

      {/* Stan początkowy przed wklejeniem oferty: Szybki Start + Podgląd Twojego Bazowego CV */}
      {!selectedJob && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolumna lewa: Szybki start (Presety ofert z różnych branż) & Jak działa audyt */}
          <div className="lg:col-span-7 space-y-6">
            <Card tone="raised" className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Szybki start — przetestuj na gotowej ofercie</h3>
                    <p className="text-xs text-ink-muted">Kliknij dowolną branżę, aby natychmiast zobaczyć audyt ATS i dopasowanie dokumentów.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SAMPLE_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleMatchManual(preset.offer)}
                      className="flex flex-col text-left p-3.5 rounded-xl border border-line bg-surface hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-ink-muted group-hover:text-brand-600">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-muted text-muted font-medium">
                          {preset.badge}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-ink group-hover:text-brand-600 line-clamp-2 leading-snug">
                        {preset.title}
                      </span>
                      <span className="text-[11px] text-ink-muted mt-1 truncate">{preset.company}</span>
                      <span className="text-[10px] font-mono text-brand-fg font-semibold mt-2.5">{preset.salary}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Karta: Jak działa audyt ATS w 3 krokach */}
            <Card tone="flat" className="p-5 space-y-3 bg-surface-muted/40 border border-line">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Jak działa silnik dopasowania ATS</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-line space-y-1.5">
                  <span className="font-mono text-[10px] font-bold text-brand-600">01. EKSTRAKCJA</span>
                  <p className="font-bold text-ink text-xs">Dane z ogłoszenia</p>
                  <p className="text-[11px] text-ink-muted leading-relaxed">Odczyt struktury JSON-LD lub treści oferty bez zużywania tokenów AI.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-line space-y-1.5">
                  <span className="font-mono text-[10px] font-bold text-brand-600">02. FLEKSJA</span>
                  <p className="font-bold text-ink text-xs">Lematyzator PL</p>
                  <p className="text-[11px] text-ink-muted leading-relaxed">Analiza odmian gramatycznych i wykrywanie brakujących słów kluczowych.</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-line space-y-1.5">
                  <span className="font-mono text-[10px] font-bold text-brand-600">03. DOKUMENTY</span>
                  <p className="font-bold text-ink text-xs">Dopasowane CV</p>
                  <p className="text-[11px] text-ink-muted leading-relaxed">Generowanie spersonalizowanego CV, listu motywacyjnego i pytań rekrutacyjnych.</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Kolumna prawa: Karta Twojego Bazowego CV (Live Preview) */}
          <div className="lg:col-span-5">
            <Card tone="raised" className="p-5 space-y-4 h-full flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink">Twoje Bazowe CV</h3>
                      <p className="text-xs text-ink-muted">Master Vault gotowy do dopasowania</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Eye}
                    onClick={() => setIsBaseCvPreviewOpen(true)}
                  >
                    Podgląd A4
                  </Button>
                </div>

                {/* Profil snapshot */}
                <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink text-sm truncate">
                      {vault.personalInfo?.fullName || 'Brak imienia i nazwiska'}
                    </span>
                    <span className="text-[11px] text-brand-fg font-medium shrink-0">
                      {vault.personalInfo?.title || 'Tytuł zawodowy'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-muted pt-2 border-t border-line">
                    <div>
                      <span className="text-muted block">Doświadczenie:</span>
                      <span className="font-semibold text-ink">{vault.history?.length || 0} stanowisk</span>
                    </div>
                    <div>
                      <span className="text-muted block">Osiągnięcia STAR:</span>
                      <span className="font-semibold text-ink">
                        {vault.history?.reduce((acc, h) => acc + (h.highlights?.length || 0), 0) || 0} punktów
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Umiejętności:</span>
                      <span className="font-semibold text-ink">
                        {vault.skillsMatrix?.hardSkills?.length || 0} twardych
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Lokalizacja:</span>
                      <span className="font-semibold text-ink truncate block">
                        {vault.personalInfo?.location || 'Nie podano'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Szybka miniatura dokumentu */}
                <div
                  onClick={() => setIsBaseCvPreviewOpen(true)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface p-4 text-center hover:border-brand-500/50 hover:bg-brand-500/5 transition-all"
                >
                  <div className="mx-auto max-w-[200px] space-y-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="h-2 w-3/4 mx-auto bg-ink/30 rounded" />
                    <div className="h-1.5 w-1/2 mx-auto bg-brand-500/40 rounded" />
                    <div className="h-1 w-full bg-ink/10 rounded mt-2" />
                    <div className="h-1 w-5/6 bg-ink/10 rounded" />
                    <div className="h-1 w-4/6 bg-ink/10 rounded" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-brand-600 group-hover:underline">
                    <Eye className="h-3.5 w-3.5" />
                    Otwórz pełny podgląd arkusza A4
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                <span className="text-ink-muted">To CV zostanie dopasowane do ogłoszenia</span>
                <span className="text-success-fg font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Gotowe
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}


      {/* Kalkulator opłacalności — pokazuje się dopiero, gdy jest co liczyć. */}
      {selectedJob && (
        <JobFeasibilityAdvisor
          offer={selectedJob}
          parsed={parsedJd}
          preferences={vault.mobilityPreferences}
          onPreferencesChange={handleMobilityChange}
        />
      )}

      {/* ATS Simulator & Tailored Resume Modal */}
      {selectedJob && (
        <Modal
          isOpen={isAtsModalOpen}
          onClose={() => setIsAtsModalOpen(false)}
          title={`Dopasowanie ATS dla: ${selectedJob.title} (${selectedJob.company})`}
          size="xl"
        >
          <div className="space-y-6">
            {matchError ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                <p className="max-w-md text-sm font-semibold text-danger-fg">{matchError}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => handleMatchJob(selectedJob)}
                    disabled={isTailoring}
                  >
                    Spróbuj ponownie
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsAtsModalOpen(false)}>
                    Zamknij
                  </Button>
                </div>
              </div>
            ) : atsResult && tailoredResume && coverLetter ? (
              <RealtimeLivePreview
                vault={vault}
                jobOffer={selectedJob}
                atsResult={atsResult}
                tailoredResume={tailoredResume}
                coverLetter={coverLetter}
                onSaveTailoredCV={() => {
                  const snapshot: ApplicationDocumentSnapshot = {
                    schemaVersion: 1,
                    createdAt: new Date().toISOString(),
                    tailoredResume: JSON.parse(JSON.stringify(tailoredResume)),
                    coverLetter: coverLetter ? JSON.parse(JSON.stringify(coverLetter)) : undefined,
                    vaultSnapshot: JSON.parse(JSON.stringify(vault)),
                    jobOfferSnapshot: {
                      id: selectedJob.id,
                      title: selectedJob.title,
                      company: selectedJob.company,
                      salary: selectedJob.salary,
                      location: selectedJob.location,
                      description: selectedJob.description,
                      url: selectedJob.url,
                    },
                    atsResultSnapshot: atsResult ? JSON.parse(JSON.stringify(atsResult)) : undefined,
                  };

                  const application: JobApplication = {
                    id: `app-${Date.now()}`,
                    company: selectedJob.company,
                    position: selectedJob.title,
                    salary: selectedJob.salary || '',
                    date: new Date().toISOString().slice(0, 10),
                    status: 'Wysłana',
                    jobUrl: selectedJob.url,
                    atsScore: atsResult.overallScore,
                    missingKeywords: atsResult.missingHardSkills,
                    documentSnapshot: snapshot,
                  };

                  saveApplication(application);
                  showToast('Dodano do moich aplikacji', {
                    message: `${selectedJob.title} — dopasowanie ${atsResult.overallScore}%.`,
                  });
                  setIsAtsModalOpen(false);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Sparkles className="h-8 w-8 animate-spin text-brand-600 mb-3" />
                <p className="font-sans text-sm font-bold text-ink">
                  Kalkulacja dopasowania ATS i generowanie dokumentów aplikacyjnych...
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal podglądu Twojego Bazowego CV na arkuszu A4 */}
      {isBaseCvPreviewOpen && (
        <Modal
          isOpen={isBaseCvPreviewOpen}
          onClose={() => setIsBaseCvPreviewOpen(false)}
          title={`Podgląd Bazowego CV (Master Vault) • ${vault.personalInfo?.fullName || 'Profil Kandydata'}`}
          size="full"
        >
          <DocumentRenderer
            vault={vault}
            onExported={() => {
              showToast('Eksport CV', {
                message: 'Bazowe CV zostało przekazane do druku / eksportu PDF.',
                variant: 'info',
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
};
