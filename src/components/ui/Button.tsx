import React, { useRef } from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-grad text-on-brand shadow-raised border border-transparent hover:brightness-110 hover:shadow-brand-glow-lg',
  secondary:
    'border border-line bg-elevated text-ink hover:border-brand-200 hover:bg-brand-50 hover:text-brand-fg',
  ghost: 'border border-transparent text-muted hover:bg-surface hover:text-ink',
  outline: 'border border-line text-ink hover:border-brand-200 hover:bg-surface',
  danger: 'border border-danger/30 bg-danger-soft text-danger-fg hover:bg-danger-soft/80',
};

 const sizeStyles = {
   sm: 'h-11 py-1 text-xs gap-1.5 rounded-lg font-medium',
   md: 'h-11 py-1.5 text-xs font-semibold gap-2 rounded-xl',
   lg: 'h-11 py-2 text-sm font-semibold gap-2.5 rounded-xl',
 };

/** Odstępy poziome zależą od tego, czy przycisk ma etykietę, czy samą ikonę. */
 const paddingStyles = {
   sm: { withLabel: 'px-3', iconOnly: 'px-1.5' },
   md: { withLabel: 'px-4', iconOnly: 'px-2' },
   lg: { withLabel: 'px-5', iconOnly: 'px-2.5' },
 };

const iconSizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-[18px] w-[18px]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  children,
  onClick,
  ...props
}) => {
  const rippleRef = useRef<HTMLSpanElement>(null);
  const isDisabled = disabled || loading;
  const iconOnly = !children && Boolean(Icon);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;

    const ripple = rippleRef.current;
    if (ripple) {
      ripple.classList.remove('animate-ripple');
      const rect = e.currentTarget.getBoundingClientRect();
      ripple.style.left = `${e.clientX - rect.left}px`;
      ripple.style.top = `${e.clientY - rect.top}px`;
      void ripple.offsetWidth;
      ripple.classList.add('animate-ripple');
    }

    onClick?.(e);
  };

  return (
   <motion.button
       type="button"
       whileHover={!isDisabled ? { scale: 1.02 } : undefined}
       whileTap={!isDisabled ? { scale: 0.98 } : undefined}
       transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
       disabled={isDisabled}
       aria-busy={loading || undefined}
       onClick={handleClick}
       className={[
        'relative overflow-hidden inline-flex items-center justify-center transition-colors',
        // Wyłączony przycisk ma to pokazywać także kursorem, nie samą przezroczystością.
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        iconOnly ? paddingStyles[size].iconOnly : paddingStyles[size].withLabel,
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className={`animate-spin ${iconSizes[size]}`} aria-hidden="true" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} aria-hidden="true" />
      )}

      {children && <span>{children}</span>}

      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={iconSizes[size]} aria-hidden="true" />
      )}

      {/*
       * Ripple w kolorze tekstu przycisku, nie w `--on-brand`.
       * `--on-brand` jest dobrany pod wypełnienie gradientem marki: biały
       * w jasnym motywie, prawie czarny w ciemnym. Na wariantach bez wypełnienia
       * (ghost, outline, secondary, danger) zlewał się więc z tłem i efekt był
       * niewidoczny na czterech z pięciu wariantów. `currentColor` działa
       * poprawnie na każdym z nich, bo zawsze kontrastuje z własnym tłem.
       */}
      <span
        ref={rippleRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-6 w-6 rounded-full bg-current opacity-20"
        style={{ transform: 'translate(-50%, -50%) scale(0)' }}
      />
    </motion.button>
  );
};
