import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

/** Podgląd gotowego artefaktu — ten sam Blob zostanie przekazany do pobrania. */
export function PreparedPdfPreview({ blob, onReady }: { blob: Blob; onReady: (ready: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Ładowanie podglądu PDF…');
  const [error, setError] = useState(false);
  const [hash, setHash] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    const renderTasks: RenderTask[] = [];
    const target = container.current;
    target?.replaceChildren();
    void (async () => {
      try {
        const [pdfjs, worker, buffer] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'), blob.arrayBuffer(),
        ]);
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        if (cancelled) return;
        setHash(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        for (let index = 1; index <= pdf.numPages; index++) {
          if (cancelled) return;
          const page = await pdf.getPage(index);
          const canvas = document.createElement('canvas');
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Strona ${index} z ${pdf.numPages}`);
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          const viewport = page.getViewport({ scale: 1.25 });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const render = page.render({ canvas, viewport });
          renderTasks.push(render);
          await render.promise;
          const text = await page.getTextContent();
          if (cancelled) return;
          const figure = document.createElement('figure');
          const caption = document.createElement('figcaption');
          caption.textContent = `Strona ${index} z ${pdf.numPages}`;
          const accessibleText = document.createElement('p');
          accessibleText.className = 'sr-only';
          accessibleText.textContent = text.items.map(item => 'str' in item ? item.str : '').join(' ');
          figure.append(canvas, caption, accessibleText);
          target?.append(figure);
          page.cleanup();
        }
        if (!cancelled) {
          setStatus(`Podgląd PDF gotowy: ${pdf.numPages} str.`);
          onReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setStatus('Nie udało się wyświetlić podglądu PDF. Wróć do ustawień i spróbuj ponownie.');
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTasks.forEach(task => task.cancel());
      void loadingTask?.destroy().catch(() => { /* Sprzątanie anulowanego podglądu. */ });
    };
  }, [blob, onReady]);

  return <section aria-label="Podgląd pliku PDF do pobrania" data-testid="prepared-pdf-preview" data-pdf-sha256={hash}>
    <p role={error ? 'alert' : 'status'} className="mb-2 text-sm text-ink">{status}</p>
    <div ref={container} className="space-y-4" />
  </section>;
}
