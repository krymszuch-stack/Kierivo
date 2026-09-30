/** E2E szablonu STAR wyłącznie na fikcyjnym profilu i osobnym kontekście. */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
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
  console.log('Podpowiedź widoczna obok pola; pola CV nie zawierają tekstu szablonu.');
} finally {
  await context.close();
  await browser.close();
}
