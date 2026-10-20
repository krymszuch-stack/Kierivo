/** Nie zastępuj braku danych o wynagrodzeniu deklaracją „Do negocjacji” z receipt. */
export function resolveApplicationSalary(value: string, preserveUnknown: boolean): string {
  const explicitValue = value.trim();
  return explicitValue || (preserveUnknown ? '' : 'Do negocjacji');
}

export function hasUnknownReceiptSalary(
  salary: string | undefined,
  events: Array<{ kind: string; source: string }> | undefined,
): boolean {
  return !salary?.trim() && Boolean(events?.some((event) =>
    event.kind === 'application_sent' && event.source === 'extension'));
}
