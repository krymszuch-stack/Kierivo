import React, { useState } from 'react';
import {
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  LogIn,
  User,
  Target,
  GraduationCap,
  Kanban,
  Eye,
  Sparkles,
  BookOpen,
  FolderArchive,
  House,
  LucideIcon,
} from 'lucide-react';
import { NavItem } from './NavItem';
import { Tooltip } from '../ui/Tooltip';
import { KierivoLogo } from '../KierivoLogo';
import { PrivacyPolicyModal } from '../legal/PrivacyPolicyModal';
import { SupportContactModal } from '../legal/SupportContactModal';
import { NAV_SECTIONS, NavSectionId, NavTabId } from '../../lib/navigation';

/**
 * Czytelne, jednoznaczne ikony sekcji z pakietu lucide-react.
 */
const SECTION_ICONS: Record<NavSectionId, LucideIcon> = {
  profil: User,
  aplikuj: Target,
  trenuj: GraduationCap,
  pipeline: Kanban,
};

export interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAdvisor: () => void;
  onOpenAuthModal: () => void;
  onOpenCvPreview?: () => void;
  /** Które sekcje są już dostępne. Brak wpisu znaczy „dostępna". */
  unlockedSections?: Partial<Record<NavSectionId, boolean>>;
  /** Czemu sekcja jest jeszcze zamknięta — pokazywane w podpowiedzi. */
  lockReasons?: Partial<Record<NavSectionId, string>>;
  isAuthenticated?: boolean;
  userEmail?: string;
  cloudAvailable?: boolean;
  planStatus?: 'free' | 'trialing' | 'active';
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onOpenAdvisor,
  onOpenAuthModal,
  onOpenCvPreview,
  unlockedSections,
  lockReasons,
  isAuthenticated = false,
  userEmail,
  cloudAvailable = false,
  className = '',
}) => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const accountLabel = cloudAvailable ? 'Zaloguj lub załóż konto' : 'Utwórz profil lokalny';
  const accountHint = cloudAvailable
    ? 'Synchronizacja między urządzeniami'
    : 'Dane zostają na tym urządzeniu';

  return (
    <div
      className={`flex h-full flex-col justify-between overflow-hidden p-3.5 transition-[width] duration-[var(--duration-ui)] ease-out ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${className}`}
    >
      {/* Top Section: Brand & Navigation */}
      <div className="space-y-3.5">
        {/* Brand Logo & Collapse Toggle */}
        <div className="flex h-10 items-center justify-between px-1.5">
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => onSelectTab('home')}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
              aria-label="Ekran startowy — Panel Główny"
            >
              <KierivoLogo />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('home')}
              className="mx-auto cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
              aria-label="Ekran startowy — Panel Główny"
            >
              <KierivoLogo collapsed />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Rozwiń pasek boczny' : 'Zwiń pasek boczny'}
            className="hidden lg:flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-[var(--duration-fast)] ease-out hover:bg-brand-500/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Widoczny powrót na start: logo samo w sobie nie mówiło każdemu, że jest nawigacją. */}
        <nav className="flex flex-col gap-1 pt-1" aria-label="Główna nawigacja">
          <NavItem
            icon={House}
            label="Start"
            hint="Krótki przewodnik po Kierivo i najbliższy sensowny krok."
            isActive={activeTab === 'home'}
            isCollapsed={isCollapsed}
            onClick={() => onSelectTab('home')}
          />
          {!isCollapsed && <p className="px-3 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Twoje CV i aplikacje</p>}
          {NAV_SECTIONS.map((section) => {
            const isLocked = unlockedSections?.[section.id] === false;

            return (
              <NavItem
                key={section.id}
                icon={SECTION_ICONS[section.id]}
                label={section.label}
                hint={section.hint}
                isLocked={isLocked}
                lockedReason={lockReasons?.[section.id]}
                isActive={activeTab === section.id}
                isCollapsed={isCollapsed}
                onClick={() => onSelectTab(section.id)}
              />
            );
          })}
        </nav>

        {/* Narzędzia pomocnicze — bez plakietek marketingowych. */}
        <div className="pt-2 border-t border-line/60 space-y-1">
          {!isCollapsed && (
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">
              Narzędzia
            </p>
          )}
          <NavItem
            icon={Eye}
            label="Generator CV"
            hint="Wybierz wygląd gotowego CV, wprowadź ostatnie poprawki i przygotuj plik do wysłania."
            isCollapsed={isCollapsed}
            onClick={() => {
              if (onOpenCvPreview) {
                onOpenCvPreview();
              } else {
                onSelectTab('profil');
              }
            }}
            className="text-brand-fg hover:bg-brand-500/10 border border-brand-500/20 bg-brand-500/5 font-semibold"
          />

          <NavItem
            icon={BookOpen}
            label="Porady"
            hint="Baza wiedzy, strategie rekrutacyjne, algorytmy ATS i wzorce rozmów."
            isActive={activeTab === 'porady'}
            isCollapsed={isCollapsed}
            onClick={() => onSelectTab('porady')}
          />

          <NavItem
            icon={FolderArchive}
            label="Biblioteka CV"
            hint="Zapisane wersje CV z tagami — szybki powrót, klonowanie pod inną ofertę i ponowny eksport bez limitu."
            isActive={activeTab === 'biblioteka'}
            isCollapsed={isCollapsed}
            onClick={() => onSelectTab('biblioteka')}
          />

          <NavItem
            icon={Sparkles}
            label="Doradca lokalny"
            hint="Rozmowa działa z lokalną Ollamą. Bez dostępnego modelu znajdziesz tu FAQ i skróty do właściwych narzędzi."
            isCollapsed={isCollapsed}
            onClick={onOpenAdvisor}
            className="text-brand-fg hover:bg-brand-500/10"
          />

          <NavItem
            icon={ShieldCheck}
            label="Audyt ATS"
            hint="Laboratorium Kierivo mierzące strukturę, frazy, język i wymagania oferty. To nie są wyniki zewnętrznych ATS."
            isActive={activeTab === 'ats-lab'}
            isCollapsed={isCollapsed}
            onClick={() => onSelectTab('ats-lab')}
          />
        </div>

      </div>

      {/* Dolny pasek: pomoc i konto. Bez duplikowania etapu wydania. */}
      <div className="space-y-2.5 border-t border-line pt-3">
        {/* Linki prawne i wsparcie na dole paska */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-1 text-[10px] text-muted font-medium">
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-ink hover:underline cursor-pointer transition-colors"
            >
              Prywatność & RODO
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsSupportOpen(true)}
              className="hover:text-ink hover:underline cursor-pointer transition-colors"
            >
              Kontakt & Wsparcie
            </button>
          </div>
        )}

        {/* Pigułka Konta Użytkownika */}
        <Tooltip
          content={
            isAuthenticated
              ? `${userEmail} · Dane konta są chronione`
              : accountLabel
          }
          side={isCollapsed ? 'right' : 'top'}
          className="w-full"
        >
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`flex w-full min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface p-2 text-left transition-colors duration-[var(--duration-fast)] ease-out hover:border-brand-500/30 hover:bg-brand-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 font-bold text-xs">
              {isAuthenticated ? (
                userEmail ? (
                  <span className="text-[11px] font-bold text-brand-700">
                    {userEmail.slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <User className="h-4 w-4 text-brand-600" />
                )
              ) : (
                <LogIn className="h-4 w-4" />
              )}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-label font-semibold text-ink flex-1">
                    {isAuthenticated ? userEmail : accountLabel}
                  </p>
                  {isAuthenticated && (
                    <span
                      title="Dane konta są chronione"
                      aria-label="Dane konta są chronione"
                      className="inline-flex items-center text-success-fg shrink-0"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                {!isAuthenticated && <p className="truncate text-[10px] text-muted">{accountHint}</p>}
              </div>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Modale prawne i kontaktu */}
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      <SupportContactModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
