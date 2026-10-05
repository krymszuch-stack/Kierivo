/**
 * Etykiety aplikacji w trackerze — jedno miejsce obsługi pustych pól i
 * historycznego placeholdera „Nieznana firma”. Stary tekst był już ukrywany
 * w wierszu, ale wracał w modalach i toastach, przez co wyglądał jak fakt.
 */
export function getApplicationDisplayInfo(application: {
  company?: string | null;
  position?: string | null;
}) {
  const storedCompany = application.company?.trim() ?? '';
  const storedPosition = application.position?.trim() ?? '';
  const companyMissing = !storedCompany || storedCompany.toLocaleLowerCase('pl-PL') === 'nieznana firma';
  const positionMissing = !storedPosition || storedPosition.toLocaleLowerCase('pl-PL') === 'stanowisko';
  const company = companyMissing ? '' : storedCompany;
  const position = positionMissing ? '' : storedPosition;

  const companyLabel = company || 'Nie podano firmy';
  const positionLabel = position || 'Nie podano stanowiska';
  const applicationLabel = position
    ? company ? `${position} — ${company}` : position
    : company || positionLabel;
  const contextLabel = company
    ? `${company} — ${position || positionLabel}`
    : `${position || positionLabel} — nie podano firmy`;

  return {
    company,
    position,
    companyMissing,
    companyLabel,
    positionLabel,
    applicationLabel,
    contextLabel,
    initial: company ? company.charAt(0).toLocaleUpperCase('pl-PL') : '?',
  };
}

/** Etykieta dokumentu historycznego pochodzi z migawki, nie z edytowalnych metadanych wpisu. */
export function getApplicationSnapshotDisplayInfo(application: {
  company?: string | null;
  position?: string | null;
  documentSnapshot?: {
    jobOfferSnapshot?: {
      company?: string | null;
      title?: string | null;
    } | null;
  } | null;
}) {
  const offer = application.documentSnapshot?.jobOfferSnapshot;
  return getApplicationDisplayInfo(offer ? {
    company: offer.company,
    position: offer.title,
  } : application);
}
export { getAtsScoreDisplayInfo } from '../../lib/atsScoreEvidence';
