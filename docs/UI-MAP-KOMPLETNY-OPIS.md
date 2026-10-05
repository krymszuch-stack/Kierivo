# CVELOCITY — KOMPLETNY OPIS UI/UX I POŁĄCZEŃ MODUŁÓW
### Dokument obserwacyjny „pixel po pikselu". Zero ocen — tylko to, co jest w kodzie.

> **Źródło:** stan gałęzi `main`. Każda sekcja podaje plik i linię, żeby opis
> dał się zweryfikować w 10 sekund. Kolory podane jako token + wartość hex
> z `tokens.css` dla danego motywu (J = jasny, C = ciemny).

---

## 1. MAPA APLIKACJI — ZAKŁADKI I PLIKI

Router URL nie istnieje. Nawigacja = zmienna `activeTab` w `useAppStore`
(`src/store/useAppStore.ts`) + warunkowe renderowanie widoków przez `React.lazy`
w `App.tsx:36–46`.

| Zakładka (`NavTabId`) | Widok (plik) | Wejście |
|---|---|---|
| `home` | `src/views/HomeView.tsx` | logo w sidebarze, pozycja startowa |
| `profil` | `features/profile/ProfileSection.tsx` → `MasterVaultEditor`, `ProfilerSection`, `CVParserModal` | sidebar „Profil" |
| `aplikuj` | `features/matcher/JobMatcher.tsx` (+ `DocumentRenderer`, `JDKeywordMapper`, `InterviewCheatSheetView`, `AtsSimulatorView`, `CoverLetterView`, `DealbreakerList`, `RealtimeLivePreview`) | sidebar „Aplikuj", CTA z Home |
| `trenuj` | `features/cockpit/InterviewCockpitView.tsx`, `star/STARStoryView`, `drill/DrillModeModal`, `loop/*` | sidebar „Trenuj" |
| `pipeline` | `features/tracker/ApplicationTracker.tsx` (+ `TrackerTable`, `ApplicationModal`, `StatusSelect`) | sidebar „Pipeline", karty ofert |
| `pricing` | `views/PricingView.tsx` | sidebar „Cennik & Pakiety Pro", menu konta |
| `ats-lab` | `features/ats/AtsLabView.tsx` | dedykowane wejście laboratorium |

Sekcje menu (4 czasowniki podróży) zdefiniowane w `src/lib/navigation.ts`:
**Profil → Aplikuj → Trenuj → Pipeline**, każda z `hint` czytanym w tooltipie.
`home/pricing/ats-lab` leżą poza sekcjami progresywnego odsłaniania.

---

## 2. FUNDAMENT WIZUALNY

### 2.1. Motywy
- Dwa motywy sterowane atrybutem `data-theme="dark"` + klasą `.dark` na `<html>`
  (`ThemeProvider.tsx`). Zapis: klucz `cvelocity:theme` (J/C), domyślnie **dark**
  — produkt dark-first (`ThemeProvider.tsx:22`).
- Przełączenie: `ThemeToggle` w Topbarze; ikona Sun/Moon z animacją rotate.

### 2.2. Paleta — pełna tabela tokenów (`tokens.css`)

**Powierzchnie i atrament**

| Token | Jasny | Ciemny | Rola |
|---|---|---|---|
| `--surface` | `#ffffff`(sekcja :root ~#fff) | `#07080f` | tło aplikacji |
| `--sunken` | `#ececea` | `#0b0c16` | pola formularzy, tory pasków |
| `--elevated` | `#ffffff` | `#101221` | karty |
| `--paper` / `--paper-ink` | `#ffffff` / `#17171a` | **te same** | kartka A4 (bez dark-mode) |
| `--ink` | `#17171a` | `#f2f4f8` | tekst podstawowy |
| `--muted` | `#595d65` | `#9aa1b4` | tekst drugorzędny (6,6:1 / 6,8:1) |
| `--subtle` | `#72767e` | `#828a9e` | placeholder/locki (4,57:1 / 5,2:1) |
| `--line` / `--line-strong` | `#e5e5e3` / `#d3d3d0` | `#1c1f2e` / `#2b3047` | obramowania |

**Rampa brandowa (interfejs — indygo/fiolet)**

| Token | Jasny | Ciemny |
|---|---|---|
| `brand-50…950` | `#f0f2fc … #202449` | `#1b1d2f … #f0f2fd` (odwrócona) |
| `brand-500` / `600` | `#6f7ad9` / `#5e6ad2` | `#7c86e0` / `#8b93e8` |
| `brand-fg` | `#4650a8` | `#b7bdf5` |
| `on-brand` | `#ffffff` | `#101013` |
| `violet` / `violet-2` | `#8b5cf6` / `#a855f7` | `#a78bfa` / `#c4b5fd` |
| `brand-grad` | `120° #5e6ad2→#7c3aed` | `120° #8b93e8→#a78bfa` |

**Sygnet (mark) — granat/pomarańcz księgi znaku**

| Token | Wartość | Użycie |
|---|---|---|
| `mark-ink` | J `#1E3A5F` / C `#FFFFFF` | wordmark CV**ELOCITY** |
| `mark-accent` | `#F26440` (oba) | litera ELOCITY, ikona V w sygnecie |
| `mark-tile-grad` | `135° #1E3A5F→#0F172A` (oba) | kafelek sygnetu |
| `mark-glow` | `0 0 12px rgba(242,100,64,.15/.2)` | poświata kafelka |

**Semantyki** (soft tło + fg tekst): success `#16a34a/#0f7a37/#e5f5ea`,
warning `#d97706/#b45309/#fdf0e0`, danger `#dc2626/#b91c1c/#fdeaea`
(ciemne warianty odpowiednio jaśniejsze).

**Dekoracje:** ambient cool/warm `#4361ff`/`#f97316` (α 14%/11% J, wyżej w C),
szkło `--glass-fill rgba(255,255,255,.72)` / ciemny odpowiednik,
`--display-grad: 100° #3b5bdb→ink→#c2410c` (nagłówek ekspozycyjny Home).

**Cienie/krzywe:** `shadow-raised`, `shadow-floating`, klasy `.shadow-brand-glow`
(fiolet 40%), `.shadow-mark-glow`; `--ease cubic-bezier(.19,1,.22,1)`,
`--spring cubic-bezier(.34,1.56,.64,1)`.

### 2.3. Typografia
- `--font-sans: Geist, system…`, `--font-mono: Geist Mono` — mono dla badge'y
  (v2.0, ATS, Ctrl+K), dat i liczb.
- Skala w praktyce: `text-[9px]` badge monospace → `[10px]/[11px]` daty/hinty →
  `text-xs` (dominanta body) → `text-sm` opisy → `text-base/lg` H3/H2 kart →
  `text-xl/2xl` H1 widoków (`PageHeader`) → Home hero `text-[2rem→3.5rem]`.
- Kerning: `tracking-tight` na displayach, `tracking-wider uppercase` na
  etykietkach sekcji; tokeny `--text-meta`(11 px)/`--text-label`(12 px).
- Interlinie: `leading-relaxed` w akapitach, `leading-snug/tight` w hintach;
  DOCX body 1.15 (`line:276`).

### 2.4. Promienie
`rounded-lg(8) xl(16) 2xl(24)`; kontrolki `rounded-xl`, pola po unifikacji
`rounded-xl`, karty `rounded-2xl`, panele/hero `rounded-3xl`, pigułki `rounded-full`.

### 2.5. Tła dekoracyjne (`index.css`)
- `.aurora-bg` + `.aurora-blob-1/2/3` — trzy rozmyte plamy ambient-cool/warm za
  całą aplikacją (Shell:63–67); w `prefers-reduced-motion` zamrożone.
- `.glass-rail` (sidebar), `.glass-panel` (Topbar, pill Home) — półprzezroczyste
  wypełnienie + `backdrop-blur` z `--glass-blur:20px`.
- `.card-ambient` — karty raised przepuszczają aurorę zamiast jej zasłaniać.
- `.animate-shimmer` — skelety; `.animate-ripple` — kliknięcia Buttona.

### 2.6. Wydruk (`@media print`)
`@page A4 margin 15mm`; izolacja `visibility` do `#cv-printable-document`
(position absolute, padding 0, bez border/shadow/radius); globalnie czarny tekst,
zero cieni/tłowych grafik; ukryte `nav/aside/button/[role=button]/.no-print`;
`.page-break-inside-avoid` na wpisach doświadczenia i kartach STAR.

---

## 3. SZKIELET LAYOUTU (`layout/Shell.tsx`)

```
div.min-h-screen.bg-surface.font-sans.text-ink (relative flex)
├── .aurora-bg (3 bloby)
├── aside.glass-rail.sticky.top-0.z-30.h-screen.lg:block.w-64⇄w-16 (duration-300)
│   └── <Sidebar/>            ← desktop
├── <MobileSidebar/>          ← drawer < lg, motion x:-300→0, backdrop blur
└── div.flex-1.flex-col.overflow-x-hidden.relative.z-10
    ├── <Topbar/>             ← h-14 glass-panel sticky top-3 mx-3 rounded-2xl
    └── main.flex-1.px-4.py-6.sm:px-6.lg:p-8 > div.max-w-[1440px] {children}
```

Resize ≥1024 px zamyka mobilny drawer automatycznie (`Shell.tsx:45–53`).

---

## 4. PRYMITYWY `src/components/ui/*`

### 4.1. Button (`Button.tsx`)
- Warianty (tło/tekst/border/hover): **primary** `bg-brand-grad text-on-brand
  shadow-raised hover:brightness-110 hover:shadow-brand-glow-lg`; **secondary**
  `bg-elevated text-ink border-line hover:bg-brand-50 hover:text-brand-fg`;
  **ghost** `text-muted hover:bg-surface`; **outline** `text-ink border-line
  hover:bg-surface`; **danger** `bg-danger-soft text-danger-fg border-danger/30`.
- Rozmiary: sm `py-1 px-2.5 text-xs rounded-lg`, md `py-2 px-3.5 text-xs
  rounded-xl`, lg `py-2.5 px-5 text-sm rounded-xl`; tryb icon-only zwęża px.
- Stany: `disabled:opacity-50 cursor-not-allowed`; loading = spinner `Loader2`
  + `aria-busy`, klik zablokowany; ripple `bg-current opacity-20` pozycjonowany
  w punkt kliknięcia; motion scale 1.02/0.98 (180 ms, ease .19/1/.22/1).

### 4.2. Card (`Card.tsx`)
- Tone: **flat** `bg-surface`, **raised** `card-ambient bg-elevated shadow-raised`,
  **sunken** `bg-sunken`. Wspólne: `rounded-2xl border p-5`.
- Hover (raised): `hover:border-brand-500/40 hover:shadow-lg
  hover:shadow-brand-500/5` + motion `y:-2, scale:1.005` (200 ms).

### 4.3. Chip / PremiumBadge
- Chip: 5 wariantów semantycznych (brand/neutral/success/warning/danger) jako
  pary soft-tło+fg+border; `font-mono font-medium`; sm `px-2 py-0.5 text-[11px]
  rounded-md`; opcjonalny onClick → `hover:border-brand-500`.
- PremiumBadge: pigułka `bg-brand-grad text-on-brand shadow-brand-glow
  rounded-full` + Sparkles; default treść **Pro**.

### 4.4. Tabs (`Tabs.tsx`)
- **pill**: aktywne tło/jak Button primary; **underline**: `role="tablist"`/
  `role="tab"`+`aria-selected`, wskaźnik `motion.div layoutId="tab-underline"
  h-0.5 bg-brand-600` spring(500/35), badge mono 9 px `bg-brand-50
  text-brand-fg`.

### 4.5. ProgressBar / ScoreRing / Skeleton
- ProgressBar: tor `rounded-full bg-sunken border-line/60`, wypełnienie motion
  width 400 ms ease, `role="progressbar"` + aria-valuenow/min/max; opcjonalny
  label „Postęp …%" mono.
- ScoreRing (`ScoreRing.tsx`): SVG viewBox 100×100, r=42, stroke=8,
  `dasharray=C`, offset animowany 700 ms `--ease`; track `text-surface-sunken`,
  łuk `text-brand`; środek liczba mono 4xl/5xl + label uppercase 11 px;
  `role="img"` + aria-label.
- Skeleton: 4 warianty geometrii (text/circle/card/rectangle), `animate-shimmer`,
  kontener `aria-busy="true" aria-live="polite"`, `count` generuje listę.

### 4.6. Modal (`Modal.tsx`)
- Backdrop `fixed inset-0 bg-ink/40 backdrop-blur-sm` (klik = onClose); karta
  `rounded-2xl bg-surface p-6 sm:p-7 shadow-floating max-h-[90vh] overflow-auto`;
  rozmiary sm..full = `max-w-md/lg/2xl/4xl/6xl`.
- A11y: `role="dialog" aria-modal`, `aria-labelledby/describedby` na id z
  `useId`, focus-trap (pierwszy element → cykl Tab → powrót do wywołującego),
  ESC globalnie, scroll-lock body.

### 4.7. Field (Input/Textarea/Select)
- Wspólny szkielet: label `text-xs uppercase tracking-wider text-muted`
  (+ gwiazdka required `text-danger-fg`) → kontrolka → komunikaty.
- Kontrolka: `bg-sunken text-xs font-medium placeholder:text-subtle
  focus:border-brand-500/60 focus:ring-2 ring-brand-500/20 rounded-xl`;
  błąd: `border-danger/60 ring-danger/20` + tekst `role="alert"`
  `text-[11px] text-danger-fg`; hint `text-[11px] text-muted`; oba wiązane
  `aria-describedby`, pole dostaje `aria-invalid`.
- Ikona w polu: absolutna left-3.5, wymusza `pl-10`.

### 4.8. Pozostałe
- **Toggle**: tor `h-6 w-11 rounded-full`, ON `bg-brand-600`/OFF `bg-sunken
  border-line`; kciuk 16 px spring(500/30) translate-x-1⇄6; `role="switch"`
  + `aria-checked`; etykieta bold 12 px + description 11 px.
- **EmptyState**: dashed `border-line bg-surface/40 p-8/12`, ikona w kaflu
  `bg-sunken` 56 px, H4 bold, opis `max-w-sm text-xs muted`, slot akcji;
  `role="status" aria-live="polite"`.
- **PageHeader**: H1 `text-xl→2xl extrabold tracking-tight` + badge mono 10 px +
  opis `text-xs/sm muted` + slot actions po prawej.
- **Chip/PricingCard/StatTile/RadioGroup/Slider/LockCover/Feedback/TrustChip/
  AdvisorButton/Combobox** — rodzina spójna z powyższymi tokenami (Combobox =
  input + listbox + nawigacja z `comboboxNavigation.ts`).
- **ToastHost**: fixed bottom-5 right-5 z-[120]; karta `min-w-260 max-w-360
  bg-elevated border-l-[3px]` w kolorze wariantu; wjazd y+10/scale .98 → 1
  (300 ms); `role="status" aria-live="polite"`; TTL w `useToastStore`.

---

## 5. LAYOUTY NAWIGACYJNE

### 5.1. Sidebar (`layout/Sidebar.tsx`)
- Nagłówek: `<CVelocityLogo/>` (kafelek mark-tile-grad 32 px + wordmark
  `CV`(mark-ink)`ELOCITY`(mark-accent) + badge v2.0 mono 9 px
  `border-mark-accent/20 bg-mark-accent/10`) jako button → `home`; obok toggle
  PanelLeftClose/Open `text-muted hover:bg-brand-500/10`.
- Nawigacja: 4× `NavItem` (sekcje) — stany opisane w 5.2.
- Stopka: blok autoryzacji — niezalogowany: przycisk „Zaloguj się…" (LogIn);
  zalogowany: e-mail, plan, wylogowanie/usunięcie konta w Topbarze.

### 5.2. NavItem (`NavItem.tsx`)
- Baza: `w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold
  transition duration-200 focus-visible:ring-brand-500/50`.
- Aktywny: nakładka `motion layoutId="activeNav"` — `inset-0 rounded-xl
  border-l-2 border-brand-600 bg-brand-500/10 shadow-xs`, tekst `text-brand-fg
  font-bold`, ikona `text-brand-600`; `aria-current="page"`.
- Nieaktywny: `text-muted hover:bg-brand-500/5 hover:text-ink`, ikona
  `text-subtle group-hover:scale-110`.
- Zablokowany: `disabled` + `aria-disabled` + Lock 12 px + tooltip =
  `lockedReason` (klik nieaktywny).
- Badge: mono 9 px uppercase, trzy warianty jak Chip.

### 5.3. Topbar (`Topbar.tsx`)
Lewa: hamburger (mobile) → MobileSidebar; pigułka nazwy sekcji mono 12 px.
Prawa: przycisk „Szukaj… Ctrl+K" (dispatch KeyboardEvent ctrlKey+k → paleta);
`AdvisorButton` (Sparkles + ping); Palette (dev preview motywów); ThemeToggle;
pigułka planu Free (sunken) / Pro (`brand-grad` + glow); avatar → dropdown:
pozycje konta, „Panel klienta Stripe" (info-toast o braku kluczy),
wylogowanie, „Usuń konto/profil" z `window.confirm` i toastem wyniku.

### 5.4. CommandPalette (`CommandPalette.tsx`)
Otwarcie: Cmd/Ctrl+K lub przycisk w Topbarze; ESC zamyka.
Źródła wpisów: nawigacja (6), narzędzia (Advisor/Tokenty/Palet DS), Ustawienia
(motyw), Eksport (DOCX przez `downloadNativeDocxCv`, Drukuj/PDF `window.print`),
Oferty (do 8 z Pipeline), Umiejętności Skarbca (≤15, hard+tools).
Fuzzy: podsekwencja + bonus za sąsiedztwo; sort score desc, top 20.
Klawiatura: ↑↓ cykl, Enter wykonuje, focus-trap + restore.
ARIA: dialog + combobox(`aria-expanded/controls/activedescendant/autocomplete`)
+ listbox/option + `aria-selected`.

### 5.5. MobileSidebar
Drawer lewy 19rem, nagłówek z sygnetem + X; ta sama treść Sidebaru; zamykanie:
backdrop, X, ESC, wybór pozycji, resize ≥lg.

---

## 6. WIDOKI — ZAWARTOŚĆ I PRZYCISKI

### 6.1. Home (`HomeView.tsx`)
- WelcomeWizard (tylko pusty profil) → kroki onboardingu.
- Hero: glass pill „✨ CVELOCITY Career Hub • Edycja 2026" (mono, brand-fg);
  H1 display 2–3,5rem: „Witaj ponownie, {imię}" z gradientem `display-grad` na
  imieniu (bez imienia: „Twoje CV, przepuszczone / przez filtry rekrutacji");
  lead `text-sm/base muted max-w-xl text-balance`.
- CTA: „Znalezienie dopasowania" → `aplikuj` (`bg-brand-600 hover:bg-brand-700
  hover:scale-[1.02] shadow-raised`, Search 16 px) + drugorzędne do Profilu.
- Karta „Następny krok" (silnik `nextAction.ts`) + statystyki profilu
  (historyCount/hardSkills/certyfikaty/projekty).
- Siatka Career Tips: filtry kategorii `Wszystkie|ATS|IT|Junior|Rozmowa|
  Negocjacje|Ulubione` (pill-toggle), karty tipów z gwiazdką ulubionych
  (zapis `cvelocity:favorite-tips`), modal szczegółów tipu.

### 6.2. Profil
- `ProfileSection`: kroki prowadzące przez import → dane → sekcje.
- `MasterVaultEditor`: przełącznik „Krok po kroku"/„Pełny formularz" (Tabs),
  stepper 5 kroków (StepIndicator: linia postępu `bg-brand-600 duration-500`,
  kola 40 px): Dane Osobowe → Doświadczenie → Umiejętności (+SpecializationPicker)
  → Edukacja → Preferencje; eksport JSON (download), import JSON (file input),
  „Zapisano w chmurze" info-toast.
- `PersonalSection`: Inputy (imię/e-mail/telefon/lokalizacja/linki/title/summary)
  z sugestiami Combobox; `ExperienceSection`: karty stanowisk + AchievementEditor
  (sloty action/target/tool/metric + keywords chips); `SkillsMatrix`: listy
  hard/soft/tools z chipami i licznikami, języki/uprawnienia; `EducationSection`;
  `PreferencesSection` (waluta/stawka/toggle lokalizacji — Toggle).
- `ProfilerSection`: karty poziomu doświadczenia (ENTRY/MID/SENIOR/PIVOT,
  zaznaczenie ringiem brandowym), LicenseGrid (SEP/UDT/F-Gaz…), CommuteMap
  (promień dojazdowy).
- `CVParserModal` (Modal lg): DropZone `.pdf/.docx/.rtf/.txt`,
  tryb wklejenia, DiffView scalania z vaultem; baner cyrylicy.

### 6.3. Aplikuj (`JobMatcher` + dzieci)
- Formularz oferty: wklejenie lub `fetch-jd-url`; pola title/firma; DealbreakerList
  (progi knockout); JDKeywordMapper — trzy bary porównania (success/brand-500/
  line-strong, duration-500) + lista słów z statusami; RealtimeLivePreview.
- `DocumentRenderer`: pasek narzędzi — 4 szablony (modern/minimal/executive/
  creative, pill `bg-brand-600 text-on-brand` dla aktywnego), 6 swatchy akcentu
  (#4f46e5/#059669/#0284c7/#e11d48/#d97706/#334155, ring przy wyborze),
  przyciski: Kopiuj tekst (clipboard + check ✓ 2 s), DOCX, Drukuj/PDF;
  zoom 75/90/100% (`aria-pressed`). Kartka: `doc-paper` biały 794 px,
  akcent przez `--doc-accent`, sekcje H2 uppercase mono, RODO stopka 9 px subtle.
- `InterviewCheatSheetView`: sekcje ściągi (glosariusz/QRV/red flags/pytania)
  z Chipami kategorii i Buttonami kopiowania sekcji.

### 6.4. ATS Lab (`AtsLabView.tsx`)
- Wejście: textarea ogłoszenia + rola (szkic trwały w `draftAtsLab`).
- Panel konsensusu: ScoreRing „Mediana Rynkowa", pigułka progu (≥80 emerald /
  ≥65 blue / amber), uzasadnienie narracyjne, 4 statystyki (średnia/min/max/
  liczba silników „10 / 10").
- Telemetria śledcza: wynik ogólny + 5 kart formuły (40/25/20/15/−100) z barami;
  język (tokens, sprawczość %, tabela lematów CV/JD/gęstość z flagą stuffing?,
  chipy braków krytycznych); struktura (STABLE/CORRUPTED, hierarchia VALID/FLAT,
  tabele, znaki); trzy karty systemów (Taleo_Workday/Greenhouse_Lever/
  eRecruiter_Traffit) z prawdopodobieństwem (barwa progowa) i listami
  ryzyk (AlertTriangle)/zgodności (CheckCircle2). Praktyczne wskazówki: akordeon.

### 6.5. Trenuj
- `InterviewCockpitView` — PageHeader „Kokpit Rozmowy - Przygotuj się jak pro";
  moduły pitch/sloty/red flags/negocjacje; ProgressBar `bg-brand-grad duration-500`.
- `STARStoryView`: search mono + chmura tagów (StarTagCloud); karty
  `STARStoryCard` (`page-break-inside-avoid`, aktywna w HUD = ring brand-500/20);
  EmptyState dla braku historii/wyników.
- `DrillModeModal`: pytanie, timer 60 s, nagrywanie, scorecard (struktura/metryki/
  sprawczość/wynik + sugestie); historia `drill-history`.
- `loop/*`: PreCallChecklistView (checklisty z barami duration-300),
  InterviewLoopManager/Modal (sesje, notatki live), PostCallDebriefView
  (follow-up mail generator), Live HUD `ReactFloatingPanel` (fixed 420 px,
  `border-brand-500/40 backdrop-blur-md`, Sloty Ctrl+1..3).

### 6.6. Pipeline
- `ApplicationTracker`: PageHeader „Pipeline Aplikacji (Application Tracker)" +
  filtr-pill z licznikami + „Dodaj aplikację".
- `TrackerTable`: desktop grid-cols-12 (Firma/Stanowisko/Widełki/Data/Status/
  Akcje), mobile karty; EmptyState (Briefcase) gdy filtr pusty.
- `ApplicationModal`: pola firma/stanowisko/widełki/data/status/notatki/jobUrl
  (Field z walidacją); `StatusSelect` — zmiana na „Odrzucona" czyści termin
  rozmowy.

### 6.7. Pricing (`PricingView.tsx`)
Sub-tabs (Funkcje Premium & Dema / Plany / Porównanie), karty Free vs Pro
(miesięczny/roczny −20%), tabelę porównawczą z wierszem „Eksport PDF / DOCX",
CTA checkout → `/api/billing/checkout-session` (plan z bazy, nigdy priceId
z żądania), portal Stripe z menu konta.

---

## 7. REJESTR INTERAKCJI (krawędzie klik → efekt)

| Z | Akcja | Do / Efekt |
|---|---|---|
| Sidebar logo | click | `home` |
| NavItem (4) | click | zakładka sekcji + zamknięcie drawera mobilnego |
| Topbar Szukaj / Ctrl+K | click/kbd | CommandPalette |
| Paleta: Eksport DOCX | Enter/click | pobranie `CV_{Nazwa}_{Firma}_{Rola}.docx` |
| Paleta: Drukuj | Enter/click | `window.print()` (izolacja do kartki) |
| AdvisorButton | click | GeminiAdvisorModal |
| Avatar → Usuń konto | confirm OK | RODO kasowanie + wipe lokalny |
| Home CTA | click | `aplikuj` |
| JobMatcher fetch-jd-url | submit | POST `/api/fetch-jd-url` → wypełnienie pola |
| DocumentRenderer DOCX | click | `downloadNativeDocxCv(vault,facts,rola,firma)` |
| AtsLab pola | keystroke | zapis szkicu (750 ms debounce nie dotyczy — bezpośrednio) + przeliczeń |
| Tracker status→Odrzucona | select | czyszczenie `interviewAt` |
| Pricing CTA | click | Checkout Stripe (tryb cloud) / 501 lokalnie |

---

## 8. STANY SYSTEMOWE

- **Loading:** Button spinner; Skeleton (listy/karty); lazy views (React.lazy).
- **Empty:** EmptyState (Pipeline/STAR/onboarding), komunikaty „Brak…" w kartach.
- **Error:** Field inline (`role=alert`), ToastHost error, `errorHandler` API
  (`success/requestId/error`, bez stacktrace).
- **Success:** toasty success + ikony CheckCircle2; ConsistencyLockBadge
  „spójność potwierdzona" przy sekcjach dokumentu.

## 9. DOSTĘPNOŚĆ — INWENTARZ

Focus-visible rings na wszystkich interaktywnych (globalny outline + jawne
ringi NavItem/Button/Toggle); pułapka fokusu + powrót + scroll-lock w Modalach
i palecie; `aria-current/expanded/pressed/selected/invalid/busy/checked`;
`role="status/alert/progressbar/switch/tablist/listbox/option/dialog/img"`;
reduced-motion wyłącza aurorę/shimmer i skraca transitions.

## 10. ŚWIADOME WYJĄTKI

1. Dwie palety: `brand-*` (interfejs, indygo) i `mark-*` (sygnet, granat/
   pomarańcz) — decyzja udokumentowana przy tokenach.
2. Sygnet: biel „C" to stała znaku (`stroke="#FFFFFF"` na kafelku granatowym),
   niezależna od motywu.
3. `--paper` celowo poza motywami — kartka zawsze biała (PDF/print).
4. `text-brand-fg` zamiast `text-brand` dla tekstów <18px (kontrast AA).
5. Statusy zawsze parami `-soft` tło + `-fg` tekst; gołe `amber/emerald-*`
   tylko ≥18 px bold lub ikony.

