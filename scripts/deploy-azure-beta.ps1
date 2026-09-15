[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{0,24}[a-z0-9]$')][string]$ProjectName,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9]{5,50}$')][string]$RegistryName,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{3,24}$')][string]$KeyVaultName,
  [Parameter(Mandatory)][string]$AzureOpenAiName,
  [Parameter(Mandatory)][string]$AzureOpenAiDeployment,
  [ValidateSet('westeurope')][string]$Location = 'westeurope'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-Az { if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Brak Azure CLI. Zainstaluj Microsoft.AzureCLI i otwórz nowy terminal.' } }
function Exists([scriptblock]$Command) { try { & $Command 2>$null | Out-Null; return $LASTEXITCODE -eq 0 } catch { return $false } }
function Read-Required([string]$Prompt) { do { $value = Read-Host $Prompt } while ([string]::IsNullOrWhiteSpace($value)); return $value.Trim() }
function Read-SecretValue([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  if ($secure.Length -eq 0) { throw "$Prompt nie może być pusty." }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Ensure-Provider([string]$Name) {
  if ((az provider show --namespace $Name --query registrationState -o tsv) -ne 'Registered') {
    az provider register --namespace $Name --wait --only-show-errors | Out-Null
  }
}

Require-Az
az extension add --name containerapp --upgrade --only-show-errors
$account = az account show -o json | ConvertFrom-Json
Write-Host "Subskrypcja: $($account.name) ($($account.id))"

$rg = "rg-$ProjectName"
$app = "$ProjectName-beta"
$environment = "cae-$ProjectName"
$identity = "id-$ProjectName-workload"
$workspace = ("log" + $ProjectName.Replace('-', '')).Substring(0, [Math]::Min(63, ("log" + $ProjectName.Replace('-', '')).Length))
foreach ($provider in 'Microsoft.App','Microsoft.ContainerRegistry','Microsoft.KeyVault','Microsoft.ManagedIdentity','Microsoft.OperationalInsights','Microsoft.CognitiveServices','Microsoft.Consumption') { Ensure-Provider $provider }

if ((az group exists --name $rg) -ne 'true') { az group create --name $rg --location $Location --only-show-errors | Out-Null }
if (-not (Exists { az acr show --name $RegistryName --resource-group $rg --only-show-errors })) { az acr create --name $RegistryName --resource-group $rg --sku Basic --admin-enabled false --only-show-errors | Out-Null }
if (-not (Exists { az keyvault show --name $KeyVaultName --resource-group $rg --only-show-errors })) { az keyvault create --name $KeyVaultName --resource-group $rg --location $Location --enable-rbac-authorization true --only-show-errors | Out-Null }
if (-not (Exists { az monitor log-analytics workspace show --resource-group $rg --workspace-name $workspace --only-show-errors })) { az monitor log-analytics workspace create --resource-group $rg --workspace-name $workspace --location $Location --only-show-errors | Out-Null }
if (-not (Exists { az identity show --name $identity --resource-group $rg --only-show-errors })) { az identity create --name $identity --resource-group $rg --location $Location --only-show-errors | Out-Null }

$identityId = az identity show --name $identity --resource-group $rg --query id -o tsv
$principalId = az identity show --name $identity --resource-group $rg --query principalId -o tsv
$registryId = az acr show --name $RegistryName --resource-group $rg --query id -o tsv
az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role AcrPull --scope $registryId --only-show-errors 2>$null | Out-Null

# Azure OpenAI musi istnieć wraz z deploymentem: skrypt nie zgaduje modelu ani wersji.
if (-not (Exists { az cognitiveservices account show --name $AzureOpenAiName --resource-group $rg --only-show-errors })) { throw "Nie znaleziono zasobu Azure OpenAI $AzureOpenAiName w $rg." }
if (-not (Exists { az cognitiveservices account deployment show --name $AzureOpenAiName --resource-group $rg --deployment-name $AzureOpenAiDeployment --only-show-errors })) { throw "Nie znaleziono deploymentu Azure OpenAI $AzureOpenAiDeployment." }
$openAiId = az cognitiveservices account show --name $AzureOpenAiName --resource-group $rg --query id -o tsv
$openAiEndpoint = az cognitiveservices account show --name $AzureOpenAiName --resource-group $rg --query properties.endpoint -o tsv
az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role 'Cognitive Services OpenAI User' --scope $openAiId --only-show-errors 2>$null | Out-Null
az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role 'Key Vault Secrets User' --scope (az keyvault show --name $KeyVaultName --query id -o tsv) --only-show-errors 2>$null | Out-Null

$supabaseUrl = Read-Required 'SUPABASE_URL'
$viteSupabaseUrl = Read-Required 'VITE_SUPABASE_URL'
$viteSupabaseAnonKey = Read-Required 'VITE_SUPABASE_ANON_KEY'
$serviceRole = Read-SecretValue 'SUPABASE_SERVICE_ROLE_KEY (ukryty wpis)'
try {
  az keyvault secret set --vault-name $KeyVaultName --name supabase-service-role --value $serviceRole --only-show-errors | Out-Null
} finally { Remove-Variable serviceRole -ErrorAction SilentlyContinue }
$secretUri = az keyvault secret show --vault-name $KeyVaultName --name supabase-service-role --query id -o tsv

if (-not (Exists { az containerapp env show --name $environment --resource-group $rg --only-show-errors })) {
  $workspaceId = az monitor log-analytics workspace show --resource-group $rg --workspace-name $workspace --query customerId -o tsv
  $workspaceKey = az monitor log-analytics workspace get-shared-keys --resource-group $rg --workspace-name $workspace --query primarySharedKey -o tsv
  az containerapp env create --name $environment --resource-group $rg --location $Location --logs-workspace-id $workspaceId --logs-workspace-key $workspaceKey --only-show-errors | Out-Null
}

$tag = Get-Date -Format 'yyyyMMddHHmmss'
az acr build --registry $RegistryName --image "${app}:$tag" --file Dockerfile --build-arg "VITE_SUPABASE_URL=$viteSupabaseUrl" --build-arg "VITE_SUPABASE_ANON_KEY=$viteSupabaseAnonKey" . --only-show-errors
$registryServer = az acr show --name $RegistryName --resource-group $rg --query loginServer -o tsv
$image = "${registryServer}/${app}:$tag"
$envVars = @('NODE_ENV=production','BACKEND_MODE=cloud','TRUST_PROXY=true','AI_PROVIDER=azure_openai',"SUPABASE_URL=$supabaseUrl","AZURE_OPENAI_ENDPOINT=$openAiEndpoint","AZURE_OPENAI_DEPLOYMENT=$AzureOpenAiDeployment",'APP_URL=https://placeholder.invalid')
$keyVaultRef = "supabase-service-role=keyvaultref:$secretUri,identityref:$identityId"

if (-not (Exists { az containerapp show --name $app --resource-group $rg --only-show-errors })) {
  az containerapp create --name $app --resource-group $rg --environment $environment --image $image --ingress external --target-port 8080 --transport auto --allow-insecure false --cpu 1.0 --memory 2.0Gi --min-replicas 1 --max-replicas 3 --user-assigned $identityId --registry-identity $identityId --registry-server $registryServer --secrets $keyVaultRef --env-vars $envVars 'SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role' --only-show-errors | Out-Null
} else {
  az containerapp registry set --name $app --resource-group $rg --server $registryServer --identity $identityId --only-show-errors | Out-Null
  az containerapp secret set --name $app --resource-group $rg --secrets $keyVaultRef --only-show-errors | Out-Null
  az containerapp update --name $app --resource-group $rg --image $image --min-replicas 1 --max-replicas 3 --set-env-vars $envVars 'SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role' --only-show-errors | Out-Null
}

$fqdn = az containerapp show --name $app --resource-group $rg --query properties.configuration.ingress.fqdn -o tsv
$appUrl = "https://$fqdn"
az containerapp update --name $app --resource-group $rg --set-env-vars "APP_URL=$appUrl" --only-show-errors | Out-Null
$health = Invoke-RestMethod -Uri "$appUrl/api/health" -TimeoutSec 30
if ($health.status -ne 'ok') { throw 'Kontrola zdrowia nie zwróciła status=ok.' }
Write-Host "WDROŻENIE GOTOWE: $appUrl"
Write-Host "Następny krok: .\scripts\cutover-cloudflare.ps1 -ContainerAppFqdn $fqdn"
