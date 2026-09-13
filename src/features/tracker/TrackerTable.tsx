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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobApplication } from './ApplicationModal';
import { StatusSelect, ApplicationStatus } from './StatusSelect';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

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
  className?: string;
}

export const TrackerTable: React.FC<TrackerTableProps> = ({
  applications,
  highlightApplicationId = null,
  onStatusChange,
  onEdit,
  onDelete,
  onOpenNotes,
  onViewDocument,
  className = '',
}) => {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Brak aplikacji w tej kategorii"
        description="Nie znaleziono żadnych zgłoszeń odpowiadających wybranemu filtrowi. Dodaj aplikację przyciskiem powyżej albo zapisz dopasowaną ofertę z sekcji APLIKUJ."
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Table Header (Desktop) */}
      <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
        <div className="col-span-3">Firma</div>
        <div className="col-span-3">Stanowisko</div>
        <div className="col-span-2">Widełki</div>
        <div className="col-span-1 text-center">Data</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-1 text-right">Akcje</div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {applications.map((app) => {
            const initial = app.company.charAt(0).toUpperCase();
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
                {/* 1. Company */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-sunken font-sans text-xs font-extrabold text-ink group-hover:border-brand-500/40">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <span className="truncate font-sans text-sm font-bold text-ink block">
                      {app.company}
                    </span>
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
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
                    {app.position}
                  </span>
                  {app.documentSnapshot?.exportedCv && (
                    <span className="mt-1 inline-flex max-w-full truncate rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-fg">
                      CV: {app.documentSnapshot.exportedCv.templateName}
                    </span>
                  )}
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
                    aria-label={`Podgląd dokumentu: ${app.company}`}
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
                    aria-label={`${app.notes ? 'Zobacz notatki' : 'Dodaj notatkę'}: ${app.company}`}
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
                    aria-label={`Edytuj zgłoszenie: ${app.company}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => onDelete(app.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger-fg"
                    title="Usuń zgłoszenie"
                    aria-label={`Usuń zgłoszenie: ${app.company}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
