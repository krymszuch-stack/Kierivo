/** Sprawdza typowy adres kontaktowy; nie potwierdza, że skrzynka istnieje. */
export function isPlausibleEmailAddress(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254) return false;

  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return false;

  const localParts = local.split('.');
  const domainLabels = domain.split('.');
  const localPartPattern = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+$/u;
  const domainLabelPattern = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;

  return localParts.every((part) => part.length <= 64 && localPartPattern.test(part)) &&
    domainLabels.length >= 2 &&
    domainLabels.every((label) => label.length <= 63 && domainLabelPattern.test(label));
}
