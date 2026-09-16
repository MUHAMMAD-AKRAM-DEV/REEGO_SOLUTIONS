<#
.SYNOPSIS
  Resets the PostgreSQL superuser password when it has been lost.

.DESCRIPTION
  PostgreSQL has no password recovery - the only route is to briefly tell the
  server to trust local connections, set a new password, and put the original
  configuration back.

  This script does exactly that, and nothing else:

    1. Backs up pg_hba.conf alongside the original, timestamped
    2. Prepends two trust lines scoped to loopback only (127.0.0.1 and ::1)
       for the postgres user - not "all", and not any other address
    3. Restarts the service so the change takes effect
    4. Sets the new password
    5. Restores the original pg_hba.conf and restarts again

  Step 5 runs in a finally block, so the original configuration is restored
  even if something fails in the middle. The trust window lasts seconds and
  never accepts a connection from off this machine.

  Must be run from an elevated PowerShell - it writes under Program Files and
  restarts a Windows service.

.EXAMPLE
  .\scripts\reset-postgres-password.ps1
  Generates a strong password and prints it.

.EXAMPLE
  .\scripts\reset-postgres-password.ps1 -NewPassword 'my-chosen-password'
#>

[CmdletBinding()]
param(
  [string]$NewPassword,
  [string]$PgRoot = "C:\Program Files\PostgreSQL\18",
  [string]$ServiceName = "postgresql-x64-18"
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Error "Run this from an elevated PowerShell (right-click PowerShell, Run as administrator)."
  exit 1
}

$dataDir = Join-Path $PgRoot "data"
$hba = Join-Path $dataDir "pg_hba.conf"
$psql = Join-Path $PgRoot "bin\psql.exe"

foreach ($path in @($hba, $psql)) {
  if (-not (Test-Path $path)) {
    Write-Error "Not found: $path  - pass -PgRoot if PostgreSQL is installed elsewhere."
    exit 1
  }
}

if (-not $NewPassword) {
  # Alphanumeric only, so it needs no escaping in a connection URL or SQL.
  $alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray()
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $NewPassword = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}

if ($NewPassword -match "[']") {
  Write-Error "Choose a password without single quotes."
  exit 1
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$hba.backup-$stamp"

Write-Host "Backing up pg_hba.conf to $backup"
Copy-Item $hba $backup -Force

try {
  $original = Get-Content $hba -Raw

  $trustLines = @(
    "# TEMPORARY - added by reset-postgres-password.ps1 at $stamp",
    "# Removed automatically when this script finishes.",
    "host    all    postgres    127.0.0.1/32    trust",
    "host    all    postgres    ::1/128         trust",
    ""
  ) -join "`n"

  Set-Content -Path $hba -Value ($trustLines + $original) -Encoding ascii

  Write-Host "Restarting $ServiceName ..."
  Restart-Service $ServiceName -Force
  Start-Sleep -Seconds 2

  # The service reports running slightly before it accepts connections.
  $ready = $false
  foreach ($attempt in 1..15) {
    & $psql -U postgres -h 127.0.0.1 -d postgres -c "SELECT 1" *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw "PostgreSQL did not accept a local connection after restart." }

  Write-Host "Setting new password for role 'postgres' ..."
  $alter = "ALTER USER postgres WITH PASSWORD '$NewPassword'"
  & $psql -U postgres -h 127.0.0.1 -d postgres -c $alter *> $null
  if ($LASTEXITCODE -ne 0) { throw "ALTER USER failed." }
}
finally {
  Write-Host "Restoring original pg_hba.conf ..."
  Copy-Item $backup $hba -Force
  Restart-Service $ServiceName -Force
  Start-Sleep -Seconds 2
  Write-Host "Original configuration restored."
}

Write-Host ""
Write-Host "Done. The postgres password is now:" -ForegroundColor Green
Write-Host ""
Write-Host "    $NewPassword"
Write-Host ""
Write-Host "Next, from the project directory in a normal (non-admin) terminal:"
Write-Host ""
Write-Host ('    $env:PGPASSWORD=''' + $NewPassword + '''; npm run db:init; npm run db:migrate; npm run db:seed')
Write-Host ""
