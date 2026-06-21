[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$AllowedRemoteAddresses,

    [string]$RulePrefix = "Squid Docker 3128"
)

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    throw "Bitte PowerShell als Administrator starten."
}

$allowRuleName = "$RulePrefix - Allow"
$blockRuleName = "$RulePrefix - Block"

# Alte Regeln entfernen, damit das Skript idempotent bleibt.
Get-NetFirewallRule -DisplayName $allowRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName $blockRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

$allowList = @($AllowedRemoteAddresses + "127.0.0.1" + "::1") |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Unique

if ($allowList.Count -eq 0) {
    throw "Es wurden keine gueltigen IP-Adressen fuer AllowedRemoteAddresses uebergeben."
}

$allowListCsv = ($allowList -join ",")

New-NetFirewallRule \
    -DisplayName $allowRuleName \
    -Direction Inbound \
    -Action Allow \
    -Protocol TCP \
    -LocalPort 3128 \
    -RemoteAddress $allowListCsv \
    -Profile Any

New-NetFirewallRule \
    -DisplayName $blockRuleName \
    -Direction Inbound \
    -Action Block \
    -Protocol TCP \
    -LocalPort 3128 \
    -RemoteAddress Any \
    -Profile Any

Write-Host "Firewall-Regeln wurden gesetzt."
Write-Host "Erlaubte Quellen fuer 3128: $allowListCsv"
