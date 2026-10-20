/**
 * Akceptujemy tylko publiczny listing rozszerzenia w Chrome Web Store.
 * Sam adres konfiguracyjny nie jest dowodem publikacji ani instalacji.
 */
export function getHunterExtensionStoreUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isChromeWebStoreListing =
      url.protocol === 'https:' &&
      url.hostname === 'chromewebstore.google.com' &&
      /^\/detail\/[^/]+\/[a-p]{32}\/?$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;

    return isChromeWebStoreListing ? url.toString() : null;
  } catch {
    return null;
  }
}
