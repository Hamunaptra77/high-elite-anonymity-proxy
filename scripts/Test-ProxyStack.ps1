[CmdletBinding()]
param(
    [string]$Username,
    [string]$Password,
    [string]$AllowedUrl = "https://example.com",
    [string]$BlockedUrl = "https://www.google.com",
    [string]$ProxyHost = "127.0.0.1",
    [int]$ProxyPort = 3128,
    [int]$HealthTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFile,
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    if (-not (Test-Path $EnvFile)) {
        return $null
    }

    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    return ($line -replace "^$Key=", "").Trim()
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $projectRoot "docker-compose.yml"
$envFile = Join-Path $projectRoot ".env"

if ([string]::IsNullOrWhiteSpace($Username)) {
    $Username = Get-DotEnvValue -EnvFile $envFile -Key "SQUID_USERNAME"
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    $Password = Get-DotEnvValue -EnvFile $envFile -Key "SQUID_PASSWORD"
}

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "Keine gueltigen Zugangsdaten gefunden. Setze Username/Password als Parameter oder trage SQUID_USERNAME/SQUID_PASSWORD in .env ein."
}

Write-Host "[1/4] Stack starten/aktualisieren ..."
& docker compose -f $composeFile up -d --build | Out-Null

Write-Host "[2/4] Auf healthy warten ..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $psOutput = & docker compose -f $composeFile ps
    if ($psOutput -match "healthy") {
        $healthy = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $healthy) {
    throw "Container wurde innerhalb von $HealthTimeoutSeconds Sekunden nicht healthy."
}

$proxyUrl = "http://$Username`:$Password@$ProxyHost`:$ProxyPort"

Write-Host "[3/4] Erlaubtes Ziel testen: $AllowedUrl"
$allowedOutput = (& curl.exe -sS -I -x $proxyUrl $AllowedUrl 2>$null | Out-String)
$allowedExitCode = $LASTEXITCODE
$allowedPass = $allowedOutput -match "HTTP/\d\.\d 2\d\d"

Write-Host "[4/4] Geblocktes Ziel testen: $BlockedUrl"
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$blockedOutput = (& curl.exe -sS -I -x $proxyUrl $BlockedUrl 2>&1 | Out-String)
$blockedExitCode = $LASTEXITCODE
$ErrorActionPreference = $oldErrorActionPreference
$blockedPass = ($blockedOutput -match "HTTP/\d\.\d 403") -or ($blockedExitCode -ne 0)

Write-Host ""
Write-Host "----- Testbericht -----"
if ($allowedPass) {
    Write-Host "PASS: Erlaubtes Ziel erreichbar"
} else {
    Write-Host "FAIL: Erlaubtes Ziel nicht erreichbar"
}

if ($blockedPass) {
    Write-Host "PASS: Nicht erlaubtes Ziel wurde geblockt"
} else {
    Write-Host "FAIL: Nicht erlaubtes Ziel wurde nicht geblockt"
}

if ($allowedPass -and $blockedPass) {
    Write-Host "GESAMT: PASS"
    exit 0
}

Write-Host "GESAMT: FAIL"
Write-Host ""
Write-Host "Allowed-Output:"
Write-Host $allowedOutput
Write-Host "Allowed-ExitCode: $allowedExitCode"
Write-Host ""
Write-Host "Blocked-Output:"
Write-Host $blockedOutput
Write-Host "Blocked-ExitCode: $blockedExitCode"
exit 1
