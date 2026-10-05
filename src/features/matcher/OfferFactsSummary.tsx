import { Card } from '../../components/ui/Card';
import type { ParsedJobDescription, ParsedWorkModel } from '../../lib/jdParser';

const SENIORITY_LABELS: Record<ParsedJobDescription['seniorityLevel'], string> = {
  ENTRY: 'Początkujący',
  MID: 'Średni poziom',
  SENIOR: 'Starszy specjalista',
  LEAD: 'Lider / kierownik',
  EXECUTIVE: 'Kadra zarządzająca',
  UNKNOWN: 'Nie znaleziono jawnego poziomu w odczytanej treści',
};

export interface OfferFactsSummaryProps {
  seniorityLevel: ParsedJobDescription['seniorityLevel'];
  workModel?: ParsedWorkModel;
  contractTypes?: string[];
}

const WORK_MODEL_LABELS: Record<ParsedWorkModel, string> = {
  REMOTE: 'Zdalny',
  HYBRID: 'Hybrydowy',
  ON_SITE: 'Stacjonarny',
  FLEXIBLE: 'Elastyczny lub wielowariantowy',
  UNKNOWN: 'Nie określono w treści',
};

/** Pokazuje wyłącznie warunki wyciągnięte z tekstu oferty i nie uzupełnia braków domysłem. */
export function OfferFactsSummary({ seniorityLevel, workModel = 'UNKNOWN', contractTypes = [] }: OfferFactsSummaryProps) {
  const uniqueContractTypes = Array.from(new Set(contractTypes));

  return (
    <Card tone="flat" className="space-y-3 border border-line p-5">
      <div>
        <h3 className="text-sm font-bold text-ink">Wzmianki odczytane z oferty</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          To dopasowane frazy z tekstu, nie potwierdzenie warunków przez pracodawcę. Sprawdź je w oryginale.
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted">Poziom stanowiska</dt>
          <dd className="mt-1 font-semibold text-ink">{SENIORITY_LABELS[seniorityLevel]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Tryb pracy</dt>
          <dd className="mt-1 font-semibold text-ink">{WORK_MODEL_LABELS[workModel]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Wzmianki o formie umowy</dt>
          <dd className="mt-1 font-semibold text-ink">
            {uniqueContractTypes.length > 0
              ? uniqueContractTypes.join(' · ')
              : 'Nie wykryto nazwy formy umowy'}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
