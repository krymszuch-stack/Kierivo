import type { InterviewQuestionItem } from '../server/services/interviewCoach.service';

/** Pytania bazowe są użyteczne bez stanowiska i nie zakładają jednej branży. */
export const DEFAULT_INTERVIEW_QUESTIONS: InterviewQuestionItem[] = [
  {
    id: 'def-1',
    category: 'behavioral',
    question: 'Opowiedz o trudnej sytuacji w pracy, nauce lub innym ważnym doświadczeniu. Co było Twoim zadaniem i jak zareagowałeś?',
    recruiterIntent: 'Pytanie może pomóc omówić sposób działania w trudnej sytuacji. Nie zakłada konkretnej branży ani jednego właściwego rozwiązania.',
    suggestedStarTips: 'S: krótki kontekst; T: Twoje zadanie; A: działania, które faktycznie podjąłeś; R: rzeczywisty skutek lub wniosek. Jeśli nie masz pomiaru liczbowego, opisz skutek słowami.',
  },
  {
    id: 'def-2',
    category: 'situational',
    question: 'Opowiedz o sytuacji, gdy trzeba było wyjaśnić komuś swoje stanowisko lub uzgodnić sposób działania. Jak przebiegła rozmowa?',
    recruiterIntent: 'Pytanie może pomóc poznać sposób komunikacji i szukania porozumienia; przykład może pochodzić z pracy, nauki lub innego doświadczenia.',
    suggestedStarTips: 'Opisz sytuację, swoje zadanie, sposób rozmowy i jej rzeczywisty rezultat. Nie dopisuj zgody ani sukcesu, jeśli ich nie było.',
  },
  {
    id: 'def-3',
    category: 'competency',
    question: 'Podaj przykład zadania lub działania, które udało Ci się doprowadzić do końca. Jaki był Twój wkład i co z tego wynikło?',
    recruiterIntent: 'Pytanie może pomóc zrozumieć Twój udział w zadaniu oraz to, jak opisujesz jego rezultat. Nie wymaga projektu technicznego ani liczbowej metryki.',
    suggestedStarTips: 'Opisz własne działania i rezultat, który możesz potwierdzić. Jeśli nie był mierzony, powiedz to i podaj konkretny jakościowy skutek.',
  },
];

export function resolveInterviewTargetRole(profileTitle?: string | null): string {
  return profileTitle?.trim() || '';
}
