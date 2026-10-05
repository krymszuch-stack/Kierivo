export type GrammarNarrativeStyle = 'impersonal' | 'first_person_m' | 'first_person_f';

export interface RoleKnowledgeNode {
  roleId: string;
  label: string;
  category?: string;
  description?: string;
  aliases?: string[];
  areas: { id: string; label: string; description?: string }[];
  actions: Record<string, string[]>;
  objects: Record<string, string[]>;
  /** Sugestie opisują sposób pracy; mierzalne wyniki pochodzą wyłącznie z danych wpisanych przez użytkownika. */
  outcomes: Record<string, string[]>;
  defaultTech: Record<string, string[]>;
}

export interface ExperienceFact {
  role: string;
  area: string;
  action: string;
  objects: string[];
  technologies: string[];
  outcome?: string;
  metric?: string;
  narrativeStyle: GrammarNarrativeStyle;
  verifiedByUser: boolean;
}

export interface GeneratedExperienceVariant {
  id: string;
  styleName: 'Formalny (Bezosobowy)' | 'Osiągnięcia (Czasowniki)' | 'Techniczny / Narzędziowy';
  bulletPoints: string[];
  fullParagraph: string;
  highlights: {
    action: string;
    object: string;
    tech: string[];
    outcome?: string;
  };
}

export interface WizardInterviewStep {
  id: 'area' | 'actions' | 'objects' | 'technologies' | 'outcomes' | 'metrics';
  title: string;
  subtitle: string;
  isMultiSelect?: boolean;
}
