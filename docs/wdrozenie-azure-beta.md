# CVelocity beta na Azure Container Apps

Skrypt uruchamia frontend i Express API pod jednym adresem, zachowuje istniejący
Supabase oraz tworzy logi w Log Analytics. Obraz jest budowany w Azure Container
Registry, a aplikacja pobiera go przez tożsamość zarządzaną z rolą AcrPull.

## Stan świadomie ograniczony

- Stripe jest wyłączony. Włączymy go dopiero po migracjach Supabase i teście
  webhooka.
- Kod nie ma jeszcze adaptera Azure AI Foundry. Serwer obecnie wymaga
  GEMINI_API_KEY; utworzenie zasobu Azure AI samo nie podłączy modelu.
- Lokalna Ollama nie będzie wystawiana z sieci domowej do Internetu.

## Przed uruchomieniem

1. Otwórz PowerShell w czystym checkoutie:

       Set-Location 'C:\Users\Adrian\Desktop\Projekty\cvelocity-release-prep'

2. Jeżeli az version nie działa, zainstaluj Azure CLI, zamknij terminal i
   otwórz nowy:

       winget install --exact --id Microsoft.AzureCLI

3. Zaloguj się i sprawdź subskrypcję:

       az login
       az account show --output table

4. Przygotuj lokalnie SUPABASE_URL, klucz anon Supabase,
   SUPABASE_SERVICE_ROLE_KEY i GEMINI_API_KEY. Dwa ostatnie wpisujesz tylko do
   ukrytych promptów PowerShella; skrypt nie zapisuje ich do pliku.

## Uruchomienie

ProjectName jest rzeczywistą nazwą Twojego projektu, wyłącznie małymi literami,
cyframi i pojedynczymi myślnikami. RegistryName jest globalnie unikalną nazwą
rejestru Azure: 5-50 małych liter/cyfr, bez myślników.

       .\scripts\deploy-azure-beta.ps1 -ProjectName 'TWOJA-NAZWA' -RegistryName 'TWOJAUNIKALNANAZWA'

Domyślnie: West Europe, jedna aktywna replika 1 vCPU / 2 GiB, maksimum trzy
repliki, pełne logi. To profil do rzeczywistych testów bety z budżetem 200 USD,
bez zimnego startu. Po tygodniu porównamy koszty z ruchem i zmienimy limity na
podstawie danych.

Udany przebieg kończy się publicznym adresem oraz odpowiedzią JSON success true
pod adresem z końcówką api/health. Sam komunikat Azure o utworzeniu zasobu nie
jest dowodem działającej aplikacji.

## Po wdrożeniu

1. Otwórz adres beta w przeglądarce.
2. Otwórz adres api/health: ma zwrócić JSON, nie HTML.
3. Wykonaj bezpieczny scenariusz: strona startowa, lokalny profil, Pipeline.
   Na tym etapie nie wpisuj danych klientów ani danych płatniczych.
4. W razie błędu śledź logi:

       az containerapp logs show --name TWOJA-NAZWA-beta --resource-group rg-TWOJA-NAZWA --follow

## Po godzinach testów

Wstrzymanie aktywnej repliki:

       az containerapp update --name TWOJA-NAZWA-beta --resource-group rg-TWOJA-NAZWA --min-replicas 0

Wznowienie:

       az containerapp update --name TWOJA-NAZWA-beta --resource-group rg-TWOJA-NAZWA --min-replicas 1

Nie usuwaj grupy zasobów, aby zatrzymać koszt. Usunęłoby to także logi,
rejestr obrazu i środowisko.
