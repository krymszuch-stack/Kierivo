import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import {
  formatMonthYear,
  parseMonthYear,
  POLISH_MONTHS,
  POLISH_MONTHS_SHORT,
  getCurrentMonthYear,
} from '../../lib/dateUtils';

export interface MonthYearPickerProps {
  label?: string;
  value: string | null | undefined; // YYYY-MM
  onChange: (value: string | null) => void;
  minYear?: number;
  maxYear?: number;
  allowCurrent?: boolean;
  isCurrent?: boolean;
  onToggleCurrent?: (isCurrent: boolean) => void;
  currentLabel?: string;
  disabled?: boolean;
  error?: string;
  warning?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  containerClassName?: string;
}

const DEFAULT_MIN_YEAR = 1960;
const DEFAULT_MAX_YEAR = new Date().getFullYear() + 5;

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  label,
  value,
  onChange,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
  allowCurrent = false,
  isCurrent = false,
  onToggleCurrent,
  currentLabel = 'Nadal tu pracuję / Obecnie',
  disabled = false,
  error,
  warning,
  hint,
  placeholder = 'np. 09.2024 lub wrzesień 2024',
  required = false,
  id,
  containerClassName = '',
}) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  // Wyodrębnienie aktualnie wybranego roku i miesiąca
  const parsedValue = useMemo(() => parseMonthYear(value), [value]);

  const [selectedYear, selectedMonth] = useMemo(() => {
    if (!parsedValue) return [null, null];
    const [y, m] = parsedValue.split('-');
    return [parseInt(y, 10), parseInt(m, 10)];
  }, [parsedValue]);

  // Rok przeglądany w kalendarzu
  const [viewYear, setViewYear] = useState<number>(() => {
    if (selectedYear) return selectedYear;
    return new Date().getFullYear();
  });

  // Aktualizacja stanu widocznego tekstu, gdy zmienia się wartość zewnętrzna lub isCurrent
  useEffect(() => {
    if (isCurrent) {
      setInputText('Obecnie');
      return;
    }
    if (parsedValue) {
      setInputText(formatMonthYear(parsedValue));
      const [y] = parsedValue.split('-');
      setViewYear(parseInt(y, 10));
    } else {
      setInputText(value || '');
    }
  }, [value, parsedValue, isCurrent]);

  // Obsługa kliknięcia poza popoverem
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputText(raw);

    if (isCurrent && onToggleCurrent) {
      onToggleCurrent(false);
    }

    if (!raw.trim()) {
      onChange(null);
      return;
    }

    const parsed = parseMonthYear(raw);
    if (parsed) {
      onChange(parsed);
      const [y] = parsed.split('-');
      setViewYear(parseInt(y, 10));
    }
  };

  const handleInputBlur = () => {
    if (isCurrent) return;
    if (!inputText.trim()) {
      onChange(null);
      return;
    }
    const parsed = parseMonthYear(inputText);
    if (parsed) {
      setInputText(formatMonthYear(parsed));
      onChange(parsed);
    }
  };

  const handleSelectMonth = useCallback(
    (monthNumber: number) => {
      const formattedMonth = String(monthNumber).padStart(2, '0');
      const newValue = `${viewYear}-${formattedMonth}`;
      onChange(newValue);
      setInputText(formatMonthYear(newValue));
      if (isCurrent && onToggleCurrent) {
        onToggleCurrent(false);
      }
      setIsOpen(false);
    },
    [viewYear, onChange, isCurrent, onToggleCurrent]
  );

  const handleSelectCurrentMonth = () => {
    const current = getCurrentMonthYear();
    onChange(current);
    setInputText(formatMonthYear(current));
    if (isCurrent && onToggleCurrent) {
      onToggleCurrent(false);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInputText('');
    if (isCurrent && onToggleCurrent) {
      onToggleCurrent(false);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      const parsed = parseMonthYear(inputText);
      if (parsed) {
        setInputText(formatMonthYear(parsed));
        onChange(parsed);
        setIsOpen(false);
      }
    }
  };

  const borderClass = error
    ? 'border-danger/60 focus-within:ring-danger/20'
    : warning
    ? 'border-amber-500/60 focus-within:ring-amber-500/20'
    : 'border-line focus-within:border-brand-500/60 focus-within:ring-brand-500/20';

  return (
    <div ref={containerRef} className={`space-y-1.5 ${containerClassName}`}>
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-label font-semibold text-muted uppercase tracking-wider"
          >
            {label}
            {required && <span className="ml-1 text-danger-fg">*</span>}
          </label>
        )}

        {allowCurrent && onToggleCurrent && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted hover:text-ink transition-colors">
            <input
              type="checkbox"
              checked={Boolean(isCurrent)}
              onChange={(e) => {
                const checked = e.target.checked;
                onToggleCurrent(checked);
                if (checked) {
                  onChange(null);
                  setInputText('Obecnie');
                  setIsOpen(false);
                } else {
                  setInputText('');
                }
              }}
              className="h-3.5 w-3.5 rounded border-line text-brand-600 focus:ring-brand-500/20"
            />
            <span className="text-[11px] select-none">{currentLabel}</span>
          </label>
        )}
      </div>

      <div className="relative">
        <div
          className={`flex items-center w-full rounded-xl border bg-sunken text-xs font-medium text-ink transition-colors duration-100 ease-out hover:border-brand-500/40 focus-within:ring-2 ${borderClass} ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            aria-label="Wybierz miesiąc i rok"
            className="pl-3.5 pr-2 py-2.5 text-muted hover:text-brand-fg cursor-pointer focus:outline-none"
          >
            <Calendar className="h-4 w-4" />
          </button>

          <input
            id={inputId}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled || isCurrent}
            placeholder={isCurrent ? 'Obecnie' : placeholder}
            aria-invalid={Boolean(error)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={popoverId}
            className="w-full bg-transparent py-2.5 pr-2 text-xs text-ink placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed"
          />

          {!disabled && (inputText || isCurrent) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mr-1.5 text-muted hover:text-danger-fg rounded-md transition-colors cursor-pointer"
              title="Wyczyść datę"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Popover Kalendarza Miesiąc/Rok */}
        {isOpen && !disabled && !isCurrent && (
          <div
            id={popoverId}
            role="dialog"
            aria-label="Wybór miesiąca i roku"
            className="absolute left-0 z-30 mt-1.5 w-72 rounded-2xl border border-line bg-surface p-3.5 shadow-floating animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {/* Nagłówek wyboru roku */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <button
                type="button"
                onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
                disabled={viewYear <= minYear}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-sunken disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Poprzedni rok"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="font-bold text-sm text-ink font-mono tracking-wide">
                {viewYear}
              </span>

              <button
                type="button"
                onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
                disabled={viewYear >= maxYear}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-sunken disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Następny rok"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Siatka miesięcy (3 x 4) */}
            <div className="grid grid-cols-3 gap-1.5 pt-3">
              {POLISH_MONTHS_SHORT.map((monthShort, idx) => {
                const monthNumber = idx + 1;
                const isSelected =
                  selectedYear === viewYear && selectedMonth === monthNumber;
                const isCurrentMonthThisYear =
                  new Date().getFullYear() === viewYear &&
                  new Date().getMonth() + 1 === monthNumber;

                return (
                  <button
                    key={monthShort}
                    type="button"
                    onClick={() => handleSelectMonth(monthNumber)}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-xs'
                        : isCurrentMonthThisYear
                        ? 'bg-brand-500/10 text-brand-fg font-bold border border-brand-500/30'
                        : 'text-ink hover:bg-sunken'
                    }`}
                    title={POLISH_MONTHS[idx]}
                  >
                    {monthShort}
                  </button>
                );
              })}
            </div>

            {/* Dolny pasek szybkich akcji */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-line text-[11px]">
              <button
                type="button"
                onClick={handleSelectCurrentMonth}
                className="text-brand-fg font-bold hover:underline cursor-pointer"
              >
                Bieżący miesiąc
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="text-muted hover:text-danger-fg cursor-pointer"
              >
                Wyczyść
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Komunikaty błędów, ostrzeżeń lub pomocnicze */}
      {error && (
        <p role="alert" className="text-meta font-semibold text-danger-fg">
          {error}
        </p>
      )}

      {!error && warning && (
        <p role="alert" className="text-meta font-semibold text-amber-600 dark:text-amber-400">
          {warning}
        </p>
      )}

      {!error && !warning && hint && (
        <p className="text-meta text-muted">{hint}</p>
      )}
    </div>
  );
};
