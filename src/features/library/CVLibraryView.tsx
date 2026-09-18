import React, { useState, useMemo, useCallback } from 'react';
import {
  FolderArchive,
  Download,
  Copy,
  Pencil,
  Trash2,
  X,
  Plus,
  Search,
  FileText,
  Check,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { showToast } from '../../store/useToastStore';
import { downloadSemanticPdf } from '../../lib/semanticPdfExporter';
import {
  getSavedCVs,
  updateCV,
  duplicateCV,
  deleteCV,
  recordDownload,
  PRESET_TAGS,
  type SavedCVDocument,
} from '../../lib/cvLibraryStorage';
import type { NavTabId } from '../../lib/navigation';

export interface CVLibraryViewProps {
  onNavigate?: (tab: NavTabId) => void;
}

/* ─────────────────────── Helpers ─────────────────────── */

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'przed chwilą';
  if (mins < 60) return `${mins} min temu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} dn. temu`;
  return new Date(iso).toLocaleDateString('pl-PL');
}

/* ─────────────────── Tag Badge ─────────────────── */

const TagBadge: React.FC<{
  label: string;
  removable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}> = ({ label, removable, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 cursor-pointer select-none border ${
      selected
        ? 'bg-brand-500/15 text-brand-fg border-brand-500/30'
        : 'bg-surface-alt/60 text-muted border-line/60 hover:bg-surface-alt hover:text-ink'
    }`}
  >
    {label}
    {removable && <X className="h-3 w-3 ml-0.5 opacity-60" />}
  </button>
);

/* ─────────────────── Edit Modal Inline ─────────────────── */

const EditPanel: React.FC<{
  doc: SavedCVDocument;
  onSave: (id: string, title: string, tags: string[]) => void;
  onCancel: () => void;
}> = ({ doc, onSave, onCancel }) => {
  const [title, setTitle] = useState(doc.title);
  const [tags, setTags] = useState<string[]>([...doc.tags]);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setNewTag('');
  };

  return (
    <div className="mt-3 space-y-3 border-t border-line/40 pt-3">
      <div>
        <label className="block text-[11px] font-semibold text-muted mb-1">Tytuł</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-muted mb-1">Tagi</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <TagBadge
              key={t}
              label={t}
              removable
              onClick={() => setTags(tags.filter((x) => x !== t))}
            />
          ))}
        </div>

        {/* Preset tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {PRESET_TAGS.filter((pt) => !tags.includes(pt)).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setTags([...tags, pt])}
              className="text-[10px] rounded-full border border-dashed border-line/60 px-2 py-0.5 text-muted hover:text-ink hover:border-brand-500/30 transition-colors cursor-pointer"
            >
              + {pt}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Własny tag…"
            className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Button size="sm" variant="secondary" onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>Anuluj</Button>
        <Button size="sm" variant="primary" onClick={() => onSave(doc.id, title, tags)}>
          <Check className="h-3.5 w-3.5 mr-1" /> Zapisz
        </Button>
      </div>
    </div>
  );
};

/* ─────────────── CV Card ─────────────── */

const CVCard: React.FC<{
  doc: SavedCVDocument;
  onReExport: (doc: SavedCVDocument) => void;
  onDuplicate: (doc: SavedCVDocument) => void;
  onDelete: (doc: SavedCVDocument) => void;
  onUpdate: () => void;
}> = ({ doc, onReExport, onDuplicate, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSave = (id: string, title: string, tags: string[]) => {
    updateCV(id, { title, tags });
    setIsEditing(false);
    onUpdate();
    showToast('Zaktualizowano', { message: `"${title}" — zapisano zmiany.`, variant: 'success' });
  };

  const handleReExport = async () => {
    setIsExporting(true);
    try {
      await onReExport(doc);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="group rounded-2xl border border-line/60 bg-surface p-4 transition-shadow duration-200 hover:shadow-md hover:border-brand-500/20">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-brand-fg shrink-0" />
            <h3 className="text-sm font-semibold text-ink truncate">{doc.title}</h3>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(doc.updatedAt)}
            </span>
            {doc.targetRole && (
              <span className="truncate max-w-[140px]">{doc.targetRole}</span>
            )}
            {doc.companyName && (
              <span className="truncate max-w-[120px]">{doc.companyName}</span>
            )}
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {doc.downloadCount}×
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Tooltip content="Edytuj tytuł i tagi">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Duplikuj pod nową ofertę">
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(doc)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Usuń z biblioteki">
            <Button size="sm" variant="ghost" onClick={() => onDelete(doc)} className="hover:text-error-fg">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Tags */}
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {doc.tags.map((t) => (
            <TagBadge key={t} label={t} />
          ))}
        </div>
      )}

      {/* Re-export button */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={handleReExport}
          disabled={isExporting}
          className="flex-1"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {isExporting ? 'Generowanie…' : 'Pobierz PDF ponownie'}
        </Button>
        <span className="text-[10px] text-muted whitespace-nowrap">bezpłatnie</span>
      </div>

      {/* Edit panel */}
      {isEditing && <EditPanel doc={doc} onSave={handleSave} onCancel={() => setIsEditing(false)} />}
    </div>
  );
};

/* ─────────────── Main View ─────────────── */

export const CVLibraryView: React.FC<CVLibraryViewProps> = ({ onNavigate }) => {
  const [docs, setDocs] = useState<SavedCVDocument[]>(getSavedCVs);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(() => setDocs(getSavedCVs()), []);

  /* Unique tags across all docs */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    docs.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [docs]);

  /* Filtered list */
  const filtered = useMemo(() => {
    let list = docs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.targetRole?.toLowerCase().includes(q) ||
          d.companyName?.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTags.size > 0) {
      list = list.filter((d) => d.tags.some((t) => selectedTags.has(t)));
    }
    return list;
  }, [docs, searchQuery, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleReExport = async (doc: SavedCVDocument) => {
    try {
      await downloadSemanticPdf({
        vault: doc.vault,
        tailoredResume: doc.tailoredResume,
        theme: doc.theme,
        layout: doc.layout,
        targetPages: doc.targetPages,
        summaryOverride: doc.summaryOverride,
        targetRole: doc.targetRole,
        companyName: doc.companyName,
      });
      recordDownload(doc.id);
      refresh();
      showToast('Pobrano PDF z biblioteki', {
        message: `„${doc.title}" — ponowne pobranie nie zużywa limitu.`,
        variant: 'success',
      });
    } catch (err) {
      showToast('Błąd eksportu', {
        message: err instanceof Error ? err.message : 'Nie udało się wygenerować PDF.',
        variant: 'error',
      });
    }
  };

  const handleDuplicate = (doc: SavedCVDocument) => {
    const cloned = duplicateCV(doc.id);
    if (cloned) {
      refresh();
      showToast('Zduplikowano', {
        message: `„${cloned.title}" — gotowe do edycji pod nową ofertę.`,
        variant: 'success',
      });
    }
  };

  const handleDelete = (doc: SavedCVDocument) => {
    if (confirmDelete !== doc.id) {
      setConfirmDelete(doc.id);
      return;
    }
    deleteCV(doc.id);
    setConfirmDelete(null);
    refresh();
    showToast('Usunięto', { message: `„${doc.title}" — dokument usunięty z biblioteki.`, variant: 'success' });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <FolderArchive className="h-5 w-5 text-brand-fg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink m-0">Biblioteka CV</h2>
            <p className="text-xs text-muted">
              {docs.length === 0
                ? 'Zapisz wygenerowane CV, aby mieć do nich szybki dostęp.'
                : `${docs.length} ${docs.length === 1 ? 'wersja' : docs.length < 5 ? 'wersje' : 'wersji'} · ponowne pobranie jest bezpłatne`}
            </p>
          </div>
        </div>

        {/* Search */}
        {docs.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Szukaj po tytule, firmie, tagu…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        )}
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted mr-1" />
          {allTags.map((tag) => (
            <TagBadge
              key={tag}
              label={tag}
              selected={selectedTags.has(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
          {selectedTags.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags(new Set())}
              className="text-[10px] text-muted hover:text-ink cursor-pointer ml-1"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      )}

      {/* Cards grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <CVCard
              key={doc.id}
              doc={doc}
              onReExport={handleReExport}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onUpdate={refresh}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderArchive className="h-12 w-12 text-muted/30 mb-4" />
          <h2 className="text-sm font-semibold text-ink mb-1">
            {docs.length === 0 ? 'Biblioteka jest pusta' : 'Brak wyników'}
          </h2>
          <p className="text-xs text-muted max-w-xs">
            {docs.length === 0
              ? 'Po wygenerowaniu CV w zakładce „Sprawdź dopasowanie" możesz zapisać dokument tutaj, by wrócić do niego później.'
              : 'Spróbuj zmienić filtry lub wyszukaj innymi słowami.'}
          </p>
          {docs.length === 0 && onNavigate && (
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => onNavigate('aplikuj')}
            >
              Przejdź do kreatora CV
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl border border-line shadow-xl p-5 max-w-sm w-full mx-4 space-y-3">
            <h3 className="text-sm font-bold text-ink">Potwierdź usunięcie</h3>
            <p className="text-xs text-muted">
              Czy na pewno chcesz usunąć ten dokument z biblioteki? Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Anuluj</Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-error-fg hover:bg-red-700"
                onClick={() => {
                  const doc = docs.find((d) => d.id === confirmDelete);
                  if (doc) {
                    deleteCV(doc.id);
                    setConfirmDelete(null);
                    refresh();
                    showToast('Usunięto', { message: `„${doc.title}" usunięty.`, variant: 'success' });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Usuń
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
