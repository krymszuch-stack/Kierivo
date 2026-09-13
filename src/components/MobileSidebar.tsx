import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { KierivoLogo } from './KierivoLogo';
import { motion, AnimatePresence } from 'motion/react';

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  title = 'Menu Główne',
  children,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-surface/75 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            className="fixed top-0 bottom-0 left-0 z-50 flex w-[19rem] flex-col border-r border-line bg-sunken shadow-floating"
          >
            {/* Drawer Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
              <div className="flex items-center gap-2.5">
                <KierivoLogo collapsed />
                <span className="font-sans text-sm font-bold text-ink">{title}</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Zamknij menu"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
