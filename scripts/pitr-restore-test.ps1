param(
    [string]$TargetTime = "",
    [string]$ComposeFile = "docker-compose.yml",
    [switch]$DestroyTestVolume
)
$ErrorActionPreference = "Stop"
$projectName = (Split-Path -Leaf (Get-Location)).ToLowerInvariant() -replace "[^a-z0-9_-]", ""
$volumeName = "${projectName}_pitr_restore_test"
if ($DestroyTestVolume) { docker volume rm $volumeName; exit $LASTEXITCODE }
if (-not $env:PITR_S3_BUCKET -or -not $env:PITR_S3_ENDPOINT -or -not $env:PITR_S3_KEY -or -not $env:PITR_S3_SECRET -or -not $env:PITR_REPO_CIPHER_PASS) {
    throw "Load PITR S3 credentials and PITR_REPO_CIPHER_PASS before restoring."
}
docker volume create $volumeName | Out-Null
$restoreArgs = @("--stanza=cordillera", "--pg1-path=/var/lib/postgresql/data", "restore")
if ($TargetTime) {
    $restoreArgs = @("--stanza=cordillera", "--pg1-path=/var/lib/postgresql/data", "--type=time", "--target=$TargetTime", "--target-action=promote", "restore")
}
docker compose -f $ComposeFile run --rm --no-deps -v "${volumeName}:/var/lib/postgresql/data" postgres pgbackrest @restoreArgs
if ($LASTEXITCODE -ne 0) { throw "PITR restore failed. The production volume was not modified." }
Write-Host "Restore completed in isolated volume: $volumeName"
Write-Host "Validate it with a temporary PostgreSQL instance before promotion."
