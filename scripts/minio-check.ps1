param(
  [string]$Alias = "educacore",
  [switch]$SkipWriteTest
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
  docker run --rm -v "${mcConfig}:/root/.mc" $mcImage @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "mc command failed: $(Format-McArguments $Arguments)"
  }
}

try {
  Invoke-Mc alias set $Alias $endpoint $accessKey $secretKey

  foreach ($bucket in @($documentsBucket, $tempBucket, $archivesBucket)) {
    Write-Host "Checking bucket: $bucket"
    Invoke-Mc ls "$Alias/$bucket"
    Invoke-Mc version info "$Alias/$bucket"
    Invoke-Mc ilm rule ls "$Alias/$bucket"
  }

  if (-not $SkipWriteTest) {
    $probeName = "healthchecks/minio-check-$([Guid]::NewGuid().ToString("N")).txt"
    $probeFile = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetFileName($probeName))
    Set-Content -Path $probeFile -Value "educacore minio check $(Get-Date -Format o)" -Encoding UTF8
    docker run --rm -v "${mcConfig}:/root/.mc" -v "${probeFile}:/probe.txt:ro" $mcImage cp /probe.txt "$Alias/$tempBucket/$probeName"
    if ($LASTEXITCODE -ne 0) { throw "Unable to upload probe object" }
    Invoke-Mc stat "$Alias/$tempBucket/$probeName"
    Invoke-Mc rm "$Alias/$tempBucket/$probeName"
    Remove-Item -LiteralPath $probeFile -Force
  }

  Write-Host "MinIO check completed"
} finally {
  Remove-Item -LiteralPath $mcConfig -Recurse -Force -ErrorAction SilentlyContinue
}
