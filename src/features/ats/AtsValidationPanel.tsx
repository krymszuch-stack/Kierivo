/**
 * Panel wyświetlający lokalny test parsowalności PDF według pięciu profili reguł.
 *
 * Nazwy vendorów identyfikują profil heurystyczny; aplikacja nie łączy się
 * z ich systemami i nie zna konfiguracji używanej przez konkretnego rekrutera.
 * Nie jest to scoring dopasowania CV do oferty — to walidacja formatu.
 */

import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { AtsPdfValidationReport, AtsPdfValidationResult, AtsIssue } from '../../lib/atsPdfValidator';

interface AtsValidationPanelProps {
  report: AtsPdfValidationReport;
  className?: string;
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-600', icon: XCircle },
  warning: { color: 'text-amber-600', icon: AlertTriangle },
  info: { color: 'text-blue-600', icon: Info },
} as const;

function IssueRow({ issue }: { issue: AtsIssue }) {
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink">{issue.message}</p>
        {issue.fix && (
          <p className="mt-0.5 text-[10px] text-muted">{issue.fix}</p>
        )}
      </div>
    </div>
  );
}

function VendorCard({ result }: { result: AtsPdfValidationResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="flat" className="border border-line">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">Profil reguł: {result.vendorName}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              {result.issues.length === 0 ? 'Brak uwag regułowych' : `${result.issues.length} uwag do sprawdzenia`}
            </span>
          </div>
          <p className="text-[10px] text-muted">
            {result.extractedFields.sectionHeadersFound.length} sekcji wykrytych
            {result.notFoundFields.length > 0 && ` · ${result.notFoundFields.length} pól nieznalezionych w tekście`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {/* Kluczowe pola */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="font-semibold text-ink">Imię: </span>
              <span className={result.extractedFields.name ? 'text-emerald-600' : 'text-red-600'}>
                {result.extractedFields.name ? 'Wykryte' : 'Brak'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-ink">E-mail: </span>
              <span className={result.extractedFields.email ? 'text-emerald-600' : 'text-red-600'}>
                {result.extractedFields.email || 'Brak'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-ink">Telefon: </span>
              <span className={result.extractedFields.phone ? 'text-emerald-600' : 'text-amber-600'}>
                {result.extractedFields.phone || 'Brak'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-ink">Sekcje: </span>
              <span className="text-ink">
                {result.extractedFields.sectionHeadersFound.join(', ') || 'Brak'}
              </span>
            </div>
          </div>

          {/* Problemy */}
          {result.issues.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Wykryte problemy ({result.issues.length})
              </h4>
              <div className="space-y-0.5">
                {result.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Pola profilu nieznalezione w wyekstrahowanym tekście */}
          {result.notFoundFields.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Nie znaleziono w tekście
              </h4>
              <div className="flex flex-wrap gap-1">
                {result.notFoundFields.map((field) => (
                  <span key={field} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Zalecenia */}
          {result.recommendations.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Zalecenia
              </h4>
              <ul className="space-y-0.5">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-[10px] text-muted">
                    · {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export const AtsValidationPanel: React.FC<AtsValidationPanelProps> = ({
  report,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-bold text-ink">
          Lokalny przegląd tekstu PDF
        </h3>
      </div>

      {/* Podsumowanie zakresu sprawdzenia, bez niekalibrowanej punktacji */}
      <Card variant="sunken" className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold text-muted">
              {report.vendors.length > 0 ? 'Sprawdzono reguły tekstu' : 'Nie wykonano'}
            </span>
            <span className="text-[10px] text-muted">
              {report.vendors.length} profili regułowych
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {report.taggedPdfPresent === null ? 'Tagged PDF: nie sprawdzono' : report.taggedPdfPresent ? 'Tagged PDF: Tak' : 'Tagged PDF: Nie'}
            {report.invisibleTextDetected === null
              ? ' · Niewidoczny tekst: nie sprawdzono'
              : report.invisibleTextDetected
                ? ' · Niewidoczny tekst: WYKRYTO'
                : ' · Niewidoczny tekst: nie wykryto'}
          </p>
        </div>
      </Card>

      {/* Zalecenia ogólne */}
      {report.generalRecommendations.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Zakres i zalecenia
          </h4>
          <ul className="space-y-0.5">
            {report.generalRecommendations.map((rec, i) => (
              <li key={i} className="text-[11px] text-blue-800">
                · {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-vendor karty */}
      <div className="space-y-2">
        {report.vendors.map((vendor) => (
            <VendorCard key={vendor.vendorId} result={vendor} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[9px] text-muted text-center">
        To lokalne reguły na wyekstrahowanym tekście, nie test rzeczywistych
        parserów Workday, Greenhouse, Lever, iCIMS ani Taleo.
      </p>
    </div>
  );
};
