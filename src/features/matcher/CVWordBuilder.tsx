import React, { useState } from 'react';
import {
  Bold,
  Italic,
  List,
  Heading1,
  Heading2,
  Code,
  Quote,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Save,
} from 'lucide-react';
import { MasterVault } from '../../types';
import type { CvExportEvent } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';
import { copyTextAndNotifySuccess } from '../../lib/copyTextAndNotifySuccess';

export interface CVWordBuilderProps {
  vault: MasterVault;
  /** Treść dokumentu trafiła do schowka — patrz `DocumentRendererProps`. */
  onExported?: (event: CvExportEvent) => void;
  className?: string;
}

export const CVWordBuilder: React.FC<CVWordBuilderProps> = ({
  vault,
  onExported,
  className = '',
}) => {
  const initialContent = `
# ${vault.personalInfo.fullName}
**${vault.personalInfo.title}**
${vault.personalInfo.email} | ${vault.personalInfo.phone} | ${vault.personalInfo.location}

## Podsumowanie Profilu
${vault.personalInfo.summary}

## Doświadczenie Zawodowe
${vault.history.map((h) => `### ${h.role} — ${h.company} (${h.startDate} - ${h.isCurrent ? 'Obecnie' : h.endDate})\n${h.highlights.filter((hl) => hl.text.trim()).map((hl) => `- ${hl.text}`).join('\n')}`).join('\n\n')}

## Kluczowe Technologie
- **Twarde:** ${(vault.skillsMatrix?.hardSkills || []).join(', ')}
- **Narzędzia:** ${(vault.skillsMatrix?.toolsAndTech || []).join(', ')}
- **Miękkie:** ${(vault.skillsMatrix?.softSkills || []).join(', ')}

## Edukacja
${vault.education.map((e) => `- ${e.degree}, ${e.fieldOfStudy} — ${e.institution} (${e.startDate} - ${e.endDate})`).join('\n')}
  `.trim();

  const [documentContent, setDocumentContent] = useState(initialContent);
  const [isCopied, setIsCopied] = useState(false);

  const applyFormat = (prefix: string, suffix: string = '') => {
    setDocumentContent((prev) => `${prev}\n${prefix}Wpisz tekst...${suffix}`);
  };

  const handleCopy = async () => {
    try {
      await copyTextAndNotifySuccess(documentContent, () => onExported?.({
        document: { kind: 'cv', format: 'markdown', content: documentContent },
      }));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast('Nie udało się skopiować CV', {
        message: 'Przeglądarka nie zapisała tekstu w schowku. Spróbuj ponownie.',
        variant: 'error',
      });
    }
  };

  return (
    <Card tone="raised" className={`space-y-4 ${className}`}>
      {/* Notion-Style Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-sunken p-1">
          <button
            type="button"
            onClick={() => applyFormat('**', '**')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Pogrubienie"
            aria-label="Pogrubienie"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('*', '*')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Kursywa"
            aria-label="Kursywa"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('# ')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Nagłówek 1"
            aria-label="Nagłówek 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('## ')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Nagłówek 2"
            aria-label="Nagłówek 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('- ')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Lista punktowana"
            aria-label="Lista punktowana"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('`', '`')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Kod inline"
            aria-label="Kod inline"
          >
            <Code className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('> ')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink focus-visible:outline-none"
            title="Cytat"
            aria-label="Cytat"
          >
            <Quote className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={isCopied ? Check : Copy}
            onClick={handleCopy}
          >
            {isCopied ? 'Skopiowano' : 'Kopiuj Markdown'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RotateCcw}
            onClick={() => setDocumentContent(initialContent)}
          >
            Przywróć
          </Button>
        </div>
      </div>

      {/* Editor Content Textarea */}
      <textarea
        rows={20}
        value={documentContent}
        onChange={(e) => setDocumentContent(e.target.value)}
        className="w-full rounded-2xl border border-line bg-sunken p-4 font-mono text-xs text-ink leading-relaxed transition-colors focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        placeholder="Treść dokumentu..."
      />

      <div className="flex items-center justify-between text-xs text-muted font-mono pt-1">
        <span>Słów: {documentContent.trim().split(/\s+/).filter(Boolean).length}</span>
        <span>Znaków: {documentContent.length}</span>
      </div>
    </Card>
  );
};
