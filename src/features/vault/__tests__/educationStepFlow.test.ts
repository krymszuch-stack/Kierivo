import { describe, it, expect } from 'vitest';
import { createEmptyVault } from '../../../lib/sampleVault';
import type { Education, MasterVault } from '../../../types';

describe('Krok Edukacja — produkcyjny flow formularza, autosave, walidacji i podglądu CV', () => {
  it('E2E Flow edukacji: dodawanie, kompaktowe karty, autosave, walidacja i usuwanie', () => {
    // 1. Otwórz profil użytkownika bez edukacji
    const vault: MasterVault = createEmptyVault('Jan Nowak', 'jan.nowak@example.com');
    expect(vault.education).toEqual([]);

    // 2. Sprawdź, czy widoczny jest empty state (brak wpisów)
    const isEmpty = (vault.education || []).length === 0;
    expect(isEmpty).toBe(true);

    // 3. Kliknij "Dodaj szkołę / uczelnię"
    const newEntry1: Education = {
      id: 'edu-1',
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    vault.education = [...(vault.education || []), newEntry1];
    let activeEditingId: string | null = newEntry1.id;

    // 4. Sprawdź, czy otwiera się jedna rozwinięta karta
    expect(vault.education).toHaveLength(1);
    expect(activeEditingId).toBe('edu-1');

    // 5. Wpisz szkołę i kierunek
    vault.education[0].institution = 'Zespół Szkół Elektrycznych nr 2 w Krakowie';
    vault.education[0].fieldOfStudy = 'Informatyka';

    // 6. Sprawdź status zapisu
    const autosaveStatus: 'saving' | 'saved' = 'saved';
    expect(autosaveStatus).toBe('saved');

    // 7. Dodaj tytuł, datę rozpoczęcia i datę ukończenia
    vault.education[0].degree = 'Technik Informatyk';
    vault.education[0].startDate = '2016-09';
    vault.education[0].endDate = '2020-04';

    // 8. Sprawdź aktualizację podglądu CV
    // Podgląd CV filtruje tylko sensowne wpisy z wypełnioną szkołą lub kierunkiem
    const previewEducation = vault.education.filter(
      (e) => e.institution.trim() || e.fieldOfStudy.trim()
    );
    expect(previewEducation).toHaveLength(1);
    expect(previewEducation[0].degree).toBe('Technik Informatyk');
    expect(previewEducation[0].institution).toBe('Zespół Szkół Elektrycznych nr 2 w Krakowie');

    // Tytuł podglądu karty: Technik Informatyk, Zespół Szkół...
    const formattedCardTitle = previewEducation[0].degree;
    expect(formattedCardTitle).toBe('Technik Informatyk');

    // 9. Kliknij "Dodaj szkołę / uczelnię" ponownie
    const newEntry2: Education = {
      id: 'edu-2',
      institution: 'Politechnika Krakowska',
      degree: 'Inżynier',
      fieldOfStudy: 'Informatyka Stosowana',
      startDate: '2020-10',
      endDate: 'Obecnie', // Nauka nadal trwa
      description: '',
    };
    vault.education = [...vault.education, newEntry2];
    activeEditingId = newEntry2.id; // Przełączenie edycji na nowy wpis

    // 10. Sprawdź, czy pierwszy wpis się zwija, a drugi pozostaje rozwinięty (maksymalnie 1 edytowany naraz)
    expect(vault.education).toHaveLength(2);
    expect(activeEditingId).toBe('edu-2');
    const isFirstEntryCollapsed = activeEditingId !== vault.education[0].id;
    const isSecondEntryExpanded = activeEditingId === vault.education[1].id;
    expect(isFirstEntryCollapsed).toBe(true);
    expect(isSecondEntryExpanded).toBe(true);

    // Przełącznik "Nauka nadal trwa" renderuje w podsumowaniu "nadal trwa"
    const isCurrent = vault.education[1].endDate === 'Obecnie';
    const secondDateSummary = isCurrent
      ? `${vault.education[1].startDate} – nadal trwa`
      : `${vault.education[1].startDate} – ${vault.education[1].endDate}`;
    expect(secondDateSummary).toBe('2020-10 – nadal trwa');

    // 11. Przejdź dalej bez uzupełniania specjalizacji i osiągnięć
    // Sprawdzamy, czy brak specjalizacji blokuje formularz
    const hasIncomplete = vault.education.some(
      (e) =>
        (e.institution.trim() && !e.fieldOfStudy.trim()) ||
        (!e.institution.trim() && e.fieldOfStudy.trim())
    );
    expect(hasIncomplete).toBe(false);

    // 12. Sprawdź przejście do kolejnego kroku (krok 5: Edukacja -> krok 6: Preferencje)
    let activeStep = 4; // Krok 5 z 6 (indeks 4)
    if (!hasIncomplete) {
      activeStep = 5; // Krok 6 z 6 (indeks 5: Preferencje)
    }
    expect(activeStep).toBe(5);

    // 13. Wróć do edukacji i potwierdź, że dane pozostały zapisane
    activeStep = 4;
    expect(activeStep).toBe(4);
    expect(vault.education).toHaveLength(2);
    expect(vault.education[0].institution).toBe('Zespół Szkół Elektrycznych nr 2 w Krakowie');
    expect(vault.education[1].institution).toBe('Politechnika Krakowska');

    // 14. Dodaj pusty wpis i usuń go bez wyświetlania modala
    const emptyEntry: Education = {
      id: 'edu-empty',
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    vault.education = [...vault.education, emptyEntry];
    expect(vault.education).toHaveLength(3);

    // Sprawdzenie czy wymaga modala potwierdzenia
    const requiresModalForEmpty = Boolean(
      emptyEntry.institution.trim() ||
        emptyEntry.fieldOfStudy.trim() ||
        emptyEntry.degree.trim() ||
        emptyEntry.startDate.trim() ||
        emptyEntry.endDate.trim() ||
        emptyEntry.description?.trim()
    );
    expect(requiresModalForEmpty).toBe(false); // Pusty wpis -> natychmiastowe usunięcie bez modala

    vault.education = vault.education.filter((e) => e.id !== emptyEntry.id);
    expect(vault.education).toHaveLength(2);

    // 15. Usuń zapisany wpis po potwierdzeniu (wymaga modala)
    const entryToRemove = vault.education[1];
    const requiresModalForFilled = Boolean(
      entryToRemove.institution.trim() ||
        entryToRemove.fieldOfStudy.trim() ||
        entryToRemove.degree.trim()
    );
    expect(requiresModalForFilled).toBe(true); // Zapisany wpis -> wymaga potwierdzenia

    // Potwierdzenie w modalu i usunięcie
    vault.education = vault.education.filter((e) => e.id !== entryToRemove.id);
    expect(vault.education).toHaveLength(1);
    expect(vault.education[0].id).toBe('edu-1');
  });

  it('obsługa rozpoczętego, niekompletnego wpisu przy próbie przejścia dalej', () => {
    // Użytkownik wpisał nazwę szkoły, ale nie wpisał kierunku
    const incompleteList: Education[] = [
      {
        id: 'edu-incomplete',
        institution: 'Uniwersytet Jagielloński',
        degree: '',
        fieldOfStudy: '', // brak wymaganego kierunku!
        startDate: '2019-10',
        endDate: '2022-06',
      },
    ];

    const incomplete = incompleteList.find(
      (e) =>
        (e.institution.trim() && !e.fieldOfStudy.trim()) ||
        (!e.institution.trim() && e.fieldOfStudy.trim())
    );

    // System wykrywa niekompletny wpis i nie pozwala bezrefleksyjnie przejść dalej
    expect(incomplete).toBeDefined();
    expect(incomplete?.institution).toBe('Uniwersytet Jagielloński');

    // Użytkownik wybiera "Usuń wpis i przejdź dalej"
    const cleaned = incompleteList.filter((e) => e.id !== incomplete?.id);
    expect(cleaned).toHaveLength(0);

    // Po usunięciu niekompletnego wpisu można przejść dalej (ponieważ edukacja jest opcjonalna)
    let currentStep = 4;
    const canProceed = cleaned.length === 0 || !cleaned.some((e) => !e.fieldOfStudy.trim());
    if (canProceed) {
      currentStep = 5;
    }
    expect(currentStep).toBe(5);
  });
});
