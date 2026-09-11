import React, { useState } from 'react';
import {
  IconShield,
  IconZap,
  IconSparkles,
  IconVault,
  IconCheckCircle,
  IconAlertTriangle,
  IconParser,
  IconPalette,
  IconRadar,
} from '../components/ui/icons/ModernIcons';
import { motion } from 'motion/react';
import { PricingCard } from '../components/ui/PricingCard';
import { LockCover } from '../components/ui/LockCover';
import { useEntitlements, FREE_MONTHLY_IMPORTS, FREE_DAILY_AI_USES } from '../store/useEntitlements';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { showToast } from '../store/useToastStore';
import { BETA_LABEL, BETA_NOTICE, PURCHASES_DISABLED_REASON } from '../lib/betaConfig';

type PricingSubTab = 'pricing' | 'features' | 'validation';

export const PricingView: React.FC = () => {
  const { usage, isPro } = useEntitlements();
  const [activeSubTab, setActiveSubTab] = useState<PricingSubTab>('pricing');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const subTabs = [
    { id: 'pricing' as PricingSubTab, label: 'Cennik & Plany', icon: IconZap as any },
    { id: 'features' as PricingSubTab, label: 'Funkcje Premium & Dema', icon: IconSparkles as any },
    { id: 'validation' as PricingSubTab, label: 'Standardy Uczciwości (Win-Win)', icon: IconShield as any },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Hero Header */}
      <div className="space-y-4">
        <PageHeader
          title="CVelocity — Bezpłatna Beta"
          description="Wersja testowa: pełny podstawowy przepływ aplikacji (edycja Master Vault, audyt ATS, eksport PDF oraz symulator rozmowy i teleprompter) jest bezpłatny. Aktywne zakupy komercyjne są wyłączone. Serwer egzekwuje limit 5 operacji AI / dzień."
          badge={BETA_LABEL}
        />

        {/* Informacja o bezpłatnej becie i wyłączonych zakupach */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-xs text-brand-fg">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <strong>{BETA_LABEL}:</strong> {BETA_NOTICE} {PURCHASES_DISABLED_REASON}
          </span>
        </div>

        {/* Hero baner z informacją o planie */}
        <div className="flex flex-wrap items-center gap-6 rounded-3xl border border-line bg-surface/90 p-6 sm:p-8 backdrop-blur-xl shadow-raised">
          <div className="text-brand-grad font-mono text-6xl sm:text-7xl font-extrabold tracking-tight">
            0 zł
          </div>
          <div className="max-w-md border-l border-line pl-6 text-xs sm:text-sm text-muted leading-relaxed">
            <b className="text-ink font-semibold">Podstawowy przepływ bezpłatny w becie:</b> edycja Master Vault, audyt ATS, eksport PDF, przygotowanie do rozmowy i teleprompter. Zakupy komercyjne są wyłączone.
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-brand-500/10 border border-brand-500/20 px-4 py-2 text-xs font-bold text-brand-fg">
              <IconCheckCircle className="h-4 w-4" />
              <span>Twój aktywny plan: {BETA_LABEL} (Tester)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div className="flex justify-center">
        <Tabs<PricingSubTab>
          items={subTabs}
          active={activeSubTab}
          onChange={setActiveSubTab}
          className="max-w-xl"
        />
      </div>

      {/* TAB 1: CENNIK & PLANY */}
      {activeSubTab === 'pricing' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
          className="space-y-8"
        >
          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`cursor-pointer rounded text-label font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 ${
                billingCycle === 'monthly' ? 'text-ink' : 'text-muted'
              }`}
            >
              Rozliczenie miesięczne
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle((b) => (b === 'monthly' ? 'annual' : 'monthly'))}
              role="switch"
              aria-checked={billingCycle === 'annual'}
              aria-label="Przełącz rozliczenie roczne"
              className={`relative h-6 w-11 cursor-pointer rounded-full border border-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 ${
                billingCycle === 'annual' ? 'bg-brand-600' : 'bg-sunken'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-on-brand transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`cursor-pointer rounded text-label font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 ${
                billingCycle === 'annual' ? 'text-ink' : 'text-muted'
              }`}
            >
              Rozliczenie roczne{' '}
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success-fg">
                Oszczędzasz 20%
              </span>
            </button>
          </div>

          {/* 3 Pricing Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* FREE PLAN */}
            {/* FREE / BETA PLAN */}
            <PricingCard
              title="CVelocity Beta"
              price="0"
              currency="zł"
              period="/ bezpłatna beta"
              description="Kompletny fundament dla każdego testera i kandydata poszukującego pracy."
              features={[
                'Pełny edytor Master Vault',
                'Ręczny parser i wklejanie tekstu CV',
                'Audyt ATS & Score Ring 0–100%',
                'Darmowy eksport PDF i DOCX (szablony bazowe)',
                'Pipeline aplikacji',
                'Narzędzia rozmowy i teleprompter bez płatnego karnetu',
                `${FREE_MONTHLY_IMPORTS} darmowy Instant-Import pliku / mc`,
                `${FREE_DAILY_AI_USES} darmowych operacji AI / dzień (limit serwera)`,
              ]}
              excluded={[
                'Nielimitowane importy plików PDF/DOCX (poza zakresem bety)',
                'Nielimitowany asystent AI Gap-Fixer (poza zakresem bety)',
                'Analityka Pro Insights (poza zakresem bety)',
              ]}
              disabled={true}
              ctaLabel="Twój obecny plan (Beta)"
              onSelect={() => {}}
            />

            {/* PRO PLAN - WYŁĄCZONY W BECIE */}
            <PricingCard
              title="CVelocity Pro"
              price={billingCycle === 'monthly' ? '49' : '39'}
              currency="zł"
              period="/ miesiąc brutto"
              note="Plan komercyjny (niedostępny w fazie beta)"
              isPopular={false}
              description="Plan komercyjny dla zaawansowanych użytkowników — w fazie testowej wyłączony."
              features={[
                'Wszystko co w planie Beta',
                'Nielimitowany Instant-Import (PDF, DOCX)',
                'Nielimitowany asystent AI Gap-Fixer',
                'Pełny dostęp do wszystkich szablonów A4',
                'Pro Insights (funkcja poza zakresem bety)',
              ]}
              ctaLabel="Zakupy wyłączone w becie"
              disabled={true}
              onSelect={() => {
                showToast('Zakupy wyłączone', {
                  message: 'W trakcie bezpłatnej bety zakupy są wyłączone. Wszystkie udostępnione funkcje są darmowe.',
                  variant: 'info',
                });
              }}
            />

            {/* SINGLE TEMPLATE - WYŁĄCZONY W BECIE */}
            <PricingCard
              title="Szablony Jednorazowe"
              price="19"
              currency="zł"
              period="/ jednorazowo"
              note="Szablony dostępne w aplikacji bez opłat w okresie bety"
              description="Zakupy komercyjne szablonów są wyłączone — wszystkie wzory przetestujesz bezpłatnie."
              features={[
                'Dostęp do szablonów w edytorze dokumentów',
                'Szablony Executive i Creative',
                'Edycja WYSIWYG w czasie rzeczywistym',
                'Eksport PDF & DOCX w wysokiej rozdzielczości',
                'Brak subskrypcji i cyklicznych opłat',
              ]}
              excluded={[
                'Nielimitowane operacje AI (obowiązuje limit dobowy)',
              ]}
              ctaLabel="Zakupy wyłączone w becie"
              disabled={true}
              onSelect={() => {
                showToast('Zakupy wyłączone', {
                  message: 'W trakcie bezpłatnej bety zakupy są wyłączone. Szablony możesz wypróbować bezpłatnie.',
                  variant: 'info',
                });
              }}
            />
          </div>

          {/* Payment status signal */}
          <div className="flex flex-col items-center gap-2 pt-1 text-center">
            <p className="text-xs text-muted">
              W fazie bezpłatnej bety transakcje płatnicze Stripe są wyłączone. Dostęp do aplikacji nie wymaga karty ani płatności.
            </p>
          </div>

          {/* Feature Comparison Table */}
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 space-y-5">
            <h2 className="text-base font-bold text-ink">Szczegółowe Porównanie Funkcji</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-line text-muted uppercase text-[10px]">
                    <th className="pb-3 font-semibold">Funkcjonalność</th>
                    <th className="pb-3 font-semibold text-brand-fg">Bezpłatna Beta</th>
                    <th className="pb-3 font-semibold text-muted">Pro (poza zakresem)</th>
                    <th className="pb-3 font-semibold text-muted">Szablony płatne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  <tr>
                    <td className="py-3 text-ink font-sans">Tworzenie i edycja Master Vault</td>
                    <td className="py-3 text-success-fg">Nielimitowane</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Audyt ATS i analiza luk (Score Ring)</td>
                    <td className="py-3 text-success-fg">Darmowe</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Eksport PDF / DOCX</td>
                    <td className="py-3 text-success-fg">Darmowy (Wszystkie szablony)</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                    <td className="py-3 text-muted">Darmowe w edytorze</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Narzędzia rozmowy & Teleprompter Live HUD</td>
                    <td className="py-3 text-success-fg font-bold">Darmowe (bez płatnego karnetu)</td>
                    <td className="py-3 text-muted">Wyłączony w becie</td>
                    <td className="py-3 text-muted">—</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Instant-Import z plików CV</td>
                    <td className="py-3 text-ink">1 plik / mc (wklejanie tekstu: b/o)</td>
                    <td className="py-3 text-muted">Poza zakresem bety</td>
                    <td className="py-3 text-muted">—</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Optymalizacje AI Gap-Fixer</td>
                    <td className="py-3 text-ink">5 ulepszeń / dzień (limit serwera)</td>
                    <td className="py-3 text-muted">Poza zakresem bety</td>
                    <td className="py-3 text-muted">—</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-ink font-sans">Analityka Pro Insights</td>
                    <td className="py-3 text-muted">Poza zakresem bety</td>
                    <td className="py-3 text-muted">Poza zakresem bety</td>
                    <td className="py-3 text-muted">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: FUNKCJE PREMIUM & DEMA */}
      {activeSubTab === 'features' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Feature 1: Instant-Import */}
            <div className="rounded-3xl border border-line bg-elevated p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <IconParser className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">1. Instant-Import CV</h3>
                    <p className="text-xs text-muted">Import z pliku zamiast ręcznego przepisywania</p>
                  </div>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-fg">
                  1 free / mc • Pro
                </span>
              </div>

              <div className="rounded-2xl border border-dashed border-line bg-surface p-4 text-center text-xs text-muted">
                <p>Upuść plik PDF/DOCX, a silnik automatycznie zmapuje go do Master Vault.</p>
                <div className="mt-2 font-mono text-[11px] text-ink">
                  Pozostało na Twoim koncie: <b>{isPro ? 'Nielimitowane' : `${usage.importUses} / 1`}</b>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Wklejanie tekstu: <b>Zawsze darmowe</b></span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={true}
                  onClick={() => {}}
                >
                  Zakupy wyłączone w becie
                </Button>
              </div>
            </div>

            {/* Feature 2: AI Gap-Fixer */}
            <div className="rounded-3xl border border-line bg-elevated p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <IconSparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">2. AI Gap-Fixer</h3>
                    <p className="text-xs text-muted">Inteligentne uzupełnianie słów kluczowych ATS</p>
                  </div>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 font-mono text-[10px] font-bold text-success-fg">
                  5 free / dzień (limit serwera)
                </span>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 text-xs space-y-2">
                <div className="flex justify-between font-mono text-[11px]">
                  {/* Limit AI jest dobowy — tak rezerwuje go serwer
                      (`reserve_ai_quota`), więc i tu mówimy „dziś”. */}
                  <span>Dzisiejszy limit ulepszeń AI:</span>
                  <b>{isPro ? 'Nielimitowane' : `${usage.aiUses} / 5`}</b>
                </div>
                <p className="text-muted text-[11px]">
                  Zamiast zgadywać, dlaczego system odrzuca aplikację, AI wskaże brakujące narzędzia i sformułowania.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Koszt tokenów: <b>Pokrywany w ramach limitu</b></span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={true}
                  onClick={() => {}}
                >
                  Zakupy wyłączone w becie
                </Button>
              </div>
            </div>

            {/* Feature 3: Template Marketplace */}
            <div className="rounded-3xl border border-line bg-elevated p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <IconPalette className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">3. Szablony A4</h3>
                    <p className="text-xs text-muted">Wszystkie szablony są odblokowane do testów w becie</p>
                  </div>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 font-mono text-[10px] font-bold text-success-fg">
                  Darmowe w becie
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                <div className="rounded-xl border border-line bg-surface p-3">
                  <span className="text-success-fg font-bold">Modern i Minimal</span>
                  <div className="text-[10px] text-muted">0 zł w edytorze</div>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3">
                  <span className="text-brand-fg font-bold">Executive i Creative</span>
                  <div className="text-[10px] text-muted">0 zł w edytorze (beta)</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Eksport PDF: <b>Zawsze darmowy</b></span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={true}
                  onClick={() => {}}
                >
                  Dostępne w edytorze (0 zł)
                </Button>
              </div>
            </div>

            {/* Feature 4: Pro Insights CRM */}
            <div className="rounded-3xl border border-line bg-elevated p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <IconRadar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">4. Pro Insights</h3>
                    <p className="text-xs text-muted">Trendy odpowiedzi rekruterów i analityka (poza zakresem bety)</p>
                  </div>
                </div>
                <span className="rounded-full bg-sunken px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted">
                  Poza zakresem
                </span>
              </div>

              <p className="text-[11px] text-muted">
                Podstawowy rejestr aplikacji w Pipeline jest w 100% darmowy. Zaawansowane wykresy konwersji i estymacja czasu do oferty pozostają poza zakresem bezpłatnej bety.
              </p>

              {/* Teaser: the shape of the data is visible, the values are not */}
              <LockCover
                intensity="data"
                label="Funkcja poza zakresem bezpłatnej wersji beta"
                action={
                  <Button variant="secondary" size="sm" disabled={true}>
                    Niedostępne w fazie beta
                  </Button>
                }
              >
                <div className="flex h-[140px] items-end gap-2 bg-surface p-3">
                  {[38, 52, 60, 74, 88, 100].map((h, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                      <div
                        className={`w-full rounded-t-md rounded-b-sm ${
                          i >= 4 ? 'bg-brand-grad' : i >= 2 ? 'bg-brand-600' : 'bg-brand-200'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-center font-mono text-[9.5px] text-subtle">
                        {['sty', 'lut', 'mar', 'kwi', 'maj', 'cze'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </LockCover>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Status: <b>Planowane po fazie beta</b></span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={true}
                >
                  Poza zakresem bety
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 3: STANDARDY UCZCIWOŚCI & KODEKS WIN-WIN */}
      {activeSubTab === 'validation' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
          className="space-y-6"
        >
          {/* 4 Ethical Pillars */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-line bg-elevated p-5 shadow-xs">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <IconZap className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">Realny Problem</h4>
              <p className="mt-1 text-[11px] text-muted leading-relaxed">
                Eliminacja ręcznego przepisywania dokumentów i wielogodzinnego dopasowywania słów kluczowych.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-elevated p-5 shadow-xs">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <IconRadar className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">Mierzalny Efekt</h4>
              <p className="mt-1 text-[11px] text-muted leading-relaxed">
                Audyt ATS pokazuje wynik 0–100% i konkretną listę luk przed wysyłką — poprawiasz dokładnie to, co obniża ocenę, zamiast zgadywać.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-elevated p-5 shadow-xs">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <IconVault className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">Pełna Opcjonalność</h4>
              <p className="mt-1 text-[11px] text-muted leading-relaxed">
                Darmowy plan pozostaje w 100% użyteczny. Żadnych blokad dostępu do Twoich własnych danych.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-elevated p-5 shadow-xs">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <IconShield className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">Zero Dark Patterns</h4>
              <p className="mt-1 text-[11px] text-muted leading-relaxed">
                Ceny brutto z VAT, brak sztucznej pilności i rezygnacja z subskrypcji w 2 kliknięciach.
              </p>
            </div>
          </div>

          {/* Ethics Checklist from WALIDACJA.md */}
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 space-y-4">
            <h2 className="text-sm font-bold text-ink">Checklista Etyki i Ochrony Użytkownika</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-elevated p-3 border border-line">
                <IconCheckCircle className="h-4 w-4 text-success-fg shrink-0" />
                <span>Brak ukrytych kosztów – ceny brutto z VAT widoczne przed płatnością</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-elevated p-3 border border-line">
                <IconCheckCircle className="h-4 w-4 text-success-fg shrink-0" />
                <span>Anulowanie subskrypcji w ≤ 2 kliknięciach przez Stripe Customer Portal</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-elevated p-3 border border-line">
                <IconCheckCircle className="h-4 w-4 text-success-fg shrink-0" />
                <span>Brak confirmshamingu („Nie, nie chcę lepszej pracy”)</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-elevated p-3 border border-line">
                <IconCheckCircle className="h-4 w-4 text-success-fg shrink-0" />
                <span>Darmowy rdzeń aplikacji – tworzenie CV i eksport PDF zawsze bezpłatne</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
