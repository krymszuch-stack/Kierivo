/** E2E szablonu STAR wyłącznie na fikcyjnym profilu i osobnym kontekście. */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  await page.getByRole('button', { name: /Konto/ }).click();
  await page.getByRole('button', { name: 'Utwórz profil lokalny', exact: true }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Profil STAR Syntetyczny');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Profil$/ }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Krok 2 Doświadczenie/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Dodaj pierwsze stanowisko' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Rozwiń edytor osiągnięć STAR' }).click();
  await page.getByRole('button', { name: 'Słowniczek STAR' }).click();
  const dialog = page.getByRole('dialog', { name: /Słowniczek STAR/ });
  await dialog.getByText('Poniższe zdania są fikcyjnymi przykładami.', { exact: false }).waitFor();
  await dialog.getByRole('button', { name: 'Pokaż szablon obok pola' }).first().click();
  await page.getByText('Szablon do własnego uzupełnienia — nie zapisano go w CV').waitFor();
  const achievements = page.locator('textarea');
  const values = await achievements.evaluateAll((fields) => fields.map((field) => field.value));
  if (values.some((value) => value.includes('[Jeśli wykonano:') || value.includes('[Opisz rzeczywistą czynność]'))) {
    throw new Error('Szablon został zapisany w polu CV.');
  }
  await page.waitForTimeout(800);
  const persisted = await page.evaluate(() => Object.values(localStorage).join('\n'));
  if (persisted.includes('[Jeśli wykonano:') || persisted.includes('[Opisz rzeczywistą czynność]')) {
    throw new Error('Szablon został zapisany w lokalnym Vault.');
  }
  await page.screenshot({ path: 'docs/audyt-star-szablon-obok-cv-2026-09-30.png', fullPage: true });
  await page.getByPlaceholder('np. Szpital Wojewódzki, Mostostal S.A., Zakład Pracy...').fill('Syntetyczna Firma');
  await page.getByPlaceholder('np. Monter / Inżynier / Spawacz...').fill('Tester fikcyjnego procesu');
  await page.locator('textarea').last().fill('Udokumentowałem trzy fikcyjne scenariusze testowe.');
  await page.getByRole('button', { name: 'Otwórz Podgląd CV' }).click();
  const preview = page.getByRole('dialog', { name: /Podgląd CV/ });
  await preview.getByText('Udokumentowałem trzy fikcyjne scenariusze testowe.').waitFor();
  const previewText = await preview.innerText();
  if (previewText.includes('[Jeśli wykonano:') || previewText.includes('[Opisz rzeczywistą czynność]')) {
    throw new Error('Szablon trafił do podglądu CV.');
  }
  await page.screenshot({ path: 'docs/audyt-star-wlasna-tresc-podglad-2026-09-30.png', fullPage: true });
  await preview.getByRole('button', { name: 'Nanieś poprawki w dokumencie' }).click();
  await preview.getByRole('button', { name: 'Dodaj punkt osiągnięcia' }).click();
  const emptyAchievement = preview.getByPlaceholder('Wpisz własne, potwierdzone osiągnięcie').last();
  if (await emptyAchievement.inputValue() !== '') {
    throw new Error('Nowy punkt podglądu zawiera niepotwierdzoną treść.');
  }
  await preview.getByRole('button', { name: 'Zakończ poprawki w dokumencie' }).click();
  if ((await preview.innerText()).includes('Wdrożyłem / zrealizowałem zadanie')) {
    throw new Error('Podgląd dodał niepotwierdzone osiągnięcie.');
  }
  await preview.getByRole('button', { name: 'Kopiuj treść dokumentu do schowka' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (!copied.includes('Udokumentowałem trzy fikcyjne scenariusze testowe.') || copied.includes('Wdrożyłem / zrealizowałem zadanie')) {
    throw new Error('Skopiowana treść CV różni się od potwierdzonego wpisu.');
  }
  await page.screenshot({ path: 'docs/audyt-star-pusty-punkt-podgladu-2026-09-30.png', fullPage: true });
  console.log('Szablon pozostał poza Vaultem; własna treść widoczna, nowy punkt podglądu pusty.');
} finally {
  await context.close();
  await browser.close();
}
