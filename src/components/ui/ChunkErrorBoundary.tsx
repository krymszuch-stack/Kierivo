import React from 'react';
import { Button } from './Button';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { reportChunkError } from '../../lib/errorMonitoring';

export interface ChunkErrorBoundaryProps {
  children: React.ReactNode;
  /** Nazwa modułu pokazywana użytkownikowi, np. „Doradca regułowy”. */
  moduleName: string;
  chunkName: string;
  /** Wywoływane po nieudanym ponowieniu (np. zamknięcie modala). */
  onDismiss?: () => void;
  /** Czyści cache odrzuconego importu przed ponownym montażem. */
  onRetry?: () => void;
}

interface ChunkErrorBoundaryState {
  error: Error | null;
  /** Zmiana klucza wymusza ponowny montaż dzieci — czyli ponowny import chunka. */
  retryKey: number;
}

/**
 * Granica błędu dla modułów ładowanych dynamicznie.
 *
 * Dlaczego istnieje: przy redeployu Vite zmienia nazwy chunków, więc otwarta
 * karta próbuje pobrać plik, którego już nie ma („Failed to fetch dynamically
 * imported module”). Bez granicy React odmontowuje całe drzewo i użytkownik
 * dostaje pusty ekran. Tu zamiast tego pokazujemy komunikat i ponawiamy import.
 */
export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ChunkErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const attempt = (error as Error & { advisorChunkAttempt?: number }).advisorChunkAttempt ?? 1;
    reportChunkError(error, {
      moduleName: this.props.moduleName,
      chunkName: this.props.chunkName,
      attempt,
      componentStack: info.componentStack ?? undefined,
    });
  }

  private handleRetry = () => {
    this.props.onRetry?.();
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  private handleReload = () => {
    // Twardy przeładunek pobiera świeży manifest z nowymi nazwami chunków.
    window.location.reload();
  };

  render() {
    const { error, retryKey } = this.state;
    const { children, moduleName, onDismiss } = this.props;

    if (!error) {
      return <React.Fragment key={retryKey}>{children}</React.Fragment>;
    }

    return <ChunkErrorFallback moduleName={moduleName} onRetry={this.handleRetry} onReload={this.handleReload} onDismiss={onDismiss} />;
  }
}

interface ChunkErrorFallbackProps {
  moduleName: string;
  onRetry: () => void;
  onReload: () => void;
  onDismiss?: () => void;
}

const ChunkErrorFallback: React.FC<ChunkErrorFallbackProps> = ({ moduleName, onRetry, onReload, onDismiss }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  React.useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="chunk-error-title" aria-describedby="chunk-error-description" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 id="chunk-error-title" className="text-base font-semibold text-fg">Nie udało się wczytać modułu „{moduleName}”</h2>
        <p id="chunk-error-description" className="mt-2 text-sm text-fg-muted">Najczęściej dzieje się tak po aktualizacji aplikacji w tle albo przy chwilowej utracie połączenia. Twoje dane są bezpieczne — spróbuj ponownie.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onRetry} className="cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500/50">Spróbuj ponownie</Button>
          <Button type="button" variant="outline" onClick={onReload} className="cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500/50">Odśwież stronę</Button>
          {onDismiss && <Button type="button" variant="ghost" onClick={onDismiss} className="cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500/50">Zamknij</Button>}
        </div>
      </div>
    </div>
  );
};
