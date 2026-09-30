export interface ExtractedProfileData {
  title: string;
  yearsOfExperience: number;
  topSkills: string[];
  workEntries: Array<{ role: string; company: string }>;
  sourceHighlight: string;
}

export interface SummarySuggestion {
  id: string;
  styleName: 'Kompaktowy' | 'Historia zawodowa' | 'Umiejętności' | 'Opis z profilu';
  text: string;
  wordCount: number;
  sentenceCount: number;
  highlightedKeywords: string[];
  styleId?: string;
  usedLexemes?: Record<string, string>;
  weight?: number;
}
