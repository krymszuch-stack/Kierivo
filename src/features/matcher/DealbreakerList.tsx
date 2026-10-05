import React, { useState } from 'react';
import { AlertTriangle, XCircle, Plus, CheckCircle2, ShieldCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/Button';

export interface DealbreakerListProps {
  missingItems: string[];
  unconfirmedItems?: string[];
  onAddToVault?: (item: string) => void;
  className?: string;
}

export const DealbreakerList: React.FC<DealbreakerListProps> = ({
  missingItems,
  unconfirmedItems = [],
  onAddToVault,
  className = '',
}) => {
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const handleAdd = (item: string) => {
    setAddedItems((prev) => new Set([...prev, item]));
    if (onAddToVault) {
      onAddToVault(item);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          Krytyczne Braki & Dealbreakery ({missingItems.length})
        </h4>
        <span className="font-mono text-[10px] text-muted">
          Trafiają na listę braków przy analizie oferty
        </span>
      </div>

      {missingItems.length === 0 && unconfirmedItems.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-xs font-semibold text-success-fg">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            Nie wykryto braków w wymaganiach rozpoznanych przez Kierivo.
          </span>
        </div>
      ) : missingItems.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {missingItems.map((item, idx) => {
              const isAdded = addedItems.has(item);

              return (
                <motion.div
                  key={item}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-fg">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <span className="truncate font-semibold text-ink">
                      Wymóg: <strong className="text-brand-fg">{item}</strong>
                    </span>
                  </div>

                  {onAddToVault && (
                    <Button
                      type="button"
                      variant={isAdded ? 'outline' : 'secondary'}
                      size="sm"
                      icon={isAdded ? Check : Plus}
                      disabled={isAdded}
                      onClick={() => handleAdd(item)}
                      className={isAdded ? 'text-success-fg border-success/30' : ''}
                    >
                      {isAdded ? 'Dodano do Vault' : 'Dodaj do Vault'}
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : null}

      {unconfirmedItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-4 text-xs text-warning-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Wymagają potwierdzenia: <strong>{unconfirmedItems.join(', ')}</strong>. Nie zaliczamy ich ani nie traktujemy jako braków bez danych, które pozwalają je potwierdzić.
          </span>
        </div>
      )}
    </div>
  );
};
