[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ContainerAppFqdn,
  [Parameter(Mandatory)][string]$AzureValidationCode,
  [string]$ZoneName = 'oathcry.com',
  [string]$HostName = 'cvelocity',
  [string]$RollbackPath = 'work/cloudflare-dns-before-azure.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-CloudflareToken {
  $secure = Read-Host -Prompt 'Cloudflare API Token (DNS Edit dla tej strefy, ukryty wpis)' -AsSecureString
  if ($secure.Length -eq 0) { throw 'Token Cloudflare nie może być pusty.' }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$token = Read-CloudflareToken
try {
  $headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  $zone = (Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones?name=$ZoneName&status=active").result | Select-Object -First 1
  if (-not $zone) { throw "Nie znaleziono aktywnej strefy $ZoneName w bieżącym tokenie." }
  $fqdn = "$HostName.$ZoneName"
  $records = (Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records?name=$fqdn").result
  $txtName = "asuid.$HostName.$ZoneName"
  $txtRecords = (Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records?name=$txtName").result
  $parent = Split-Path -Parent $RollbackPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [pscustomobject]@{ zone = $ZoneName; capturedAt = (Get-Date).ToString('o'); records = @($records) + @($txtRecords) } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $RollbackPath -Encoding utf8

  foreach ($record in @($records) + @($txtRecords)) { Invoke-RestMethod -Method Delete -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records/$($record.id)" | Out-Null }
  $cname = @{ type = 'CNAME'; name = $HostName; content = $ContainerAppFqdn.TrimEnd('.'); ttl = 1; proxied = $false } | ConvertTo-Json
  $txt = @{ type = 'TXT'; name = "asuid.$HostName"; content = $AzureValidationCode; ttl = 1 } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records" -Body $cname | Out-Null
  Invoke-RestMethod -Method Post -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$($zone.id)/dns_records" -Body $txt | Out-Null
  Write-Host "Przygotowano DNS-only dla $fqdn. Snapshot rollbacku: $RollbackPath"
  Write-Host 'Po pomyślnym związaniu certyfikatu Azure ustaw proxy Cloudflare i SSL/TLS Full (strict).'
} finally {
  Remove-Variable token -ErrorAction SilentlyContinue
}
