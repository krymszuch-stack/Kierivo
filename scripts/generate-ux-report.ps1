[CmdletBinding()]
param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$AppUrl = "http://localhost:5173",
    [string]$ReportName = "1234"
)

$ErrorActionPreference = "Stop"

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$ReportRoot = Join-Path $ProjectPath ("reports\{0}" -f $ReportName)

New-Item `
    -ItemType Directory `
    -Path $ReportRoot `
    -Force |
    Out-Null

Write-Host ("Starting report {0}" -f $ReportName) -ForegroundColor Cyan
Write-Host ("Project: {0}" -f $ProjectPath) -ForegroundColor Cyan
Write-Host ("App URL: {0}" -f $AppUrl) -ForegroundColor Cyan

$reportPath = Join-Path $ReportRoot ("{0}-report.md" -f $ReportName)

$content = @(
    "# Kierivo report",
    "",
    ("Report: {0}" -f $ReportName),
    ("Project: {0}" -f $ProjectPath),
    ("App URL: {0}" -f $AppUrl),
    ("Generated: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
) -join [Environment]::NewLine

[System.IO.File]::WriteAllText(
    $reportPath,
    $content,
    [System.Text.UTF8Encoding]::new($true)
)

Write-Host ("Report saved: {0}" -f $reportPath) -ForegroundColor Green