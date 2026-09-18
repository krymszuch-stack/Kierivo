# Kierivo na Azure Container Apps

Frontend React i API Express są jednym kontenerem pod tym samym adresem. Supabase
pozostaje źródłem danych, a AI działa przez Azure OpenAI po pseudonimizacji.
Nie używamy Firebase, Cloud Run, Gemini ani klucza Azure OpenAI w aplikacji.

## Wymagane przed pierwszym wdrożeniem

1. Azure CLI i aktywna subskrypcja w właściwym tenantcie.
2. Utworzony zasób Azure OpenAI w europejskim regionie obsługiwanym przez subskrypcję (dla bieżącego wdrożenia: `polandcentral`) oraz ręcznie wybrany, dostępny
   deployment modelu. Skrypt sprawdza jego istnienie i nie zgaduje nazwy modelu.
3. Wartości Supabase: URL, anon key oraz service role. Ostatnia wartość trafia
   wyłącznie do Azure Key Vault przez ukryty prompt.
4. Nazwa ACR i Key Vault muszą być globalnie unikalne.

## Utworzenie infrastruktury

W czystym checkoutie uruchom:

```powershell
.\scripts\deploy-azure-beta.ps1 `
  -ProjectName kierivo `
  -RegistryName kierivoacrunikalna `
  -KeyVaultName kierivokvunikalny `
  -AzureOpenAiName kierivo-openai `
  -AzureOpenAiDeployment wybrany-deployment
```

Skrypt tworzy resource group, ACR, Key Vault z Azure RBAC, Log Analytics,
Container Apps Environment i aplikację z jedną repliką (maksymalnie trzy).
Przydziela tylko `AcrPull`, `Key Vault Secrets User` i `Cognitive Services OpenAI User`
tożsamości zarządzanej aplikacji. Po deployu wymaga rzeczywistego JSON-a
`{"status":"ok"}` z `/api/health`.

## Domena Cloudflare

1. W Azure rozpocznij dodanie `kierivo.com` do Container App i pobierz
   kod weryfikacyjny CNAME/TXT.
2. Uruchom `prepare-cloudflare-domain.ps1` z FQDN Container App i tym kodem.
   Skrypt zapisuje aktualne rekordy do lokalnego `work/` przed zmianą i ustawia
   CNAME w trybie DNS-only oraz `asuid.cvelocity`.
3. Zwiąż zarządzany certyfikat Azure z domeną, sprawdź HTTPS i `/api/health`.
4. Dopiero wtedy włącz proxy Cloudflare oraz SSL/TLS **Full (strict)**.

## GitHub Actions

Workflow `deploy-azure.yml` używa OIDC. Skonfiguruj jako GitHub Variables:
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`,
`AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_ACR_LOGIN_SERVER`,
`AZURE_CONTAINER_APP`, `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`.
Federated credential i role dla workflow tworzy się po stronie Azure; żadnego
pliku JSON konta usługi nie wolno zapisywać w GitHub Secrets.

## Odbiór i wycofanie Google

Przed przełączeniem DNS potwierdź działanie strony, `/api/health`, logowania
Supabase, własnego konta testowego oraz pojedynczej operacji Azure OpenAI bez
danych prywatnych. Zachowaj snapshot Cloudflare do rollbacku.

Po odbiorze usuń workflow i sekrety Firebase/GCP z GitHub, następnie zasoby
Google związane wyłącznie z `skillvault-99a72`. Usunięcie projektu Google Cloud
jest nieodwracalne i wymaga osobnego, końcowego potwierdzenia z listą zasobów.
