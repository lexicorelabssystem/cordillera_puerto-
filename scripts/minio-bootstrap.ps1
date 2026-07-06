param(
  [string]$Alias = "educacore",
  [int]$TempExpireDays = 7,
  [int]$DocumentsNoncurrentExpireDays = 60,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Require-Env($name) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $name"
  }
  return $value
}

$endpoint = Require-Env "MINIO_ENDPOINT"
$accessKey = Require-Env "MINIO_ACCESS_KEY"
$secretKey = Require-Env "MINIO_SECRET_KEY"
$documentsBucket = Require-Env "MINIO_DOCUMENTS_BUCKET"
$tempBucket = Require-Env "MINIO_TEMP_BUCKET"
$archivesBucket = Require-Env "MINIO_ARCHIVES_BUCKET"
$useSslValue = [Environment]::GetEnvironmentVariable("MINIO_USE_SSL")
if ([string]::IsNullOrWhiteSpace($useSslValue)) {
  $useSslValue = "false"
}
$useSsl = $useSslValue.ToLowerInvariant() -eq "true"
$port = [Environment]::GetEnvironmentVariable("MINIO_PORT")

if ($endpoint -notmatch "^https?://") {
  $scheme = if ($useSsl) { "https" } else { "http" }
  if (-not [string]::IsNullOrWhiteSpace($port) -and $port -notin @("80", "443")) {
    $endpoint = "${scheme}://${endpoint}:${port}"
  } else {
    $endpoint = "${scheme}://${endpoint}"
  }
}

$mcImage = [Environment]::GetEnvironmentVariable("MINIO_MC_IMAGE")
if ([string]::IsNullOrWhiteSpace($mcImage)) {
  $mcImage = "minio/mc:latest"
}

$mcConfig = Join-Path ([System.IO.Path]::GetTempPath()) ("educacore-mc-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $mcConfig | Out-Null


function Format-McArguments {
  param([string[]]$Arguments)
  if ($Arguments.Length -ge 2 -and $Arguments[0] -eq "alias" -and $Arguments[1] -eq "set") {
    return "alias set <alias> <endpoint> <access-key> <secret-key>"
  }
  return $Arguments -join " "
}

function Invoke-Mc {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if (-not $Apply) {
    Write-Host "DRY RUN: mc $(Format-McArguments $Arguments)"
    return
  }
  docker run --rm -v "${mcConfig}:/root/.mc" $mcImage @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "mc command failed: $(Format-McArguments $Arguments)"
  }
}

try {
  Invoke-Mc alias set $Alias $endpoint $accessKey $secretKey

  foreach ($bucket in @($documentsBucket, $tempBucket, $archivesBucket)) {
    Invoke-Mc mb --ignore-existing "$Alias/$bucket"
  }

  Invoke-Mc version enable "$Alias/$documentsBucket"
  Invoke-Mc version enable "$Alias/$archivesBucket"
  Invoke-Mc ilm rule add --expire-days $TempExpireDays "$Alias/$tempBucket"
  Invoke-Mc ilm rule add --noncurrent-expire-days $DocumentsNoncurrentExpireDays "$Alias/$documentsBucket"
  Invoke-Mc ilm rule add --expire-delete-marker "$Alias/$documentsBucket"

  if (-not $Apply) {
    Write-Host "Dry run complete. Re-run with -Apply to execute."
  } else {
    Write-Host "MinIO bootstrap completed"
  }
} finally {
  Remove-Item -LiteralPath $mcConfig -Recurse -Force -ErrorAction SilentlyContinue
}
