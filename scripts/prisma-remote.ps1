param(
  [ValidateSet("status", "deploy")]
  [string]$Action = "status",

  [string]$DatabaseUrl = $env:DATABASE_URL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "Set DATABASE_URL first or pass -DatabaseUrl. Example: `$env:DATABASE_URL='postgresql://...'; npm run db:remote:status"
}

if (-not ($DatabaseUrl -match "^postgres(ql)?://")) {
  throw "DATABASE_URL must start with postgresql:// or postgres://"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $repoRoot "backend"
$migrationsDir = Join-Path $backendDir "prisma\migrations"

if (-not (Test-Path $migrationsDir)) {
  throw "Could not find migrations at $migrationsDir"
}

Write-Host "Working directory: $backendDir"
Write-Host "Local migrations included:"
Get-ChildItem -Directory $migrationsDir | ForEach-Object {
  Write-Host "  - $($_.Name)"
}

$env:DATABASE_URL = $DatabaseUrl

Push-Location $backendDir
try {
  if ($Action -eq "status") {
    & npx prisma migrate status --schema prisma/schema.prisma
  } else {
    & npx prisma migrate deploy --schema prisma/schema.prisma
  }

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
