/** E2E asystenta podsumowania - weryfikacja faktograficznego generowania bez zmyślonych metryk */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('button', { name: /Zaloguj się lub załóż konto|Utwórz profil lokalny/ }).click();
  await page.getByRole('button', { name: /Korzystaj bez logowania/ }).click();
  await page.getByRole('textbox', { name: 'Jak się do Ciebie zwracać' }).fill('Michał Tester');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });

  // Przejdź do profilu
  await page.getByRole('button', { name: /^Profil$/ }).click();
  await page.waitForTimeout(1500);

  // Krok Dane Osobowe - Tytuł zawodowy
  const titleField = page.getByPlaceholder('np. Senior Frontend Architect');
  await titleField.fill('Monter instalacji sanitarnych');

  // Przejdź do Doświadczenie i dodaj stanowisko
  await page.getByRole('button', { name: /Doświadczenie/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Dodaj pierwsze stanowisko' }).click();
  await page.getByPlaceholder('np. Szpital Wojewódzki, Mostostal S.A., Zakład Pracy...').fill('Instal-Sanit Sp. z o.o.');
  await page.getByPlaceholder('np. Monter / Inżynier / Spawacz...').fill('Monter instalacji HVAC');
  
  const startDate = page.getByLabel('Data Rozpoczęcia (opcjonalne)');
  await startDate.fill('01/2021');
  const endDate = page.getByLabel('Data Zakończenia (opcjonalne)');
  await endDate.fill('12/2023');

  // Przejdź do Umiejętności
  await page.getByRole('button', { name: /Umiejętności/ }).first().click();
  await page.waitForTimeout(600);
  const skillInput = page.getByPlaceholder('Wpisz technologię (np. React, TypeScript, Docker, PostgreSQL) i naciśnij Enter...');
  await skillInput.fill('Zgrzewanie rur');
  await page.getByRole('button', { name: 'Dodaj' }).first().click();
  await page.waitForTimeout(300);
  await skillInput.fill('Próby ciśnieniowe');
  await page.getByRole('button', { name: 'Dodaj' }).first().click();
  await page.waitForTimeout(300);

  // Wróć do Dane Osobowe
  await page.getByRole('button', { name: /Dane Osobowe/ }).first().click();
  await page.waitForTimeout(600);

  // Otwórz asystenta podsumowania
  await page.getByRole('button', { name: 'Zaproponuj podsumowanie (beztokenowe)' }).click();
  const dialog = page.getByRole('dialog', { name: /Generator Podsumowania Zawodowego/ });
  await dialog.waitFor();

  // Sprawdź brak zmyślonych haseł RLAIF
  const dialogText = await dialog.innerText();
  if (dialogText.includes('RLAIF') || dialogText.includes('Adaptacyjne wagi')) {
    throw new Error('Modal zawiera fałszywe oznaczenia RLAIF.');
  }

  // Sprawdź obecność faktów z profilu
  if (!dialogText.includes('Monter instalacji') && !dialogText.includes('Zgrzewanie rur')) {
    throw new Error('Modal nie zawiera faktów z profilu.');
  }

  // Sprawdź brak wymyślonych metryk procentowych
  if (/\d+%/.test(dialogText)) {
    throw new Error('Modal wygenerował niepotwierdzone metryki procentowe.');
  }

  await page.screenshot({ path: 'docs/audyt-podsumowanie-faktograficzne-2026-09-30.png', fullPage: true });

  // Wybierz pierwszą propozycję
  await dialog.getByRole('button', { name: 'Wstaw do profilu' }).first().click();
  await dialog.waitFor({ state: 'hidden' });

  // Sprawdź, czy pole podsumowania zostało uzupełnione
  const summaryField = page.locator('textarea').first();
  const val = await summaryField.inputValue();
  if (!val || val.length < 10) {
    throw new Error('Pole podsumowania nie zostało uzupełnione tekstem z asystenta.');
  }

  await page.screenshot({ path: 'docs/audyt-podsumowanie-wstawione-2026-09-30.png', fullPage: true });
  console.log('Asystent podsumowania: pomyślnie wygenerowano propozycje bez zmyślonych danych i wstawiono do profilu.');
} finally {
  await context.close();
  await browser.close();
}
