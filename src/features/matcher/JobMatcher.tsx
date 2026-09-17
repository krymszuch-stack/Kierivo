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
  Layers,
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
import { createApplicationDocumentSnapshot } from '../../lib/applicationSnapshot';
import { isVaultEmpty } from '../../lib/vaultCompleteness';
import { Tabs } from '../../components/ui/Tabs';
import { QuickOnboardingFlow } from '../onboarding/QuickOnboardingFlow';
import { JDInputModes } from './JDInputModes';
import { JobFeasibilityAdvisor } from './JobFeasibilityAdvisor';
import type { MobilityPreferences } from '../../lib/commuteCalculator';
import { RealtimeLivePreview } from './RealtimeLivePreview';
import { DocumentRenderer } from './DocumentRenderer';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import {
  calculateJobMatch,
  buildJobOfferFromScraped,
  buildJobOfferFromManual,
} from '../../lib/jobMatcherEngine';
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
import type { AdvisorContext } from '../advisor/advisorContext';
import { ModelQuotaCounter } from '../../components/ui/ModelQuotaCounter';

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
  const [canonicalResult, setCanonicalResult] = useState<CanonicalAtsScore | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [parsedJd, setParsedJd] = useState<ParsedJobDescription | null>(null);
  const [isBaseCvPreviewOpen, setIsBaseCvPreviewOpen] = useState(false);
  // Błąd dopasowania musiałby widzieć modal — wcześniej catch tylko logował,
  // a modal czekał na wyniki w nieskończoność.
  const [matchError, setMatchError] = useState<string | null>(null);

  // Tryb dopasowania: domyślnie uproszczony onboarding dla nowego użytkownika
  const [matcherMode, setMatcherMode] = useState<'quick' | 'advanced'>(() => {
    return isVaultEmpty(vault) ? 'quick' : 'advanced';
  });

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
      const matchResult = calculateJobMatch(vault, job);
      setCanonicalResult(matchResult.canonicalResult);
      setAtsResult(matchResult.atsResult);
      setCoverLetter(matchResult.coverLetter);
      setTailoredResume(matchResult.tailoredResume);
      onAdvisorContext?.(matchResult.advisorContext);

      if (matchResult.shouldCelebrate) {
        triggerConfetti({ count: 90, durationMs: 3000 });
      }
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
    const { job, parsed } = buildJobOfferFromManual(manualOffer);
    setParsedJd(parsed);
    handleMatchJob(job);
  };

  const parseScrapedJob = async (rawJdText: string): Promise<ParsedJobDescription> => {
    const aiAvailable = consumeAiLocally();
    if (!aiAvailable) {
      showToast('Limit analiz AI wyczerpany', {
        message: 'Dzienny przydział wywołań AI został wyczerpany (odnowi się o północy). Ogłoszenie zostało przeanalizowane lokalnym silnikiem regułowym.',
        variant: 'info',
      });
      return parseJobDescriptionLocal(rawJdText);
    }

    try {
      const parseData = await api.post<{ parsedJd: unknown }>('/api/parse-jd', {
        rawJdText,
      });
      return (
        parseJobDescriptionResponse(parseData.parsedJd) ||
        parseJobDescriptionLocal(rawJdText)
      );
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        showToast('Limit analiz AI wyczerpany', {
          message: 'Dzienny limit wywołań modeli AI został wyczerpany (odnowi się o północy). Przełączono na wbudowany silnik regułowy.',
          variant: 'info',
        });
      } else {
        showToast('Lokalna analiza regułowa', {
          message: 'Model AI był niedostępny. Zastosowano lokalny parser heurystyczny Kierivo.',
          variant: 'info',
        });
      }
      return parseJobDescriptionLocal(rawJdText);
    }
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

      const parsed = await parseScrapedJob(fetched.descriptionRaw);
      const job = buildJobOfferFromScraped({ url, fetched, parsed });

      // Ogłoszenie zostało rozpoznane — wysyłka jest anonimowa i „best effort"
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

      {/* Pasek wyboru trybu dopasowania: Uproszczony onboarding vs Tryb zaawansowany */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-surface p-3.5 shadow-xs">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand-fg">
            {matcherMode === 'quick' ? 'Pierwszy przejazd — minimalny happy path' : 'Tryb zaawansowany'}
          </span>
          <p className="text-xs text-muted">
            {matcherMode === 'quick'
              ? 'Wklej CV i ogłoszenie, aby natychmiast poznać wynik ATS i 3 główne problemy.'
              : 'Pełny zestaw narzędzi: 7 modułów dopasowania, presety branżowe i kalkulator dojazdów.'}
          </p>
        </div>

        <Tabs<'quick' | 'advanced'>
          items={[
            { id: 'quick', label: 'Uproszczony start', icon: Sparkles },
            { id: 'advanced', label: 'Tryb zaawansowany', icon: Layers },
          ]}
          active={matcherMode}
          onChange={setMatcherMode}
          variant="pill"
        />
      </div>

      {matcherMode === 'quick' ? (
        <QuickOnboardingFlow
          onShowDetails={(newVault, jobOffer) => {
            onUpdateVault?.(newVault);
            setMatcherMode('advanced');
            handleMatchJob(jobOffer);
          }}
          onSwitchToAdvanced={() => setMatcherMode('advanced')}
        />
      ) : (
        <>
          {/* Informacja o limicie operacji modelowych i łagodne wygaszanie */}
          <ModelQuotaCounter variant="banner" feature="matcher" className="mb-1" />

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
        </>
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
                canonicalResult={canonicalResult ?? undefined}
                tailoredResume={tailoredResume}
                coverLetter={coverLetter}
                onSaveTailoredCV={() => {
                  const snapshot = createApplicationDocumentSnapshot({
                    vault,
                    tailoredResume,
                    jobOffer: selectedJob,
                    atsResult,
                    coverLetter,
                  });

                  const application: JobApplication = {
                    id: `app-${Date.now()}`,
                    company: selectedJob.company,
                    position: selectedJob.title,
                    salary: selectedJob.salary || '',
                    date: new Date().toISOString().slice(0, 10),
                    status: 'Wysłana',
                    jobUrl: selectedJob.url,
                    atsScore: canonicalResult ? canonicalResult.score : atsResult.overallScore,
                    missingKeywords: canonicalResult?.missingRequirements?.length
                      ? canonicalResult.missingRequirements
                      : atsResult.missingHardSkills,
                    documentSnapshot: snapshot,
                  };

                  saveApplication(application);
                  showToast('Dodano do moich aplikacji', {
                    message: `${selectedJob.title} — dopasowanie ${canonicalResult ? canonicalResult.score : atsResult.overallScore}%.`,
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
