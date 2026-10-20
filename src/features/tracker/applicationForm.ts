/** Nie zastępuj braku danych o wynagrodzeniu deklaracją „Do negocjacji” z receipt. */
export function resolveApplicationSalary(value: string, receiptImport: boolean): string {
  const explicitValue = value.trim();
  return explicitValue || (receiptImport ? '' : 'Do negocjacji');
}
