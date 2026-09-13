import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ChunkErrorBoundary } from '../../components/ui/ChunkErrorBoundary';
import { Skeleton } from '../../components/ui/Skeleton';
import type { GeminiAdvisorModalProps } from './GeminiAdvisorModal';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  ADVISOR_CHUNK_NAME,
  preloadAdvisorChunk,
  resetAdvisorChunkCache,
  subscribeAdvisorChunkStatus,
  type AdvisorChunkStatus,
} from './advisorChunkLoader';

const createLazyAdvisor = () => lazy(
  () => preloadAdvisorChunk().then((module) => ({ default: module.GeminiAdvisorModal })),
);

let GeminiAdvisorModalLazy = createLazyAdvisor();

export function preloadAdvisorModal(): Promise<unknown> {
  return preloadAdvisorChunk();
}

const AdvisorSkeleton: React.FC<{ status: AdvisorChunkStatus; onClose: () => void }> = ({ status, onClose }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const nextAttempt = status.state === 'waiting' ? Math.min(status.attempt + 1, 3) : status.attempt || 1;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" data-testid="advisor-skeleton">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="advisor-loading-title" aria-describedby="advisor-loading-status" aria-busy="true" tabIndex={-1} className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-xl">
      <div className="flex justify-end"><button type="button" onClick={onClose} aria-label="Zamknij ładowanie Doradcy regułowego" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50">Zamknij</button></div>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <Skeleton variant="text" width="45%" height={16} />
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton variant="rectangle" height={64} />
        <Skeleton variant="rectangle" height={44} className="w-3/4" />
        <Skeleton variant="rectangle" height={44} />
      </div>
      <h2 id="advisor-loading-title" className="sr-only">Ładowanie Doradcy regułowego</h2>
      <p id="advisor-loading-status" role="status" aria-live="polite" className="mt-5 text-xs text-fg-muted">{status.state === 'waiting' ? `Połączenie przerwane. Ponawiam próbę ${nextAttempt} z 3…` : `Przygotowuję Doradcę regułowego — próba ${nextAttempt} z 3…`}</p>
    </div>
  </div>;
};

export const AdvisorModalHost: React.FC<GeminiAdvisorModalProps> = (props) => {
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<AdvisorChunkStatus>({ attempt: 0, state: 'idle' });

  useEffect(() => subscribeAdvisorChunkStatus(setStatus), []);

  if (!props.isOpen) return null;

  const retry = () => {
    resetAdvisorChunkCache();
    GeminiAdvisorModalLazy = createLazyAdvisor();
    setGeneration((current) => current + 1);
  };

  return (
    <div key={generation}>
      <ChunkErrorBoundary moduleName="Doradca lokalny" chunkName={ADVISOR_CHUNK_NAME} onDismiss={props.onClose} onRetry={retry}>
        <Suspense fallback={<AdvisorSkeleton status={status} onClose={props.onClose} />}>
          <GeminiAdvisorModalLazy {...props} />
        </Suspense>
      </ChunkErrorBoundary>
    </div>
  );
};
