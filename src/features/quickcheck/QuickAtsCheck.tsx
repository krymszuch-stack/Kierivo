import React, { useRef, useState } from 'react';
import {
  Gauge,
  UploadCloud,
  FileText,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  MonitorSmartphone,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { extractTextFromAnyFile } from '../../lib/cvUniversalParser';
import { runQuickAtsCheck, QuickCheckError, type QuickCheckResult, getQuickCheckScoreTone } from '../../lib/quickAtsCheck';
import { showToast } from '../../store/useToastStore';
import { MasterVault } from '../../types';

export interface QuickAtsCheckProps {
  onSaveProfile: (vault: MasterVault) => void;
  onOpenEditor: (vault: MasterVault) => void;
  className?: string;
}

export const QuickAtsCheck: React.FC<QuickAtsCheckProps> = ({
  onSaveProfile,
  onOpenEditor,
  className = '',
}) => {
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [cvFormat, setCvFormat] = useState('TXT');
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [error, setError] = useState<{ message: string; field: 'cv' | 'jd' } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReadingFile(true);
    setError(null);

    try {
      const { text, format } = await extractTextFromAnyFile(file);
      setCvText(text);
      setCvFormat(format);
      showToast('Wczytano CV', {
        message: `Plik odczytany w przeglądarce (${format}). Nie został nigdzie wysłany.`,
        variant: 'success',
      });
    } catch {
      setError({
        message: 'Nie udało się odczytać tego pliku. Skopiuj treść CV i wklej ją poniżej.',
        field: 'cv',
      });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleCheck = () => {
    setError(null);
    try {
      setResult(runQuickAtsCheck(cvText, jdText, { format: cvFormat }));
    } catch (err) {
      if (err instanceof QuickCheckError) {
        setError({ message: err.message, field: err.field });
        setResult(null);
        return;
      }
      throw err;
    }
  };

  const handleReset = () => {
    setCvText('');
    setJdText('');
    setCvFormat('TXT');
    setResult(null);
    setError(null);
  };

  const tone = result ? getQuickCheckScoreTone(result.ats.overallScore) : null;
  const circumference = 2 * Math.PI * 42;

  return (
    <Card variant="elevated" className={`space-y-5 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-grad text-on-brand">
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-ink">Sprawdź dopasowanie CV do ogłoszenia</h2>
        </div>
        <p className="text-xs text-muted">
          Wynik opiera się na treści dokumentu i oferty. Nie jest wynikiem zewnętrznego ATS ani gwarancją przejścia rekrutacji.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="quick-cv" className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <FileText className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              Twoje CV
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingFile}
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-fg hover:underline disabled:opacity-50"
            >
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              {isReadingFile ? 'Wczytywanie…' : 'lub wgraj plik'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.rtf,.txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <Textarea
            id="quick-cv"
            rows={8}
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Wklej treść swojego CV — imię, doświadczenie, umiejętności…"
            className="font-mono text-xs"
            aria-invalid={error?.field === 'cv' || undefined}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="quick-jd" className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Briefcase className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            Ogłoszenie o pracę
          </label>
          <Textarea
            id="quick-jd"
            rows={8}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Wklej treść ogłoszenia, do którego chcesz się dopasować…"
            className="font-mono text-xs"
            aria-invalid={error?.field === 'jd' || undefined}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-xs text-danger-fg">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle">
          <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          To szybkie sprawdzenie liczy się w przeglądarce. CV nie jest wysyłane na serwer.
        </p>
        <div className="flex items-center gap-2">
          {result && (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset}>
              Wyczyść
            </Button>
          )}
          <Button variant="primary" size="md" icon={ArrowRight} iconPosition="right" onClick={handleCheck}>
            Sprawdź dopasowanie
          </Button>
        </div>
      </div>

      {result && tone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.19, 1, 0.22, 1] }}
          className="space-y-4 border-t border-line pt-5"
          data-testid="quick-ats-result"
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="relative h-[104px] w-[104px] shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" className="stroke-line" strokeWidth="8" fill="none" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  className={tone.ring}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference * (1 - result.ats.overallScore / 100) }}
                  transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
                  style={{ strokeDasharray: circumference }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-mono text-2xl font-bold ${tone.text}`}>
                  {result.ats.overallScore}%
                </span>
                <span className="text-[9px] uppercase tracking-wide text-subtle">Dopasowanie</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className={`text-sm font-bold ${tone.text}`}>{tone.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Pokrycie fraz {result.ats.keywordCoverageScore}% · struktura {result.ats.structureScore}% · formatowanie {result.ats.formattingScore}%
                </p>
              </div>

              {result.missingSkills.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-ink">Wykryte braki wobec treści oferty:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.missingSkills.slice(0, 12).map((skill) => (
                      <span key={skill} className="rounded-lg border border-danger/30 bg-danger-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-danger-fg">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-success-fg">Nie wykryliśmy brakujących umiejętności rozpoznanych w ofercie.</p>
              )}
            </div>
          </div>

          {result.knockouts.requirementCount > 0 && (
            <div className="space-y-2.5 border-t border-line/60 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-ink">Wymagania formalne rozpoznane w ofercie</p>
                <span className="font-mono text-[10px] text-subtle">
                  potwierdzone w profilu {result.knockouts.satisfiedCount} z {result.knockouts.requirementCount}
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.knockouts.findings.map((finding) => (
                  <li
                    key={finding.ruleId}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs ${
                      finding.satisfied
                        ? 'border-success/30 bg-success-soft text-success-fg'
                        : 'border-line bg-sunken text-muted'
                    }`}
                  >
                    {finding.satisfied ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-semibold">{finding.label}</p>
                      {!finding.satisfied && finding.hint && <p className="mt-0.5 text-[11px]">{finding.hint}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-line/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-subtle">To wskazówka do redakcji dokumentu, nie prognoza decyzji rekrutera.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onSaveProfile(result.vault)}>
                Zapisz profil na tym urządzeniu
              </Button>
              <Button variant="primary" size="sm" icon={ArrowRight} iconPosition="right" onClick={() => onOpenEditor(result.vault)}>
                Dopracuj CV
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
};
