import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileSidebar } from '../MobileSidebar';
import { VaultSyncIndicator } from '../ui/VaultSyncIndicator';
import { NavSectionId, NavTabId } from '../../lib/navigation';
import { useAppStore } from '../../store/useAppStore';
import {
  FREE_BETA_PRICE_PLN,
  PUBLIC_PREBETA_CODE,
  PUBLIC_PREBETA_LABEL,
  PUBLIC_PREBETA_MESSAGE,
} from '../../lib/beta';

export interface ShellProps {
  children: React.ReactNode;
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  onOpenAdvisor: (initialQuestion?: string) => void;
  onOpenAuthModal: () => void;
  onOpenCvPreview?: () => void;
  onOpenDesignTokens?: () => void;
  /** Sekcje odblokowane dla tego użytkownika (progresywne odsłanianie). */
  unlockedSections?: Partial<Record<NavSectionId, boolean>>;
  lockReasons?: Partial<Record<NavSectionId, string>>;
  isAuthenticated?: boolean;
  userEmail?: string;
  planStatus?: 'free' | 'trialing' | 'active';
}

export const Shell: React.FC<ShellProps> = ({
  children,
  activeTab,
  onSelectTab,
  onOpenAdvisor,
  onOpenAuthModal,
  onOpenCvPreview,
  onOpenDesignTokens,
  unlockedSections,
  lockReasons,
  isAuthenticated = false,
  userEmail,
  planStatus = 'free',
}) => {
  // Zwinięcie paska żyje w useAppStore z persystencją — wcześniej Shell trzymał
  // własny useState, a sklep miał martwe settery; preferencja ginęła co
  // odświeżenie strony.
  const { sidebarCollapsed: isSidebarCollapsed, toggleSidebar } = useAppStore();

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectTab = (tab: NavTabId) => {
    onSelectTab(tab);
    setIsMobileDrawerOpen(false);
  };

  return (
    <div className="relative flex min-h-screen bg-surface font-sans text-ink">
      {/* Poświata otoczenia — patrz `.aurora-bg` w index.css */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Desktop Sticky Sidebar (16rem / 4rem) */}
      <aside
        className={`glass-rail sticky top-0 z-30 hidden h-screen shrink-0 transition-all duration-300 lg:block ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onOpenAdvisor={() => onOpenAdvisor()}
          onOpenAuthModal={onOpenAuthModal}
          onOpenCvPreview={onOpenCvPreview}
          unlockedSections={unlockedSections}
          lockReasons={lockReasons}
          isAuthenticated={isAuthenticated}
          userEmail={userEmail}
          planStatus={planStatus}
        />
      </aside>

      {/* Mobile Drawer (MobileSidebar) */}
      <MobileSidebar
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        title="CVELOCITY"
      >
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onOpenAdvisor={() => {
            setIsMobileDrawerOpen(false);
            onOpenAdvisor();
          }}
          onOpenAuthModal={() => {
            setIsMobileDrawerOpen(false);
            onOpenAuthModal();
          }}
          onOpenCvPreview={() => {
            setIsMobileDrawerOpen(false);
            onOpenCvPreview?.();
          }}
          unlockedSections={unlockedSections}
          lockReasons={lockReasons}
          isAuthenticated={isAuthenticated}
          userEmail={userEmail}
          planStatus={planStatus}
        />
      </MobileSidebar>

      {/* Main Layout Column */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col overflow-x-hidden">
        {/* Topbar (56px) */}
        <Topbar
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenAdvisor={() => onOpenAdvisor()}
          onOpenAuthModal={onOpenAuthModal}
          onSelectTab={handleSelectTab}
          onOpenDesignTokens={onOpenDesignTokens}
          isAuthenticated={isAuthenticated}
          userEmail={userEmail}
        />

        <button
          type="button"
          onClick={() => handleSelectTab('pricing')}
          className="mx-3 mt-2 flex items-center justify-center gap-2 rounded-xl border border-[#F26440]/35 bg-[#F26440]/10 px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#F6A18C] transition-colors hover:bg-[#F26440]/15 sm:mx-4 lg:mx-6"
          aria-label="Zobacz informacje o publicznej wersji testowej CVelocity"
        >
          <span>{PUBLIC_PREBETA_LABEL}</span>
          <span aria-hidden="true">·</span>
          <span>{PUBLIC_PREBETA_CODE}</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="hidden sm:inline">{PUBLIC_PREBETA_MESSAGE}</span>
          <span aria-hidden="true">·</span>
          <span>{FREE_BETA_PRICE_PLN} zł</span>
        </button>

        <VaultSyncIndicator />

        {/* Content Area (p-6 lg:p-8, max-width 1440px / 1680px on 2K) */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:p-8">
          <div className="mx-auto max-w-[1440px] 2xl:max-w-[1680px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
