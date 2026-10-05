import { useEffect, useState } from 'react';
import { nextAnalysisMonthDelay } from '../lib/analysisPeriod';

/** Powrót na kartę i granica miesiąca odświeżają oceny bez zegara co minutę. */
export function useAnalysisClock(): Date {
  const [, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const current = new Date();
      setNow(current);
      timer = setTimeout(refresh, nextAnalysisMonthDelay(current));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    timer = setTimeout(refresh, nextAnalysisMonthDelay(new Date()));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  // Wynik powstaje także między tyknięciami. Czas zapamiętany przy montowaniu
  // uznałby świeże obliczenie za przyszłe, dopóki użytkownik nie wróci na kartę.
  return new Date();
}
