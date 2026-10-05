import React from 'react';
import {
  Building2,
  ExternalLink,
  Edit2,
  Trash2,
  FileText,
  Calendar,
  DollarSign,
  Briefcase,
  Eye,
  BookOpen,
  Plus,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobApplication } from './ApplicationModal';
import { StatusSelect, ApplicationStatus } from './StatusSelect';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { getApplicationDisplayInfo } from './applicationDisplay';
import { normalizeExternalHttpUrl } from '../../lib/externalHttpUrl';

export interface TrackerTableProps {
  applications: JobApplication[];
  /**
   * Wiersz do chwilowego podświetlenia — rekomendacja „następnego kroku"
   * prowadzi tu prosto do konkretnej aplikacji.
   */
  highlightApplicationId?: string | null;
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
  onEdit: (app: JobApplication) => void;
  onDelete: (id: string) => void;
  onOpenNotes: (app: JobApplication) => void;
  onViewDocument: (app: JobApplication) => void;
  onOpenCheatSheet: (app: JobApplication) => void;
  className?: string;
  /** Czy pokazywać pełną siatkę kolumn zaawansowanych, czy zredukowany widok na start */
  isAdvancedMode?: boolean;
}

export const TrackerTable: React.FC<TrackerTableProps> = ({
  applications,
  highlightApplicationId = null,
  onStatusChange,
  onEdit,
  onDelete,
  onOpenNotes,
  onViewDocument,
  onOpenCheatSheet,
  className = '',
  isAdvancedMode = false,
}) => {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Jeszcze nic tu nie ma."
        description="Gdy dodasz ofertę i wyślesz CV, Kierivo będzie śledzić cały proces krok po kroku."
        action={
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => window.dispatchEvent(new CustomEvent('cvelocity:navigate', { detail: 'aplikuj' }))}
            className="cursor-pointer font-bold"
          >
            Dodaj pierwszą ofertę
          </Button>
        }
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Table Header (Desktop) */}
      {isAdvancedMode ? (
        <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
          <div className="col-span-3">Firma</div>
          <div className="col-span-3">Stanowisko</div>
          <div className="col-span-2">Widełki</div>
          <div className="col-span-1 text-center">Data</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-right">Akcje</div>
        </div>
      ) : (
        <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
          <div className="col-span-5">Firma i Stanowisko</div>
          <div className="col-span-3">Wynagrodzenie & Data</div>
          <div className="col-span-3 text-center">Status</div>
          <div className="col-span-1 text-right">Akcje</div>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {applications.map((app) => {
            const safeJobUrl = normalizeExternalHttpUrl(app.jobUrl);
            const {
              companyMissing: companyIsPlaceholder,
              companyLabel,
              positionLabel,
              applicationLabel,
              initial,
            } = getApplicationDisplayInfo(app);
            const isHighlighted = app.id === highlightApplicationId;

            return (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
                className={`group flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition-all duration-200 hover:border-brand-300 hover:bg-elevated hover:shadow-raised lg:grid lg:grid-cols-12 lg:items-center ${
                  isHighlighted
                    ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/30'
                    : 'border-line bg-surface'
                }`}
              >
                {/* WIDOK ZAAWANSOWANY (6 oddzielnych kolumn) */}
                {isAdvancedMode ? (
                  <>
                    {/* 1. Company */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-sunken font-sans text-xs font-extrabold text-ink group-hover:border-brand-500/40">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate font-sans text-sm font-bold text-ink block">
                          {companyLabel}
                        </span>
                        {safeJobUrl && (
                          <a
                            href={safeJobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-muted hover:text-brand-fg"
                          >
                            <span>Link do oferty</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 2. Position */}
                    <div className="col-span-3 min-w-0">
                      <span className="truncate text-xs font-semibold text-ink/90 block">
                        {positionLabel}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {app.documentSnapshot?.exportedCv && (
                          <span className="inline-flex max-w-full truncate rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-fg">
                            CV: {app.documentSnapshot.exportedCv.templateName}
                          </span>
                        )}
                        {app.documentSnapshot?.jobOfferSnapshot.description?.trim() && (
                          <button
                            type="button"
                            onClick={() => onOpenCheatSheet(app)}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50/60 px-1.5 py-0.5 text-[10px] font-semibold text-brand-fg hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                            aria-label={`Otwórz ściągę na rozmowę: ${positionLabel || companyLabel}`}
                          >
                            <BookOpen className="h-3 w-3" /> Ściąga
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3. Salary */}
                    <div className="col-span-2">
                      <span className="inline-block rounded-lg border border-line/60 bg-sunken px-2.5 py-1 font-mono text-[11px] font-bold text-ink">
                        {app.salary || 'Do negocjacji'}
                      </span>
                    </div>

                    {/* 4. Date */}
                    <div className="col-span-1 text-left lg:text-center">
                      <span className="font-mono text-xs text-muted">{app.date}</span>
                    </div>

                    {/* 5. Status Select */}
                    <div className="col-span-2 flex justify-start lg:justify-center">
                      <StatusSelect
                        status={app.status}
                        onChange={(newStatus) => onStatusChange(app.id, newStatus)}
                      />
                    </div>
                  </>
                ) : (
                  /* WIDOK UPROSZCZONY (4 czytelne grupy kolumn: Firma/Rola, Warunki/Data, Status, Akcje) */
                  <>
                    {/* 1. Firma i Stanowisko (col-span-5) */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-sunken font-sans text-xs font-extrabold text-ink group-hover:border-brand-500/40">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-sans text-sm font-bold text-ink">
                            {companyLabel}
                          </span>
                          {safeJobUrl && (
                            <a
                              href={safeJobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-muted hover:text-brand-fg"
                              title="Otwórz link do ogłoszenia"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted font-medium">
                            {positionLabel}
                          </span>
                          {app.documentSnapshot?.exportedCv && (
                            <span className="inline-flex truncate rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-fg">
                              CV: {app.documentSnapshot.exportedCv.templateName}
                            </span>
                          )}
                          {app.documentSnapshot?.jobOfferSnapshot.description?.trim() && (
                            <button
                              type="button"
                              onClick={() => onOpenCheatSheet(app)}
                              className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50/60 px-1.5 py-0.5 text-[10px] font-semibold text-brand-fg hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                              aria-label={`Otwórz ściągę na rozmowę: ${positionLabel || companyLabel}`}
                            >
                              <BookOpen className="h-3 w-3" /> Ściąga
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. Wynagrodzenie i Data (col-span-3) */}
                    <div className="col-span-3 flex flex-col justify-center">
                      <span className="inline-block self-start rounded-lg border border-line/60 bg-sunken px-2.5 py-1 font-mono text-[11px] font-bold text-ink">
                        {app.salary || 'Do negocjacji'}
                      </span>
                      <span className="mt-1 font-mono text-[10px] text-muted">
                        Zgłoszenie: {app.date}
                      </span>
                    </div>

                    {/* 3. Status z opisem (col-span-3) */}
                    <div className="col-span-3 flex justify-start lg:justify-center">
                      <StatusSelect
                        status={app.status}
                        onChange={(newStatus) => onStatusChange(app.id, newStatus)}
                      />
                    </div>
                  </>
                )}

                {/* 6. Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {/* View Document Button */}
                  <button
                    type="button"
                    onClick={() => onViewDocument(app)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                      app.documentSnapshot
                        ? 'border-brand-300 bg-brand-50/70 text-brand-600 hover:bg-brand-100 hover:text-brand-700'
                        : 'border-line text-muted hover:bg-surface hover:text-ink'
                    }`}
                    title={
                      app.documentSnapshot
                        ? 'Podgląd wysłanego CV i dokumentów'
                        : 'Brak zapisanego snapshotu dokumentu'
                    }
                    aria-label={`Podgląd dokumentu: ${applicationLabel}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>

                  {/* Notes Button */}
                  <button
                    type="button"
                    onClick={() => onOpenNotes(app)}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface hover:text-ink ${
                      app.notes ? 'text-brand-fg bg-brand-50/50 border-brand-200' : ''
                    }`}
                    title={app.notes ? 'Zobacz notatki' : 'Dodaj notatkę'}
                    aria-label={`${app.notes ? 'Zobacz notatki' : 'Dodaj notatkę'}: ${applicationLabel}`}
                  >
                    <FileText className="h-4 w-4" />
                    {app.notes && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-600" />
                    )}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onEdit(app)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface hover:text-ink"
                    title="Edytuj zgłoszenie"
                    aria-label={`Edytuj zgłoszenie: ${applicationLabel}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => onDelete(app.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger-fg"
                    title="Usuń zgłoszenie"
                    aria-label={`Usuń zgłoszenie: ${applicationLabel}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Timeline procesu rekrutacyjnego (CRM) */}
                <div className="col-span-12 border-t border-line/50 pt-2 pb-0.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted">
                  <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                    <span className="flex items-center gap-1 text-ink font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      Oferta dodana
                    </span>
                    <span className="text-line-strong">→</span>
                    <span className={`flex items-center gap-1 ${app.documentSnapshot ? 'text-ink font-semibold' : 'text-muted'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${app.documentSnapshot ? 'bg-brand-500' : 'bg-line-strong'}`} />
                      CV przygotowane
                    </span>
                    <span className="text-line-strong">→</span>
                    <span className={`flex items-center gap-1 ${app.status !== 'Do wysłania' ? 'text-ink font-semibold' : 'text-muted'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${app.status !== 'Do wysłania' ? 'bg-brand-500' : 'bg-line-strong'}`} />
                      Aplikacja wysłana
                    </span>
                    <span className="text-line-strong">→</span>
                    <span className={`flex items-center gap-1 ${app.status === 'Rozmowa' || app.status === 'Oferta' ? 'text-brand-fg font-bold' : 'text-muted'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${app.status === 'Rozmowa' || app.status === 'Oferta' ? 'bg-amber-500' : 'bg-line-strong'}`} />
                      Rozmowa
                    </span>
                    <span className="text-line-strong">→</span>
                    <span className={`flex items-center gap-1 ${app.status === 'Oferta' ? 'text-success-fg font-bold' : 'text-muted'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${app.status === 'Oferta' ? 'bg-success' : 'bg-line-strong'}`} />
                      Oferta pracy
                    </span>
                  </div>

                  <span className="text-subtle font-mono text-[9px]">
                    {app.updatedAt ? `Aktualizacja: ${app.updatedAt.slice(0, 10)}` : `Zgłoszenie: ${app.date}`}
                  </span>
                </div>

                {/* Progresywne odsłanianie treningu, gdy aplikacja wchodzi w etap Rozmowa */}
                {app.status === 'Rozmowa' && (
                  <div className="col-span-12 rounded-xl border border-brand-500/30 bg-brand-500/[0.04] p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-ink flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-brand-fg" />
                        Masz zaplanowaną rozmowę w {companyLabel}?
                      </span>
                      <span className="text-muted block text-[11px]">
                        Przygotujemy: prawdopodobne pytania, odpowiedzi STAR oparte na Twoim doświadczeniu i pytania techniczne.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Sparkles}
                      onClick={() => onOpenCheatSheet(app)}
                      className="font-bold shrink-0 cursor-pointer text-xs"
                    >
                      Rozpocznij trening →
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
