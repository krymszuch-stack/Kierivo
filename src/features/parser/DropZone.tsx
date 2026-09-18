import React, { useState, useRef } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
  selectedFile?: File | null;
  className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelect,
  isProcessing = false,
  selectedFile = null,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-[220px] max-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
        isDragOver
          ? 'border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10'
          : selectedFile
          ? 'border-brand-300 bg-brand-50/40 dark:bg-brand-950/20'
          : 'border-line bg-sunken/60 hover:border-brand-300 hover:bg-sunken'
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.rtf,.txt,.json"
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3 transition-transform duration-200 ${
          isDragOver
            ? 'scale-110 bg-brand-600 text-on-brand shadow-raised'
            : selectedFile
            ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-600'
            : 'bg-surface text-muted shadow-xs border border-line/50'
        }`}
      >
        {selectedFile ? (
          <FileText className="h-6 w-6" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      {selectedFile ? (
        <div className="space-y-1">
          <p className="font-sans text-sm font-bold text-ink truncate max-w-xs">
            {selectedFile.name}
          </p>
          <p className="font-mono text-xs text-muted">
            {(selectedFile.size / 1024).toFixed(1)} KB • Gotowy do analizy
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              Zmień dokument
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="font-sans text-sm font-bold text-ink">
            Przeciągnij i upuść plik CV tutaj
          </p>
          <p className="text-xs text-muted max-w-sm">
            Formaty: <span className="font-mono font-semibold text-ink">PDF, DOCX, RTF, TXT, JSON</span>
          </p>
          <div className="pt-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={UploadCloud}
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
            >
              Wybierz plik z dysku
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
