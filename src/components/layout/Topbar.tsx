import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Palette,
  User,
  Search,
  FlaskConical,
  LogIn,
  LogOut,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../ThemeToggle';
import { AdvisorButton } from '../ui/AdvisorButton';
import { AccessibilityButton } from '../a11y/AccessibilityButton';
import { AccessibilityModal } from '../a11y/AccessibilityModal';
import { NAV_SECTIONS, NavTabId } from '../../lib/navigation';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../store/useToastStore';
import { FREE_BETA_LABEL } from '../../lib/beta';

export interface TopbarProps {
  activeTab: NavTabId;
  onOpenMobileMenu: () => void;
  onOpenAdvisor: () => void;
  onOpenAuthModal: () => void;
  onSelectTab?: (tab: NavTabId) => void;
  onOpenDesignTokens?: () => void;
  isAuthenticated?: boolean;
  userEmail?: string;
  className?: string;
}

const TAB_NAMES: Record<NavTabId, string> = {
  home: 'Panel Główny',
  pricing: 'Zakres bezpłatnej bety',
  'ats-lab': 'Laboratorium audytu CVelocity',
  porady: 'Porady & Baza Wiedzy',
  ...Object.fromEntries(NAV_SECTIONS.map((section) => [section.id, section.label])),
} as Record<NavTabId, string>;

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenAdvisor,
  onOpenAuthModal,
  onSelectTab,
  onOpenDesignTokens,
  isAuthenticated = false,
  userEmail,
  className = '',
}) => {
  const { logout, user, mode, deleteAccount } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={`glass-panel sticky top-3 z-20 mx-3 flex h-14 items-center justify-between rounded-2xl px-3 shadow-raised sm:mx-4 sm:px-4 lg:mx-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Otwórz menu nawigacji"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-elevated text-muted hover:bg-brand-50 hover:text-ink lg:hidden focus-visible:outline-none"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs font-semibold text-ink">
            {TAB_NAMES[activeTab] || 'CVelocity'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          className="hidden sm:flex items-center gap-2 rounded-xl border border-line bg-elevated px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-ink transition-colors"
          title="Otwórz Command Palette (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Szukaj...</span>
          <span className="rounded border border-line bg-sunken px-1.5 py-px font-mono text-[9px] text-muted">
            Ctrl+K
          </span>
        </button>

        <AdvisorButton onClick={onOpenAdvisor} />

        {import.meta.env.DEV && onOpenDesignTokens && (
          <motion.button
            type="button"
            onClick={onOpenDesignTokens}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-elevated text-muted hover:text-brand-fg hover:bg-brand-50 focus-visible:outline-none"
            aria-label="Podgląd Tokenów Design System"
            title="Podgląd Tokenów Design System"
          >
            <Palette className="h-4 w-4" />
          </motion.button>
        )}

        <AccessibilityButton onClick={() => setIsA11yModalOpen(true)} />
        <ThemeToggle />
        <AccessibilityModal
          isOpen={isA11yModalOpen}
          onClose={() => setIsA11yModalOpen(false)}
        />

        <div className="relative" ref={dropdownRef}>
          <motion.button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
            className="flex h-9 items-center gap-2 rounded-xl border border-line bg-elevated px-2 py-1 text-xs font-semibold text-ink shadow-xs hover:border-brand-500/40 hover:bg-brand-500/5 focus-visible:outline-none cursor-pointer"
            title={isAuthenticated ? userEmail : 'Zaloguj się / Menu konta'}
          >
            {isAuthenticated ? (
              <>
                <div className="relative flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 font-bold text-white shadow-xs text-[10px]">
                  {(user?.name || userEmail || 'U').slice(0, 2).toUpperCase()}
                  <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-surface bg-brand-50 px-1 py-px font-mono text-[7px] font-black uppercase tracking-tighter text-brand-fg shadow-xs">
                    BETA
                  </span>
                </div>

                <div className="hidden sm:flex flex-col text-left pl-0.5">
                  <span className="font-bold text-[11px] text-ink truncate max-w-[90px] leading-tight">
                    {user?.name?.split(' ')[0] || userEmail?.split('@')[0]}
                  </span>
                </div>

                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            ) : (
              <>
                <div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-sunken border border-line text-muted">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-ink pr-0.5">Konto</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.16, ease: [0.19, 1, 0.22, 1] }}
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-elevated p-1.5 shadow-floating z-50 text-xs"
              >
                <div className="border-b border-line/60 p-2.5">
                  <div className="font-bold text-ink truncate">
                    {isAuthenticated ? user?.name || 'Profil lokalny' : 'Bez profilu'}
                  </div>
                  <div className="font-mono text-[10px] text-muted truncate">
                    {isAuthenticated ? userEmail : 'Dane trzymane w tej przeglądarce'}
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-1.5 py-px font-mono text-[9px] font-bold uppercase text-brand-fg">
                      <FlaskConical className="h-2.5 w-2.5" aria-hidden="true" />
                      {FREE_BETA_LABEL} · 0 zł
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  {onSelectTab && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTab('pricing');
                        setIsDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-ink hover:bg-brand-50 hover:text-brand-fg transition-colors"
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-muted" />
                      <span>Zakres bezpłatnej bety</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-line/60 pt-1">
                  {isAuthenticated ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void logout();
                          setIsDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-ink hover:bg-brand-50 hover:text-brand-fg transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5 text-muted" />
                        <span>{mode === 'cloud' ? 'Wyloguj się' : 'Zamknij profil'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const pytanie =
                            mode === 'cloud'
                              ? 'Usunąć konto i wszystkie dane z serwera? Tej operacji nie da się cofnąć.'
                              : 'Usunąć profil i wszystkie dane z tej przeglądarki? Tej operacji nie da się cofnąć.';
                          if (!window.confirm(pytanie)) return;

                          setIsDropdownOpen(false);
                          void deleteAccount().then((wynik) => {
                            showToast(
                              wynik.ok ? 'Dane zostały usunięte' : 'Nie udało się usunąć konta',
                              { variant: wynik.ok ? 'success' : 'error' }
                            );
                          });
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-danger-fg hover:bg-danger-soft transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{mode === 'cloud' ? 'Usuń konto' : 'Usuń profil'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAuthModal();
                        setIsDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-ink hover:bg-brand-50 hover:text-brand-fg transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5 text-muted" />
                      <span>Zaloguj się lub załóż konto</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
