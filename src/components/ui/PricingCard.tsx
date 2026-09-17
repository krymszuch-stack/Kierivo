import React from 'react';
import { X } from 'lucide-react';
import { IconCheckCircle } from './icons/ModernIcons';
import { Button } from './Button';

export interface PricingCardProps {
  title: string;
  price: string;
  period: string;
  /** Currency shown before the amount, e.g. "zł". */
  currency?: string;
  description?: string;
  /** Small print under the price, e.g. "rozliczenie roczne (468 zł)". */
  note?: string;
  features: string[];
  excluded?: string[];
  isPopular?: boolean;
  ctaLabel?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  currency,
  description,
  note,
  features,
  excluded = [],
  isPopular = false,
  ctaLabel = 'Odblokuj',
  disabled = false,
  onSelect,
}) => {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-elevated p-[22px] transition-transform duration-[var(--duration-ui)] hover:-translate-y-[3px] hover:shadow-raised ${
        isPopular ? 'border-brand-600 shadow-raised ring-1 ring-brand-600' : 'border-line'
      }`}
    >
      {isPopular && (
        /* „Rekomendowany", nie „najczęściej wybierany" — rekomendacja to nasza decyzja,
           a statystykę wyborów planów nie zbieramy, więc tamto sformułowanie było zmyślone. */
        <span className="bg-brand-grad shadow-brand-glow absolute -top-[11px] left-1/2 -translate-x-1/2 rounded-full px-3 py-[3px] text-[10.5px] font-bold tracking-[0.04em] text-on-brand">
          Rekomendowany
        </span>
      )}

      <h3 className="text-[13px] font-bold tracking-tight text-ink">{title}</h3>
      {/* min-height keeps the price row aligned across cards with different blurb lengths */}
      <p className="mt-[3px] mb-4 min-h-8 text-label leading-relaxed text-muted">{description}</p>

      <div className="flex items-baseline gap-1">
        {currency && <span className="text-[15px] font-bold text-muted">{currency}</span>}
        <span className="font-mono text-[38px] font-extrabold leading-none tracking-[-0.04em] text-ink">
          {price}
        </span>
        <span className="text-label text-subtle">{period}</span>
      </div>
      <p className="mt-1 min-h-[14px] text-meta text-subtle">{note}</p>

      <ul className="my-[18px] flex flex-1 flex-col gap-[9px]">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-[9px] text-[12.5px] text-ink">
            <IconCheckCircle className="mt-px h-[15px] w-[15px] shrink-0 text-success-fg" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
        {excluded.map((e, i) => (
          <li key={i} className="flex items-start gap-[9px] text-[12.5px] text-subtle">
            <X className="mt-px h-[15px] w-[15px] shrink-0" aria-hidden="true" />
            <span>{e}</span>
          </li>
        ))}
      </ul>

       <Button
         variant={isPopular ? 'primary' : 'secondary'}
         size="sm"
         className="mt-auto w-full"
         onClick={onSelect}
         disabled={disabled}
         aria-label={`${ctaLabel}: ${title}, ${price} ${period}`}
       >
        {/* Etykieta zawsze z propsu — nadpisywanie jej stanem disabled ukrywało poprawny opis
            stanu dla kart trwale nieaktywnych (plan Free wobec użytkownika Pro). */}
        {ctaLabel}
      </Button>
    </div>
  );
};
