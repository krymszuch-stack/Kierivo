[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidatePattern('^[a-z][a-z0-9-]{0,24}[a-z0-9]$')]
  [string]$ProjectName,

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-z0-9]{5,50}$')]
  [string]$RegistryName,

  [ValidateSet('westeurope', 'northeurope', 'swedencentral')]
  [string]$Location = 'westeurope'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-AzureCli {
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw 'Brak Azure CLI. Uruchom: winget install --exact --id Microsoft.AzureCLI. Następnie otwórz nowy terminal.'
  }
}

function Read-RequiredText([string]$Prompt) {
  do { $value = Read-Host $Prompt } while ([string]::IsNullOrWhiteSpace($value))
  return $value.Trim()
}

function Read-RequiredSecret([string]$Prompt) {
  $value = Read-Host -Prompt $Prompt -AsSecureString
  if ($value.Length -eq 0) { throw "$Prompt nie może być pusty." }
  return $value
}

function ConvertTo-PlainText([Security.SecureString]$SecureValue) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Ensure-Provider([string]$Namespace) {
  $state = az provider show --namespace $Namespace --query registrationState --output tsv
  if ($state -ne 'Registered') {
    Write-Host "Rejestruję dostawcę $Namespace..."
    az provider register --namespace $Namespace --wait --only-show-errors
  }
}

function Test-AzResource([scriptblock]$Command) {
  try {
    & $Command 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

Require-AzureCli
az extension add --name containerapp --upgrade --only-show-errors
$account = az account show --output json | ConvertFrom-Json
Write-Host "Subskrypcja: $($account.name) ($($account.id))"

$ResourceGroup = "rg-$ProjectName"
$ContainerApp = "$ProjectName-beta"
$Environment = "cae-$ProjectName"
$IdentityName = "id-$ProjectName-acr"
$LogWorkspace = ("log" + $ProjectName.Replace('-', '')).Substring(0, [Math]::Min(63, ("log" + $ProjectName.Replace('-', '')).Length))

foreach ($provider in 'Microsoft.App', 'Microsoft.OperationalInsights', 'Microsoft.ContainerRegistry', 'Microsoft.ManagedIdentity') {
  Ensure-Provider $provider
}

if ((az group exists --name $ResourceGroup) -ne 'true') {
  az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null
}

if (-not (Test-AzResource { az acr show --name $RegistryName --resource-group $ResourceGroup --only-show-errors })) {
  Write-Host "Tworzę ACR: $RegistryName"
  az acr create --name $RegistryName --resource-group $ResourceGroup --sku Basic --admin-enabled false --only-show-errors | Out-Null
}

if (-not (Test-AzResource { az monitor log-analytics workspace show --resource-group $ResourceGroup --workspace-name $LogWorkspace --only-show-errors })) {
  Write-Host "Tworzę Log Analytics: $LogWorkspace"
  az monitor log-analytics workspace create --resource-group $ResourceGroup --workspace-name $LogWorkspace --location $Location --only-show-errors | Out-Null
}

if (-not (Test-AzResource { az containerapp env show --name $Environment --resource-group $ResourceGroup --only-show-errors })) {
  $workspaceId = az monitor log-analytics workspace show --resource-group $ResourceGroup --workspace-name $LogWorkspace --query customerId --output tsv
  $workspaceKey = az monitor log-analytics workspace get-shared-keys --resource-group $ResourceGroup --workspace-name $LogWorkspace --query primarySharedKey --output tsv
  Write-Host "Tworzę środowisko Container Apps: $Environment"
  az containerapp env create --name $Environment --resource-group $ResourceGroup --location $Location --logs-workspace-id $workspaceId --logs-workspace-key $workspaceKey --only-show-errors | Out-Null
}

# Wartości VITE są jawne dla przeglądarki. Nigdy nie podawaj tu service_role.
$supabaseUrl = Read-RequiredText 'SUPABASE_URL'
$supabaseAnonKey = Read-RequiredText 'VITE_SUPABASE_ANON_KEY'
$serviceRoleSecret = Read-RequiredSecret 'SUPABASE_SERVICE_ROLE_KEY (ukryty wpis)'
$geminiSecret = Read-RequiredSecret 'GEMINI_API_KEY (ukryty wpis)'

$imageTag = Get-Date -Format 'yyyyMMddHHmmss'
$imageName = "$($ContainerApp):$imageTag"
Write-Host "Buduję obraz w Azure Container Registry: $imageName"
az acr build --registry $RegistryName --image $imageName --file Dockerfile --build-arg "VITE_SUPABASE_URL=$supabaseUrl" --build-arg "VITE_SUPABASE_ANON_KEY=$supabaseAnonKey" . --only-show-errors

if (-not (Test-AzResource { az identity show --name $IdentityName --resource-group $ResourceGroup --only-show-errors })) {
  az identity create --name $IdentityName --resource-group $ResourceGroup --location $Location --only-show-errors | Out-Null
}
$identityId = az identity show --name $IdentityName --resource-group $ResourceGroup --query id --output tsv
$principalId = az identity show --name $IdentityName --resource-group $ResourceGroup --query principalId --output tsv
$registryId = az acr show --name $RegistryName --resource-group $ResourceGroup --query id --output tsv
if (-not (Test-AzResource { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role AcrPull --scope $registryId --only-show-errors })) {
  Write-Host 'Rola AcrPull już istnieje albo Azure ją jeszcze propaguje.'
}

$registryServer = az acr show --name $RegistryName --resource-group $ResourceGroup --query loginServer --output tsv
$image = "$registryServer/$imageName"
$appExists = Test-AzResource { az containerapp show --name $ContainerApp --resource-group $ResourceGroup --only-show-errors }
$plainServiceRole = ConvertTo-PlainText $serviceRoleSecret
$plainGemini = ConvertTo-PlainText $geminiSecret

try {
  if (-not $appExists) {
    Write-Host "Tworzę aplikację publiczną: $ContainerApp"
    az containerapp create --name $ContainerApp --resource-group $ResourceGroup --environment $Environment --user-assigned $identityId --registry-identity $identityId --registry-server $registryServer --image $image --ingress external --target-port 8080 --transport auto --cpu 1.0 --memory 2.0Gi --min-replicas 1 --max-replicas 3 --scale-rule-name http --scale-rule-http-concurrency 40 --secrets "supabase-service-role=$plainServiceRole" "gemini-api-key=$plainGemini" --env-vars 'NODE_ENV=production' 'BACKEND_MODE=cloud' 'TRUST_PROXY=true' "SUPABASE_URL=$supabaseUrl" 'SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role' 'GEMINI_API_KEY=secretref:gemini-api-key' 'APP_URL=https://placeholder.invalid' --only-show-errors | Out-Null
  } else {
    az containerapp secret set --name $ContainerApp --resource-group $ResourceGroup --secrets "supabase-service-role=$plainServiceRole" "gemini-api-key=$plainGemini" --only-show-errors | Out-Null
    az containerapp registry set --name $ContainerApp --resource-group $ResourceGroup --server $registryServer --identity $identityId --only-show-errors | Out-Null
    az containerapp update --name $ContainerApp --resource-group $ResourceGroup --image $image --cpu 1.0 --memory 2.0Gi --min-replicas 1 --max-replicas 3 --set-env-vars 'NODE_ENV=production' 'BACKEND_MODE=cloud' 'TRUST_PROXY=true' "SUPABASE_URL=$supabaseUrl" 'SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role' 'GEMINI_API_KEY=secretref:gemini-api-key' --only-show-errors | Out-Null
  }
} finally {
  Remove-Variable plainServiceRole, plainGemini -ErrorAction SilentlyContinue
}

$fqdn = az containerapp show --name $ContainerApp --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv
$appUrl = "https://$fqdn"
az containerapp update --name $ContainerApp --resource-group $ResourceGroup --set-env-vars "APP_URL=$appUrl" --only-show-errors | Out-Null

Write-Host "Czekam na zdrowie aplikacji: $appUrl/api/health"
$health = $null
$deadline = (Get-Date).AddMinutes(5)
do {
  try { $health = Invoke-RestMethod -Uri "$appUrl/api/health" -TimeoutSec 20 } catch { Start-Sleep -Seconds 10 }
} while (($null -eq $health -or $health.success -ne $true) -and (Get-Date) -lt $deadline)
if ($null -eq $health -or $health.success -ne $true) {
  throw "Brak odpowiedzi success: true w 5 minut. Sprawdź: az containerapp logs show --name $ContainerApp --resource-group $ResourceGroup --follow"
}

Write-Host ''
Write-Host 'WDROŻENIE GOTOWE'
Write-Host "Adres beta: $appUrl"
Write-Host "Kontrola: $appUrl/api/health"
Write-Host "Logi: az containerapp logs show --name $ContainerApp --resource-group $ResourceGroup --follow"
Write-Host 'Stripe pozostał wyłączony: wymagane są migracje Supabase i test webhooka.'
