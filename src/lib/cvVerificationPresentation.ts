export const cvVerificationPresentation = {
  summary: 'Analiza AI danych profilu i kontekstu oferty w trzech obszarach.',
  boundary: 'Wynik jest opinią modelu. Sprawdzenie pliku PDF, prawdziwości deklaracji i klauzuli RODO wymaga osobnej weryfikacji.',
  areas: [
    { title: 'Wymagania oferty', description: 'AI porównuje deklaracje w profilu z ofertą. Bez treści oferty dopasowanie pozostaje nieocenione.' },
    { title: 'Czytelność treści', description: 'AI ocenia nagłówek i wskazuje ogólniki. Licznik punktów z metrykami nie potwierdza osiągnięć.' },
    { title: 'Spójność deklaracji', description: 'AI wskazuje możliwe sprzeczności w datach i deklaracjach. Sprawdź wnioski na podstawie swoich dokumentów.' },
  ],
} as const;
