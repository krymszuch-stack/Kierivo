import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Layers,
  Wrench,
  TrendingUp,
  Hash,
  RotateCcw,
  Search,
  Building2,
  X,
  Edit3,
  Flame,
  Zap,
  Truck,
  HardHat,
  Cog,
  Activity,
  ShoppingBag,
  Users,
  Code,
  Shield,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  resolveRoleKnowledgeNode,
  getAllRoleKnowledgeNodes,
  generateExperienceVariants,
  getAffinityObjects,
  ExperienceFact,
  GeneratedExperienceVariant,
  GrammarNarrativeStyle,
  RoleKnowledgeNode,
  validateExperienceFact,
} from '../../lib/experienceEngine';

export interface ExperienceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleTitle: string;
  userSkills?: string[];
  onApplyDescription: (description: string, bullets: string[]) => void;
}

// Mapowanie ikon dla kategorii zawodowych
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Instalacje & HVAC': Flame,
  'Elektryka & Automatyka': Zap,
  'Spawalnictwo & Ślusarstwo': Wrench,
  'Logistyka & Magazyn': Building2,
  'Transport & Spedycja': Truck,
  'Motoryzacja & Diagnostyka': Wrench,
  'Budownictwo & Wykończenia': HardHat,
  'Produkcja & Obróbka CNC': Cog,
  'Finanse & Księgowość': Building2,
  'Sprzedaż & Rozwój Biznesu': ShoppingBag,
  'Obsługa Klienta & Support': Users,
  'Medycyna & Zdrowie': Activity,
  'IT & Software Engineering': Code,
  'DevOps & Infrastruktura': Shield,
  'Zarządzanie & Projekty': Briefcase,
  'Administracja & Biuro': Building2,
};

export const ExperienceWizardModal: React.FC<ExperienceWizardModalProps> = ({
  isOpen,
  onClose,
  roleTitle,
  userSkills = [],
  onApplyDescription,
}) => {
  // Wszystkie węzły zawodowe
  const allRoles = useMemo(() => getAllRoleKnowledgeNodes(), []);

  // Aktywnie wybrana rola w kreatorze (początkowo wykrywana z roleTitle)
  const [selectedRoleNode, setSelectedRoleNode] = useState<RoleKnowledgeNode>(() =>
    resolveRoleKnowledgeNode(roleTitle)
  );
  const [factsConfirmed, setFactsConfirmed] = useState(false);

  // Synchronizacja przy zmianie roleTitle z zewnątrz
  const [prevRoleTitle, setPrevRoleTitle] = useState(roleTitle);
  if (roleTitle !== prevRoleTitle) {
    setPrevRoleTitle(roleTitle);
    setSelectedRoleNode(resolveRoleKnowledgeNode(roleTitle));
    setFactsConfirmed(false);
  }

  // Stan wyszukiwarki/wyboru innego zawodu
  const [isRolePickerOpen, setIsRolePickerOpen] = useState<boolean>(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('Wszystkie');

  const [step, setStep] = useState<number>(0);
  const [narrativeStyle, setNarrativeStyle] = useState<GrammarNarrativeStyle>('impersonal');

  // Stan wyboru w kreatorze
  const initialArea = selectedRoleNode.areas.length > 0 ? selectedRoleNode.areas[0].id : '';
  const initialActions = initialArea
    ? selectedRoleNode.actions[initialArea] || selectedRoleNode.actions[Object.keys(selectedRoleNode.actions)[0]] || []
    : [];
  const initialAction = initialActions.length > 0 ? initialActions[0] : '';

  const [selectedArea, setSelectedArea] = useState<string>(initialArea);
  const [selectedAction, setSelectedAction] = useState<string>(initialAction);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [customTechInput, setCustomTechInput] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [metricInput, setMetricInput] = useState<string>('');

  // Synchronizacja przy zmianie wybranej roli
  const handleSelectRoleNode = (node: RoleKnowledgeNode) => {
    setFactsConfirmed(false);
    setSelectedRoleNode(node);
    const newInitialArea = node.areas.length > 0 ? node.areas[0].id : '';
    const newInitialActions = newInitialArea
      ? node.actions[newInitialArea] || node.actions[Object.keys(node.actions)[0]] || []
      : [];
    setSelectedArea(newInitialArea);
    setSelectedAction(newInitialActions.length > 0 ? newInitialActions[0] : '');
    setSelectedObjects([]);
    setSelectedTech([]);
    setSelectedOutcome('');
    setMetricInput('');
    setStep(0);
    setIsRolePickerOpen(false);
  };

  // Zmiana obszaru -> automatyczny reset akcji i obiektów
  const handleSelectArea = (areaId: string) => {
    setFactsConfirmed(false);
    setSelectedArea(areaId);
    const areaActions = selectedRoleNode.actions[areaId] || selectedRoleNode.actions[Object.keys(selectedRoleNode.actions)[0]] || [];
    setSelectedAction(areaActions.length > 0 ? areaActions[0] : '');
    setSelectedObjects([]);
    setSelectedTech([]);
    setSelectedOutcome('');
    setMetricInput('');
  };

  const handleSelectAction = (action: string) => {
    setFactsConfirmed(false);
    setSelectedAction(action);
    setSelectedObjects([]);
    setSelectedTech([]);
    setSelectedOutcome('');
    setMetricInput('');
  };

  // Filtrowanie listy ról w pickerze
  const categoriesList = useMemo(() => {
    const cats = new Set(allRoles.map((r) => r.category || 'Inne'));
    return ['Wszystkie', ...Array.from(cats)];
  }, [allRoles]);

  const filteredRoles = useMemo(() => {
    const query = roleSearchQuery.toLowerCase().trim();
    return allRoles.filter((r) => {
      const matchCat = selectedCategoryFilter === 'Wszystkie' || r.category === selectedCategoryFilter;
      if (!matchCat) return false;
      if (!query) return true;
      const matchLabel = r.label.toLowerCase().includes(query);
      const matchDesc = r.description?.toLowerCase().includes(query);
      const matchAlias = r.aliases?.some((a) => a.toLowerCase().includes(query));
      const matchArea = r.areas.some((a) => a.label.toLowerCase().includes(query));
      return matchLabel || matchDesc || matchAlias || matchArea;
    });
  }, [allRoles, roleSearchQuery, selectedCategoryFilter]);

  // Lista dostępnych czynności dla wybranego obszaru
  const availableActions = useMemo(() => {
    return (
      selectedRoleNode.actions[selectedArea] ||
      selectedRoleNode.actions[Object.keys(selectedRoleNode.actions)[0]] ||
      []
    );
  }, [selectedRoleNode, selectedArea]);

  // Lista dostępnych obiektów
  const availableObjects = useMemo(() => {
    const rawObjects =
      selectedRoleNode.objects[selectedArea] ||
      selectedRoleNode.objects[Object.keys(selectedRoleNode.objects)[0]] ||
      [];
    return getAffinityObjects(selectedAction, rawObjects);
  }, [selectedRoleNode, selectedArea, selectedAction]);

  // Lista dostępnych technologii / narzędzi / uprawnień
  const availableTech = useMemo(() => {
    const defaultRoleTech =
      selectedRoleNode.defaultTech[selectedArea] ||
      selectedRoleNode.defaultTech.default ||
      [];
    const merged = Array.from(new Set([...userSkills, ...defaultRoleTech]));
    return merged.slice(0, 16);
  }, [selectedRoleNode, selectedArea, userSkills]);

  // Lista dostępnych efektów / celów
  const availableOutcomes = useMemo(() => {
    return (
      selectedRoleNode.outcomes[selectedArea] ||
      selectedRoleNode.outcomes.default ||
      []
    );
  }, [selectedRoleNode, selectedArea]);

  // Złożony fakt doświadczenia
  const currentFact: ExperienceFact = useMemo(() => {
    const areaLabel =
      selectedRoleNode.areas.find((a) => a.id === selectedArea)?.label || selectedArea;
    return {
      role: roleTitle || selectedRoleNode.label,
      area: areaLabel,
      action: selectedAction || availableActions[0] || 'prowadziłem',
      objects: selectedObjects,
      technologies: selectedTech,
      outcome: selectedOutcome,
      metric: metricInput.trim() || undefined,
      narrativeStyle,
      verifiedByUser: factsConfirmed,
    };
  }, [
    roleTitle,
    selectedRoleNode,
    selectedArea,
    selectedAction,
    availableActions,
    selectedObjects,
    selectedTech,
    selectedOutcome,
    metricInput,
    narrativeStyle,
    factsConfirmed,
  ]);

  // Wygenerowane warianty
  const generatedVariants: GeneratedExperienceVariant[] = useMemo(() => {
    return generateExperienceVariants(currentFact);
  }, [currentFact]);
  const canApplyFact = validateExperienceFact(currentFact).isValid;

  const toggleObject = (obj: string) => {
    setFactsConfirmed(false);
    setSelectedObjects((prev) =>
      prev.includes(obj) ? prev.filter((o) => o !== obj) : [...prev, obj]
    );
  };

  const toggleTech = (tech: string) => {
    setFactsConfirmed(false);
    setSelectedTech((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const handleAddCustomTech = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = customTechInput.trim();
    if (clean && !selectedTech.includes(clean)) {
      setFactsConfirmed(false);
      setSelectedTech((prev) => [...prev, clean]);
      setCustomTechInput('');
    }
  };

  const handleApplyVariant = (variant: GeneratedExperienceVariant) => {
    if (!canApplyFact) return;
    onApplyDescription(variant.fullParagraph, variant.bulletPoints);
    onClose();
  };

  const resetWizard = () => {
    setStep(0);
    setSelectedObjects([]);
    setSelectedTech([]);
    setSelectedOutcome('');
    setMetricInput('');
    setFactsConfirmed(false);
  };

  const ActiveIcon = CATEGORY_ICONS[selectedRoleNode.category || ''] || Briefcase;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mikro-Wywiad Doświadczenia (Career Experience Wizard)"
      size="xl"
    >
      <div className="space-y-5">
        {/* Nagłówek ze statusem, profesją i przełącznikiem wyboru zawodu */}
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 text-brand-600 shrink-0">
                <ActiveIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted uppercase tracking-wide">
                    {selectedRoleNode.category || 'Branża Zawodowa'}
                  </span>
                </div>
                <div className="text-sm font-bold text-ink flex items-center gap-2">
                  <span>{selectedRoleNode.label}</span>
                  {roleTitle && roleTitle !== selectedRoleNode.label && (
                    <span className="text-xs font-normal text-muted truncate max-w-[200px]">
                      (Stanowisko z CV: {roleTitle})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={isRolePickerOpen ? X : Edit3}
                onClick={() => setIsRolePickerOpen((prev) => !prev)}
                className="text-xs h-8 px-3"
              >
                {isRolePickerOpen ? 'Zamknij słownik' : 'Zmień / Doprecyzuj zawód'}
              </Button>
              <span className="text-[11px] font-mono text-muted pl-2 border-l border-line">
                Krok {step + 1} z 5
              </span>
            </div>
          </div>

          {/* Pasek postępu */}
          <div className="h-1.5 w-full bg-sunken rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-300 rounded-full"
              style={{ width: `${((step + 1) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Panel wyboru zawodu ze słownika (progressive disclosure) */}
        {isRolePickerOpen && (
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3.5 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Search className="h-4 w-4 text-brand-600" />
                Wybierz zawód lub profil z bazy klasyfikacji zawodowych (16 branż):
              </h4>
              <span className="text-[10px] font-mono text-muted">
                Znaleziono: {filteredRoles.length}
              </span>
            </div>

            {/* Wyszukiwarka */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                value={roleSearchQuery}
                onChange={(e) => setRoleSearchQuery(e.target.value)}
                placeholder="Szukaj po nazwie lub słowach kluczowych (np. monter, spawacz, elektryk, magazynier, księgowa, devops)..."
                className="w-full rounded-xl border border-line bg-sunken pl-9 pr-3.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none"
              />
            </div>

            {/* Kategorie filter chips */}
            <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto pr-1">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    selectedCategoryFilter === cat
                      ? 'bg-brand-600 text-white shadow-2xs'
                      : 'bg-sunken text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Siatka ról do wyboru */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {filteredRoles.map((role) => {
                const isSelected = selectedRoleNode.roleId === role.roleId;
                const RoleIcon = CATEGORY_ICONS[role.category || ''] || Briefcase;
                return (
                  <button
                    key={role.roleId}
                    type="button"
                    onClick={() => handleSelectRoleNode(role)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                        : 'border-line bg-surface hover:border-brand-500/30'
                    }`}
                  >
                    <RoleIcon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-brand-600' : 'text-muted'}`} />
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-ink truncate">
                        {role.label}
                      </div>
                      <div className="text-[10px] text-muted line-clamp-1">
                        {role.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Treść kroków mikro-wywiadu */}
        {step === 0 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Layers className="h-4 w-4 text-brand-600" />
                <span>1. W jakim głównym obszarze pracowałeś na tym stanowisku?</span>
              </div>
              <span className="text-[10px] text-muted font-mono">
                {selectedRoleNode.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedRoleNode.areas.map((area) => {
                const isSelected = selectedArea === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => handleSelectArea(area.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all space-y-1 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-fg ring-1 ring-brand-500/30 shadow-2xs'
                        : 'border-line bg-surface hover:border-brand-500/30 text-ink'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{area.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    </div>
                    {area.description && (
                      <div className="text-[11px] text-muted leading-snug">
                        {area.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Briefcase className="h-4 w-4 text-brand-600" />
              <span>2. Jaka była Twoja główna czynność / rola sprawcza?</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleSelectAction(action)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedAction === action
                      ? 'border-brand-500 bg-brand-500/10 text-brand-fg ring-1 ring-brand-500/30'
                      : 'border-line bg-surface hover:border-brand-500/30 text-ink'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Wrench className="h-4 w-4 text-brand-600" />
                <span>3. Czego dokładnie dotyczyła praca? (zaznacz 1–3 elementy)</span>
              </div>
              <span className="text-[10px] text-muted font-mono">
                Wybrano: {selectedObjects.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableObjects.map((obj) => {
                const isSelected = selectedObjects.includes(obj);
                return (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => toggleObject(obj)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-fg font-bold ring-1 ring-brand-500/30'
                        : 'border-line bg-surface hover:border-brand-500/30 text-ink'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    <span>{obj}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Wrench className="h-4 w-4 text-brand-600" />
                <span>4. Jakich technologii, sprzętu, narzędzi lub uprawnień używałeś?</span>
              </div>
              <span className="text-[10px] text-muted font-mono">
                Wybrano: {selectedTech.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTech.map((tech) => {
                const isSelected = selectedTech.includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => toggleTech(tech)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-fg font-bold ring-1 ring-brand-500/30'
                        : 'border-line bg-surface hover:border-brand-500/30 text-ink'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    <span>{tech}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={customTechInput}
                onChange={(e) => setCustomTechInput(e.target.value)}
                onKeyDown={handleAddCustomTech}
                placeholder="Wpisz inne narzędzie, urządzenie, normę lub uprawnienie (np. SEP G2, Linde, KTS, Catia)..."
                className="flex-1 rounded-xl border border-line bg-sunken px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddCustomTech}
                className="text-xs shrink-0"
              >
                Dodaj
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <TrendingUp className="h-4 w-4 text-brand-600" />
              <span>5. Jaki był cel, mierzalny efekt lub skala tej pracy?</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableOutcomes.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => { setSelectedOutcome(outcome); setFactsConfirmed(false); }}
                  className={`px-3.5 py-2 rounded-xl border text-left text-xs font-semibold cursor-pointer transition-all ${
                    selectedOutcome === outcome
                      ? 'border-brand-500 bg-brand-500/10 text-brand-fg ring-1 ring-brand-500/30'
                      : 'border-line bg-surface hover:border-brand-500/30 text-ink'
                  }`}
                >
                  {outcome}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-line/50">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-brand-600" />
                Opcjonalna liczba / skala (np. „ponad 450 przeglądów”, „czas reakcji &lt; 2h”, „99.8% poprawności”):
              </label>
              <input
                type="text"
                value={metricInput}
                onChange={(e) => { setMetricInput(e.target.value); setFactsConfirmed(false); }}
                placeholder="Pozostaw puste, jeśli nie znasz dokładnej liczby (opis będzie jakościowy)"
                className="w-full rounded-xl border border-line bg-sunken px-3.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-brand-500/60 focus:outline-none"
              />
            </div>

          </div>
        )}

        {/* Podgląd gotowych wariantów generowanych w czasie rzeczywistym */}
        {step === 4 && generatedVariants.length > 0 && <div className="space-y-3 pt-4 border-t border-line/60">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Propozycje opisu stanowiska (3 warianty dopasowane do branży):
            </h4>

            {/* Przełącznik stylu narracji */}
            <div className="flex items-center gap-1 bg-sunken p-1 rounded-xl border border-line/60">
              <button
                type="button"
                onClick={() => { setNarrativeStyle('impersonal'); setFactsConfirmed(false); }}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ${
                  narrativeStyle === 'impersonal' ? 'bg-surface text-brand-fg shadow-2xs' : 'text-muted'
                }`}
              >
                Bezosobowy
              </button>
              <button
                type="button"
                onClick={() => { setNarrativeStyle('first_person_m'); setFactsConfirmed(false); }}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ${
                  narrativeStyle === 'first_person_m' ? 'bg-surface text-brand-fg shadow-2xs' : 'text-muted'
                }`}
              >
                1. os. (m)
              </button>
              <button
                type="button"
                onClick={() => { setNarrativeStyle('first_person_f'); setFactsConfirmed(false); }}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ${
                  narrativeStyle === 'first_person_f' ? 'bg-surface text-brand-fg shadow-2xs' : 'text-muted'
                }`}
              >
                1. os. (k)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[280px] overflow-y-auto pr-1">
            {generatedVariants.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl border border-line bg-surface p-3.5 space-y-2 hover:border-brand-500/40 transition-colors shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-brand-500/10 text-brand-600 px-2 py-0.5 font-mono text-[10px] font-bold">
                      {v.styleName}
                    </span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed font-medium">
                    {v.fullParagraph}
                  </p>
                </div>

                <div className="pt-2 border-t border-line/50 flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => handleApplyVariant(v)}
                    disabled={!canApplyFact}
                    className="text-xs h-7 px-3"
                  >
                    Wstaw do tego stanowiska
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>}
        {step === 4 && generatedVariants.length === 0 && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-xs text-muted">
            Wybierz przynajmniej jeden obiekt pracy, żeby przygotować opis oparty na Twoich danych.
          </p>
        )}
        {step === 4 && generatedVariants.length > 0 && (
          <label className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-xs leading-relaxed text-ink">
            <input
              type="checkbox"
              checked={factsConfirmed}
              onChange={(event) => setFactsConfirmed(event.target.checked)}
              className="mt-0.5 accent-brand-600"
            />
            <span>Przejrzałem propozycję i potwierdzam, że wskazana rola, czynność, obiekty, narzędzia, efekty i metryki są zgodne z moim doświadczeniem.</span>
          </label>
        )}

        {/* Pasek nawigacji kreatora */}
        <div className="flex items-center justify-between pt-2 border-t border-line/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={resetWizard}
            className="text-xs"
          >
            Od nowa
          </Button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                onClick={() => setStep((s) => s - 1)}
                className="text-xs"
              >
                Wstecz
              </Button>
            )}

            {step < 4 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 2 && selectedObjects.length === 0}
                className="text-xs"
              >
                <span>Dalej</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
