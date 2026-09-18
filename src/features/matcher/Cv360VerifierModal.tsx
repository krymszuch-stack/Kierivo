import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Cpu,
  Scale,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';
import { MasterVault } from '../../types';
import { api, ApiError } from '../../lib/apiClient';
import { useEntitlements, consumeAiLocally } from '../../store/useEntitlements';
import { useOptionalAuth } from '../../context/AuthContext';
import { setAuthModalOpenGlobal } from '../../store/useAppStore';
import { showToast } from '../../store/useToastStore';
import { LocalProfile } from '../../lib/localProfile';
import { ModelQuotaCounter } from '../../components/ui/ModelQuotaCounter';
import { CvVerificationReport } from '../../server/services/cvVerifier.service';

export interface Cv360VerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  targetRole?: string;
  targetCompany?: string;
  jobDescription?: string;
  /** Opcjonalne wstrzyknięcie użytkownika (przydatne do testów) */
  currentUser?: LocalProfile | null;
  /** Opcjonalny callback wywoływany przy próbie weryfikacji bez sesji */
  onRequireLogin?: () => void;
}

export const Cv360VerifierModal: React.FC<Cv360VerifierModalProps> = ({
  isOpen,
  onClose,
  vault,
  targetRole,
  targetCompany,
  jobDescription,
  currentUser,
  onRequireLogin,
}) => {
  const auth = useOptionalAuth();
  const { usage, refresh: refreshEntitlements } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CvVerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLoopTab, setActiveLoopTab] = useState<'ats' | 'recruiter' | 'logic'>('ats');

  const activeUser = currentUser !== undefined ? currentUser : auth?.user;
  const isAuthed = currentUser !== undefined ? Boolean(currentUser) : Boolean(auth?.isAuthenticated && auth?.user);

  const runVerification = async () => {
    // 1. Sprawdzenie aktywnego użytkownika przed jakimkolwiek loadingiem, lokalnym decrementem i requestem AI
    if (!isAuthed || !activeUser) {
      showToast('Wymagane logowanie', {
        message: 'Zaloguj się, aby uruchomić Weryfikator CV AI 360°.',
        variant: 'info',
      });
      if (onRequireLogin) {
        onRequireLogin();
      } else {
        setAuthModalOpenGlobal(true);
      }
      return;
    }

    // 2. Weryfikacja kwoty i lokalny decrement (tylko zalogowany użytkownik może zużyć lokalny limit)
    if (usage.aiUses <= 0 || !consumeAiLocally()) {
      setError(
        'Dzienny limit zapytań AI w tej becie został wyczerpany (odnowi się o północy). Możesz skorzystać z lokalnego audytu struktury w zakładce Laboratorium Audytu ATS.'
      );
      return;
    }

    // 3. Rozpoczęcie loadingu i wykonanie zapytania
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<{ report?: CvVerificationReport }>('/api/ai/verify-cv', {
        vault,
        targetRole,
        targetCompany,
        jobDescription,
      });

      if (data.report) {
        setReport(data.report);
      }
      refreshEntitlements();
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setError(
          'Dzienny limit wywołań weryfikatora AI został osiągnięty. Limit odnawia się automatycznie o północy.'
        );
        refreshEntitlements();
      } else {
        setError(err instanceof Error ? err.message : 'Nie udało się połączyć z modelem weryfikatora.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Nagłówek */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">Weryfikator CV AI 360°</h2>
                <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  Potrójna Pętla Sprawdzająca
                </span>
                <ModelQuotaCounter variant="badge" feature="verifier" />
              </div>
              <p className="text-xs text-muted">
                Niezależny audyt ATS, 6-sekundowe oko rekrutera oraz detekcja luk logicznych i zgodności RODO.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stan początkowy: Przed uruchomieniem */}
        {!report && !loading && !error && (
          <div className="space-y-6 text-center py-8">
            <ModelQuotaCounter variant="banner" feature="verifier" className="text-left" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
                  <Cpu className="h-4 w-4" />
                  Pętla 1: Parser ATS
                </div>
                <h4 className="text-sm font-bold text-ink">Brama Maszynowa</h4>
                <p className="text-xs text-muted">
                  Symuluje ekstrakcję przez silniki rekrutacyjne, wykrywa brakujące twarde słowa kluczowe i ryzyka formatowania.
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider">
                  <Eye className="h-4 w-4" />
                  Pętla 2: Oko Rekrutera
                </div>
                <h4 className="text-sm font-bold text-ink">6-Sekundowy Skan</h4>
                <p className="text-xs text-muted">
                  Bada siłę nagłówka, obecność mierzalnych metryk biznesowych (% i liczby) oraz bezwzględnie eliminuje lanie wody.
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
                  <Scale className="h-4 w-4" />
                  Pętla 3: Spójność i Logika
                </div>
                <h4 className="text-sm font-bold text-ink">Audyt Chronologii</h4>
                <p className="text-xs text-muted">
                  Weryfikuje nakładanie się dat zatrudnienia, luki w stażu, sprzeczne deklaracje i zgodność z klauzulą RODO.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runVerification}
              disabled={isAuthed && usage.aiUses <= 0}
              className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all ${
                isAuthed && usage.aiUses <= 0
                  ? 'bg-muted cursor-not-allowed opacity-60'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 cursor-pointer'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              {isAuthed && usage.aiUses <= 0 ? 'Limit audytu AI wyczerpany na dziś' : 'Uruchom Potrójną Pętlę Audytorską'}
            </button>
          </div>
        )}

        {/* Stan ładowania */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-ink">Audyt AI 360° w toku...</h3>
              <p className="text-xs text-muted max-w-sm mt-1">
                Model przetwarza profil przez filtry ATS, skan rekruterski i weryfikator spójności chronologicznej.
              </p>
            </div>
          </div>
        )}

        {/* Stan błędu */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-5 w-5" />
              Wystąpił problem z weryfikacją
            </div>
            <p className="text-xs">{error}</p>
            <button
              type="button"
              onClick={runVerification}
              className="text-xs font-bold underline cursor-pointer"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {/* Wyniki raportu */}
        {report && (
          <div className="space-y-6">
            {/* Karta podsumowania */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-line bg-sunken/40 p-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Werdykt końcowy
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      report.verdict === 'READY_TO_APPLY'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : report.verdict === 'MINOR_IMPROVEMENTS'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {report.verdict === 'READY_TO_APPLY'
                      ? 'Gotowe do Aplikowania'
                      : report.verdict === 'MINOR_IMPROVEMENTS'
                      ? 'Wymaga Drobnych Korekt'
                      : 'Wymaga Istotnych Poprawek'}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink">{report.summary}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {report.overallScore}/100
                  </span>
                  <span className="text-[10px] uppercase font-bold text-muted">Wynik 360°</span>
                </div>
              </div>
            </div>

            {/* Zakładki 3 pętli */}
            <div className="flex border-b border-line gap-2">
              <button
                type="button"
                onClick={() => setActiveLoopTab('ats')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeLoopTab === 'ats'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <Cpu className="h-4 w-4" />
                Pętla 1: ATS ({report.atsLoop.atsScore}%)
              </button>
              <button
                type="button"
                onClick={() => setActiveLoopTab('recruiter')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeLoopTab === 'recruiter'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <Eye className="h-4 w-4" />
                Pętla 2: Rekruter ({report.recruiterLoop.recruiterScore}%)
              </button>
              <button
                type="button"
                onClick={() => setActiveLoopTab('logic')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeLoopTab === 'logic'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <Scale className="h-4 w-4" />
                Pętla 3: Logika i Zgodność ({report.logicComplianceLoop.complianceScore}%)
              </button>
            </div>

            {/* Zawartość wybranej pętli */}
            <div className="space-y-4">
              {activeLoopTab === 'ats' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Rozpoznane słowa kluczowe ATS
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {report.atsLoop.recognizedKeywords.map((kw, i) => (
                          <span key={i} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Brakujące słowa kluczowe w roli
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {report.atsLoop.missingCriticalKeywords.length > 0 ? (
                          report.atsLoop.missingCriticalKeywords.map((kw, i) => (
                            <span key={i} className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">Brak krytycznych braków.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {report.atsLoop.atsFormatRisks.length > 0 && (
                    <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-2">
                      <span className="text-xs font-bold text-ink">Ryzyka formatowania:</span>
                      {report.atsLoop.atsFormatRisks.map((r, i) => (
                        <div key={i} className="text-xs flex items-start gap-2">
                          <span className="font-semibold text-amber-600">[{r.severity}]</span>
                          <span>{r.issue} — <em>{r.fix}</em></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeLoopTab === 'recruiter' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        Mocne punkty profilu
                      </span>
                      <ul className="text-xs text-ink space-y-1">
                        {report.recruiterLoop.strengthsFound.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Wykryte ogólniki lub lanie wody
                      </span>
                      <ul className="text-xs text-ink space-y-1">
                        {report.recruiterLoop.weaknessesOrFluff.length > 0 ? (
                          report.recruiterLoop.weaknessesOrFluff.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))
                        ) : (
                          <li className="text-muted">Profil wolny od banałów.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-sunken/40 p-4 flex items-center justify-between text-xs">
                    <span className="text-muted">Wskaźnik mierzalnych osiągnięć (liczby, %, skale):</span>
                    <span className="font-bold text-ink">{report.recruiterLoop.achievementMetricRatePct}% punktów</span>
                  </div>
                </div>
              )}

              {activeLoopTab === 'logic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-indigo-600" />
                        Oś czasu i chronologia
                      </span>
                      <p className="text-xs">
                        {report.logicComplianceLoop.chronologyValid ? (
                          <span className="text-emerald-600 font-medium">Daty zatrudnienia i edukacji są spójne.</span>
                        ) : (
                          <span className="text-rose-600 font-medium">Wykryto nieścisłości w chronologii!</span>
                        )}
                      </p>
                      {report.logicComplianceLoop.timelineAnomalies.map((a, i) => (
                        <p key={i} className="text-xs text-muted">• {a}</p>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Zgodność RODO i prywatność
                      </span>
                      <p className="text-xs text-emerald-600 font-medium">
                        {report.logicComplianceLoop.rodoCompliant ? 'Klauzula zgodna z RODO.' : 'Brak klauzuli RODO!'}
                      </p>
                      {report.logicComplianceLoop.privacyRisks.map((p, i) => (
                        <p key={i} className="text-xs text-amber-600">• {p}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rekomendacje działań */}
            {report.actionableRecommendations.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Zalecane natychmiastowe poprawki
                </h4>
                <div className="space-y-2">
                  {report.actionableRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-line bg-surface p-3.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{rec.title}</span>
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-muted">{rec.description}</p>
                      {rec.suggestedFix && (
                        <p className="text-indigo-600 dark:text-indigo-400 font-medium pt-1">
                          Sugerowane rozwiązanie: {rec.suggestedFix}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
