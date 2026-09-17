/**
 * Panel wyświetlający wyniki walidacji PDF pod kątem kompatybilności z 5 ATS-ami.
 *
 * Pokazuje per-vendor ocenę parsowalności, wykryte problemy i zalecenia.
 * Nie jest to scoring dopasowania CV do oferty — to walidacja formatu.
 */

import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ScoreRing } from '../../components/ui/ScoreRing';
import type { AtsPdfValidationReport, AtsPdfValidationResult, AtsIssue } from '../../lib/atsPdfValidator';

interface AtsValidationPanelProps {
  report: AtsPdfValidationReport;
  className?: string;
}

const STATUS_CONFIG = {
  PASS: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle, label: 'OK' },
  WARN: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, label: 'Uwagi' },
  FAIL: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, label: 'Problemy' },
} as const;

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
  const statusConfig = STATUS_CONFIG[result.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card variant="flat" className="border border-line">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 text-left"
      >
        <ScoreRing
          value={result.parseScore}
          size={48}
          stroke={4}
          suffix=""
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">{result.vendorName}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {statusConfig.label}
            </span>
          </div>
          <p className="text-[10px] text-muted">
            {result.extractedFields.sectionHeadersFound.length} sekcji wykrytych
            {result.lostFields.length > 0 && ` · ${result.lostFields.length} pól utraconych`}
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

          {/* Utracone pola */}
          {result.lostFields.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Utracone pola
              </h4>
              <div className="flex flex-wrap gap-1">
                {result.lostFields.map((field) => (
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
  const overallStatusConfig = STATUS_CONFIG[report.overallStatus];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-bold text-ink">
          Walidacja ATS — Kompatybilność parserów
        </h3>
      </div>

      {/* Ogólny wynik */}
      <Card variant="sunken" className="flex items-center gap-4">
        <ScoreRing
          value={report.overallScore}
          size={64}
          stroke={5}
          label="Ogólna"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${overallStatusConfig.bg} ${overallStatusConfig.color} ${overallStatusConfig.border} border`}>
              {React.createElement(overallStatusConfig.icon, { className: 'h-3 w-3' })}
              {overallStatusConfig.label}
            </span>
            <span className="text-[10px] text-muted">
              {report.vendors.length} ATS-ów sprawdzonych
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {report.taggedPdfPresent ? 'Tagged PDF: Tak' : 'Tagged PDF: Nie'}
            {report.invisibleTextDetected ? ' · Niewidoczny tekst: WYKRYTO' : ''}
          </p>
        </div>
      </Card>

      {/* Zalecenia ogólne */}
      {report.generalRecommendations.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Zalecenia ogólne
          </h4>
          <ul className="space-y-0.5">
            {report.generalRecommendations.map((rec, i) => (
              <li key={i} className="text-[11px] text-amber-800">
                · {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-vendor karty */}
      <div className="space-y-2">
        {report.vendors
          .sort((a, b) => a.parseScore - b.parseScore)
          .map((vendor) => (
            <VendorCard key={vendor.vendorId} result={vendor} />
          ))}
      </div>

      {/* Footer */}
      <p className="text-[9px] text-muted text-center">
        Wyniki oparte na profilach parserów z researchu empirycznego.
        Nie gwarantują wyniku prawdziwego ATS-a.
      </p>
    </div>
  );
};
