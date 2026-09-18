import React, { useState } from 'react';
import {
  Clock,
  ExternalLink,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
  Building2,
  Award,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { KnowledgeMaterial } from '../../data/careerKnowledge';

export interface MaterialDetailModalProps {
  material: KnowledgeMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlan: (material: KnowledgeMaterial) => void;
  isAlreadyInPlan: boolean;
}

export const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({
  material,
  isOpen,
  onClose,
  onAddToPlan,
  isAlreadyInPlan,
}) => {
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportNote, setReportNote] = useState('');

  if (!material) return null;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitted(true);
    setIsReporting(false);
  };

  const isPathway = material.type === 'pathway';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material.title}
      description={material.snippet}
      size="xl"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="text-xs text-muted font-mono flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{material.readTime}</span>
            <span>•</span>
            <span className="font-semibold text-ink">{material.difficulty}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant={isAlreadyInPlan ? 'secondary' : 'primary'}
              size="md"
              icon={isAlreadyInPlan ? CheckCircle2 : PlusCircle}
              onClick={() => onAddToPlan(material)}
              className="w-full sm:w-auto cursor-pointer"
            >
              {isAlreadyInPlan ? 'W Twoim planie nauki' : 'Dodaj do mojego planu'}
            </Button>
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-ink">
        {/* Tagi i metadane nagłówka */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand-500/10 text-brand-600 px-2.5 py-1 text-xs font-bold font-mono">
            {material.seriesTitle}
          </span>
          <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted font-medium">
            Poziom: <strong>{material.entryLevelLabel}</strong>
          </span>
          {material.estimatedDuration && (
            <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted font-medium">
              Czas nauki: <strong>{material.estimatedDuration}</strong>
            </span>
          )}
        </div>

        {/* Specjalna karta dla Ścieżki Zawodowej */}
        {isPathway && (
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Podsumowanie ścieżki zawodowej
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {material.learningMethods && material.learningMethods.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted flex items-center gap-1.5 font-medium">
                    <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
                    Możliwe rodzaje nauki:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {material.learningMethods.map((m, i) => (
                      <span key={i} className="rounded bg-surface px-2 py-0.5 border border-line text-ink font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {material.possibleLicenses && material.possibleLicenses.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted flex items-center gap-1.5 font-medium">
                    <Award className="w-3.5 h-3.5 text-brand-600" />
                    Możliwe uprawnienia lub dokumenty:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {material.possibleLicenses.map((lic, i) => (
                      <span key={i} className="rounded bg-surface px-2 py-0.5 border border-line text-ink font-medium">
                        {lic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {material.initialRoles && material.initialRoles.length > 0 && (
                <div className="col-span-full space-y-1">
                  <span className="text-muted flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-brand-600" />
                    Przykładowe stanowiska początkowe:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {material.initialRoles.map((role, i) => (
                      <span key={i} className="rounded-lg bg-surface px-2.5 py-1 border border-line text-ink font-medium text-xs">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-[11px] text-muted border-t border-brand-500/20 pt-2 flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>Sprawdź aktualne wymagania w lokalnych ogłoszeniach — warunki zależą od regionu i pracodawcy.</span>
            </div>
          </div>
        )}

        {/* 9-PUNKTOWA ZUNIFIKOWANA STRUKTURA */}
        <div className="space-y-5 divide-y divide-line/60">
          {/* 1. Dla kogo jest ten materiał */}
          <section className="pt-3 first:pt-0 space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">1</span>
              Dla kogo jest ten materiał
            </h3>
            <p className="text-xs sm:text-sm text-ink leading-relaxed">
              {material.structure.targetAudience}
            </p>
          </section>

          {/* 2. Czego można się nauczyć */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">2</span>
              Czego można się nauczyć
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.whatYouWillLearn.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success-fg shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Jakie wymagania pojawiają się najczęściej */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">3</span>
              Często spotykane wymagania
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.commonRequirements.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-brand-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4. Gdzie można zdobyć wiedzę lub kwalifikację */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">4</span>
              Gdzie można zdobyć wiedzę lub kwalifikację
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.whereToLearn.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5. Ile czasu i zaangażowania może wymagać nauka */}
          <section className="pt-4 space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">5</span>
              Czas i zaangażowanie
            </h3>
            <p className="text-xs sm:text-sm text-ink leading-relaxed">
              {material.structure.timeAndCommitment}
            </p>
          </section>

          {/* 6. Jak sprawdzić jakość kursu, szkoły albo organizatora */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">6</span>
              Jak sprawdzić jakość kursu lub szkoły
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.howToCheckQuality.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning-fg shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 7. Jakie stanowiska można rozważyć po drodze */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">7</span>
              Stanowiska i role do rozważenia po drodze
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.entryRolesAlongTheWay.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8. Jak przygotować CV pod ten kierunek */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center">8</span>
              Jak przygotować CV pod ten kierunek
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink">
              {material.structure.howToPrepareCv.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 9. Jaki jest jeden konkretny następny krok */}
          <section className="pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">9</span>
              Jeden konkretny następny krok
            </h3>
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-3.5 flex items-start gap-2.5">
              <ArrowRight className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm font-semibold text-ink leading-snug">
                {material.structure.concreteNextStep}
              </div>
            </div>
          </section>
        </div>

        {/* METADANE WIARYGODNOŚCI I OFICJALNE ŹRÓDŁA */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted">
              <Calendar className="w-3.5 h-3.5" />
              <span>Ostatnia aktualizacja: <strong className="text-ink">{material.officialSource.lastUpdated}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Źródło:</span>
              <a
                href={material.officialSource.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-600 hover:underline inline-flex items-center gap-1"
              >
                {material.officialSource.sourceName}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="text-[11px] text-muted border-t border-line/60 pt-2 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
            <span>{material.officialSource.regionalNotice}</span>
          </div>

          {/* Przycisk Zgłoś nieaktualną informację */}
          <div className="pt-1">
            {reportSubmitted ? (
              <div className="text-xs text-success-fg flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dziękujemy! Twoje zgłoszenie zostało zarejestrowane i zweryfikujemy ten materiał.
              </div>
            ) : isReporting ? (
              <form onSubmit={handleReportSubmit} className="space-y-2 pt-1">
                <textarea
                  rows={2}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Opisz, co się zmieniło (np. link nie działa, zmieniły się przepisy lub opłata egzaminacyjna)..."
                  className="w-full text-xs rounded-xl border border-line bg-sunken p-2.5 text-ink focus:outline-none focus:border-brand-500"
                  required
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" variant="primary" icon={Send}>
                    Wyślij zgłoszenie
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsReporting(false)}>
                    Anuluj
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsReporting(true)}
                className="text-[11px] text-muted hover:text-ink underline cursor-pointer"
              >
                Zgłoś nieaktualną informację
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
