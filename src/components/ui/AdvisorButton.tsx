import React from 'react';
import { Lightbulb } from 'lucide-react';
import { IconSparkles } from './icons/ModernIcons';
import { motion } from 'motion/react';
import { preloadAdvisorModal } from '../../features/advisor/AdvisorModalHost';

interface AdvisorButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  className?: string;
  variant?: 'brand' | 'warning';
}

/** Współdzielony przycisk Doradcy lokalnego i jego FAQ. */
export const AdvisorButton: React.FC<AdvisorButtonProps> = ({
  onClick,
  label = 'Doradca lokalny',
  title = 'Otwórz Doradcę lokalnego i FAQ',
  className = '',
  variant = 'brand',
}) => {
  const isBrand = variant === 'brand';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => void preloadAdvisorModal()}
      onFocus={() => void preloadAdvisorModal()}
      title={title}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
      className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
        isBrand
          ? 'border-brand-200 bg-brand-50 text-brand-fg hover:bg-brand-100 hover:border-brand-500'
          : 'border-warning/30 bg-warning-soft text-warning-fg hover:bg-warning-soft/80'
      } ${className}`}
    >
      <motion.div
        whileHover={{ rotate: 12 }}
        transition={{ duration: 0.2 }}
        className="flex items-center"
      >
        {isBrand ? (
          <IconSparkles className="h-3.5 w-3.5 text-brand-600 group-hover:text-brand-500" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5 text-warning-fg group-hover:scale-110 transition-transform" />
        )}
      </motion.div>
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
};
