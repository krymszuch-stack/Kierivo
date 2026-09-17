import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  ArrowUpDown,
  Briefcase,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ApplicationModal } from './ApplicationModal';
import { ApplicationStatus, JobApplication, MasterVault } from '../../types';
import { useApplications } from '../../store/useApplications';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/useToastStore';
import { InterviewPanel } from '../pipeline/InterviewPanel';
import { TrackerTable } from './TrackerTable';
import { StatTile } from '../../components/ui/StatTile';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { HistoricalDocumentModal } from './HistoricalDocumentModal';
import { Tooltip } from '../../components/ui/Tooltip';
import { StorageKeys, readRaw, writeRaw } from '../../lib/storage';
import { getPipelineFilters, matchesStatusFilter } from './trackerStatusConfig';


/**
 * Tracker startuje pusty.
 *
 * Wcześniej wstawiał tu cztery wymyślone aplikacje — z nazwami firm, widełkami
 * i notatkami z rozmów, których nikt nigdy nie odbył. Ten sam problem został
 * już raz usunięty z parserów; tracker wtedy przeoczono. Wymyślone dane
 * w działającym ekranie zostają wymyślonymi danymi, a użytkownik nie ma jak
 * odróżnić ich od własnych.
 *
 * Pusty stan obsługuje `TrackerTable`.
 *
 * Lista nie jest już prywatnym stanem tego komponentu — siedzi w
 * `useApplications`, bo tych samych danych potrzebują silnik „następnego kroku"
 * i mechanizm odblokowań. Tutaj zostaje wyłącznie filtrowanie i widok.
 */

export interface ApplicationTrackerProps {
  vault: MasterVault;
  /** Czy Zasobnik Rozmowy jest już dostępny (progresywne odsłanianie). */
  interviewToolboxUnlocked?: boolean;
  showShortcutsHint?: boolean;
  onDismissShortcutsHint?: () => void;
}

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({
  vault,
  interviewToolboxUnlocked = false,
  showShortcutsHint = false,
  onDismissShortcutsHint,
}) => {
  const {
    applications,
    saveApplication,
    removeApplication,
    patchApplication,
    setStatus,
    hasUnassignedLegacyApplications,
    claimLegacyApplications,
  } = useApplications();
  const {
    highlightedApplicationId,
    setHighlightedApplicationId,
  } = useAppStore();

  // Rekomendacja „następnego kroku" wskazała tę aplikację — podświetl jej
  // wiersz na chwilę po wejściu, żeby użytkownik nie szukał jej w tabeli.
  // Podświetlenie gaśnie samo: to wskazówka, nie stan.
  const [flashId, setFlashId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightedApplicationId) return;
    setFlashId(highlightedApplicationId);
    setHighlightedApplicationId(null);
    const timer = setTimeout(() => setFlashId(null), 5000);
    return () => clearTimeout(timer);
  }, [highlightedApplicationId, setHighlightedApplicationId]);

  /** Tryb zaawansowany pipeline (pełne granularne rozbicie statusów i kolumn). */
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(() => {
    return readRaw(StorageKeys.pipelineAdvancedMode) === 'true';
  });

  const handleToggleAdvancedMode = () => {
    setIsAdvancedMode((prev) => {
      const next = !prev;
      writeRaw(StorageKeys.pipelineAdvancedMode, String(next));
      return next;
    });
  };

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'COMPANY'>('DATE_DESC');

  // Modals
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [viewingDocApp, setViewingDocApp] = useState<JobApplication | null>(null);

  // Notes Drawer/Modal
  const [notesApp, setNotesApp] = useState<JobApplication | null>(null);
  const [currentNotes, setCurrentNotes] = useState<string>('');

  // Statistics
  const totalApps = applications.length;
  const inInterviews = applications.filter((a) => a?.status === 'Rozmowa').length;
  const offersReceived = applications.filter((a) => a?.status === 'Oferta').length;
  const exportedCvCount = applications.filter((a) => a?.documentSnapshot?.exportedCv).length;
  const responseRate = totalApps > 0 ? Math.round(((inInterviews + offersReceived) / totalApps) * 100) : 0;

  // Filtry dostosowane do trybu: na starcie 4 zredukowane stany, w zaawansowanym pełne rozbicie
  const filterButtons = useMemo(() => {
    return getPipelineFilters(applications, isAdvancedMode);
  }, [applications, isAdvancedMode]);

  // Jeśli filtr nie istnieje po przełączeniu trybu, zresetuj do ALL
  useEffect(() => {
    const exists = filterButtons.some((b) => b.id === filterStatus);
    if (!exists && filterStatus !== 'ALL') {
      setFilterStatus('ALL');
    }
  }, [filterButtons, filterStatus]);

  // Filtered and Sorted
  const filteredApps = useMemo(() => {
    return applications
      .filter((app) => {
        if (!app) return false;
        if (!matchesStatusFilter(app.status, filterStatus, isAdvancedMode)) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          return (
            (app.company && app.company.toLowerCase().includes(query)) ||
            (app.position && app.position.toLowerCase().includes(query)) ||
            (app.notes && app.notes.toLowerCase().includes(query))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_DESC') return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        if (sortBy === 'DATE_ASC') return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
        if (sortBy === 'COMPANY') return (a.company || '').localeCompare(b.company || '');
        return 0;
      });
  }, [applications, filterStatus, searchQuery, sortBy, isAdvancedMode]);

  const handleStatusChange = (id: string, newStatus: ApplicationStatus) => {
    setStatus(id, newStatus);
  };

  const handleSaveApp = (app: JobApplication) => {
    saveApplication(app);
    showToast('Lista aplikacji zaktualizowana', {
      message: `${app.company || ''} — ${app.position || ''} (${app.status || ''}).`,
    });
  };

  const handleDeleteApp = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę aplikację z listy?')) {
      const removed = applications.find((entry) => entry.id === id);
      removeApplication(id);
      showToast('Zgłoszenie usunięte', {
        message: removed ? `${removed.company} — ${removed.position}.` : undefined,
      });
    }
  };

  const handleOpenNotes = (app: JobApplication) => {
    setNotesApp(app);
    setCurrentNotes(app.notes || '');
  };

  const handleSaveNotes = () => {
    if (!notesApp) return;
    patchApplication(notesApp.id, { notes: currentNotes });
    setNotesApp(null);
    showToast('Notatka zapisana', { message: `${notesApp.company} — ${notesApp.position}.` });
  };

  const handleClaimLegacyApplications = () => {
    if (
      !window.confirm(
        'Przypisać starszą historię aplikacji do bieżącego profilu? Wybierz tę opcję tylko, jeśli rozpoznajesz te dane jako swoje.'
      )
    ) {
      return;
    }

    const claimed = claimLegacyApplications();
    if (claimed > 0) {
      showToast('Historia została przypisana', {
        message: `Przeniesiono ${claimed} ${claimed === 1 ? 'zgłoszenie' : 'zgłoszeń'} do bieżącego profilu.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje aplikacje"
        description="Masz tu wysłane CV, etapy rekrutacji i notatki z rozmów — spokojnie, żadna oferta nie wyparuje w kosmos."
        badge="Lista aplikacji"
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => {
              setEditingApp(null);
              setIsAppModalOpen(true);
            }}
          >
            Dodaj Aplikację
          </Button>
        }
      />

      {hasUnassignedLegacyApplications && (
        <Card tone="raised" className="border-l-4 border-l-amber-500">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Wykryto starszą historię aplikacji</h2>
              <p className="mt-1 text-sm text-muted">
                Dane z wcześniejszej wersji nie są automatycznie pokazywane w profilu. Przypisz je tylko, jeśli są Twoje.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleClaimLegacyApplications}>
              Przypisz do bieżącego profilu
            </Button>
          </div>
        </Card>
      )}

      {/* Zasobnik Rozmowy — nad tabelą, bo gdy rozmowa jest umówiona, to ona
          jest najważniejszą rzeczą na tym ekranie. Sam się nie pokaże, dopóki
          żadna aplikacja nie ma statusu „Rozmowa". */}
      {interviewToolboxUnlocked && (
        <InterviewPanel
          applications={applications}
          vault={vault}
          onPatch={patchApplication}
          showShortcutsHint={showShortcutsHint}
          onDismissShortcutsHint={onDismissShortcutsHint}
        />
      )}

      {/* KPI Top Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          label="Zgłoszenia"
          value={totalApps}
          icon={Briefcase}
          subtext="Wszystkie w bazie"
        />

        <StatTile
          label="Rozmowy"
          value={inInterviews}
          icon={TrendingUp}
          subtext="Aktywne etapy"
        />

        <StatTile
          label="Otrzymane Oferty"
          value={offersReceived}
          icon={Award}
          subtext="Końcowe propozycje"
        />

        <StatTile
          label="Response Rate"
          value={`${responseRate}%`}
          icon={CheckCircle2}
          subtext="Wskaźnik odzewu"
        />

        <StatTile
          label="CV przy aplikacji"
          value={exportedCvCount}
          icon={FileText}
          subtext="Wyeksportowane warianty"
        />
      </div>

      {/* Control Bar: Filters, Search, Sort */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Gmail/Linear Style Filter Pills + Advanced Mode Toggle */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterButtons.map((btn) => (
              <Tooltip key={btn.id} content={btn.tooltip} side="top">
                <button
                  type="button"
                  onClick={() => setFilterStatus(btn.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
                    filterStatus === btn.id
                      ? 'bg-brand-600 text-on-brand shadow-xs'
                      : 'border border-line bg-sunken text-muted hover:border-brand-300 hover:text-ink'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-px font-mono text-[10px] ${
                      filterStatus === btn.id ? 'bg-surface/30 text-on-brand' : 'bg-surface text-muted'
                    }`}
                  >
                    {btn.count}
                  </span>
                </button>
              </Tooltip>
            ))}

            {/* Przełącznik konfiguracji zaawansowanej (pełne rozbicie statusów i kolumn) */}
            <Tooltip
              content={
                isAdvancedMode
                  ? 'Konfiguracja zaawansowana jest aktywna (pełne rozbicie statusów i kolumn). Kliknij, aby powrócić do widoku 4 kluczowych stanów.'
                  : 'Widok startowy zredukowany do 4 kluczowych stanów. Kliknij, aby włączyć konfigurację zaawansowaną (Rozmowa, Oferta, Odrzucona).'
              }
              side="top"
            >
              <button
                type="button"
                onClick={handleToggleAdvancedMode}
                aria-pressed={isAdvancedMode}
                aria-label="Przełącz konfigurację zaawansowaną pipeline"
                className={`ml-1 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all focus-visible:outline-none ${
                  isAdvancedMode
                    ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-xs'
                    : 'border-line bg-sunken text-muted hover:border-brand-300 hover:text-ink'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{isAdvancedMode ? 'Szczegółowy' : '4 etapy'}</span>
              </button>
            </Tooltip>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2">
            <Input
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj firmy lub roli..."
              containerClassName="w-48 sm:w-64"
            />

            <select
              aria-label="Sortowanie aplikacji"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-line bg-sunken px-3 py-2 font-mono text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="DATE_DESC">Najnowsze</option>
              <option value="DATE_ASC">Najstarsze</option>
              <option value="COMPANY">Firma A-Z</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table View */}
      <TrackerTable
        applications={filteredApps}
        highlightApplicationId={flashId}
        isAdvancedMode={isAdvancedMode}
        onStatusChange={handleStatusChange}
        onEdit={(app) => {
          setEditingApp(app);
          setIsAppModalOpen(true);
        }}
        onDelete={handleDeleteApp}
        onOpenNotes={handleOpenNotes}
        onViewDocument={(app) => setViewingDocApp(app)}
      />

      {/* Create / Edit Application Modal */}
      <ApplicationModal
        isOpen={isAppModalOpen}
        onClose={() => {
          setIsAppModalOpen(false);
          setEditingApp(null);
        }}
        onSave={handleSaveApp}
        initialData={editingApp}
      />

      {/* Historical Document Snapshot Modal (BUG-002) */}
      <HistoricalDocumentModal
        application={viewingDocApp}
        isOpen={Boolean(viewingDocApp)}
        onClose={() => setViewingDocApp(null)}
      />

      {/* Notes Modal */}
      {notesApp && (
        <Modal
          isOpen={Boolean(notesApp)}
          onClose={() => setNotesApp(null)}
          title={`Notatki Rekrutacyjne: ${notesApp.company} (${notesApp.position})`}
          size="md"
        >
          <div className="space-y-4">
            <Textarea
              label="Zapiski z rozmów technicznych, pytania i ustalenia finansowe"
              rows={6}
              value={currentNotes}
              onChange={(e) => setCurrentNotes(e.target.value)}
              placeholder="Wpisz notatki z rozmów rekrutacyjnych..."
            />

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="ghost" size="sm" onClick={() => setNotesApp(null)}>
                Anuluj
              </Button>

              <Button variant="primary" size="md" onClick={handleSaveNotes}>
                Zapisz Notatkę
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
