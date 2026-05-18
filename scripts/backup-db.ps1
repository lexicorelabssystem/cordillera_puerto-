param(
    [string]$ContainerName = "cordillera-postgres",
    [string]$DbUser = "cordillera",
    [string]$DbName = "cordillera_dev",
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $BackupDir "cordillera_backup_${timestamp}.sql"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "Iniciando backup de PostgreSQL..."
docker exec $ContainerName pg_dump -U $DbUser -d $DbName --no-owner --no-acl | Out-File -FilePath $sqlFile -Encoding utf8

if ($LASTEXITCODE -eq 0 -and (Test-Path $sqlFile)) {
    $sqlSize = (Get-Item $sqlFile).Length
    Write-Host "Dump exitoso: $sqlFile ($([math]::Round($sqlSize/1KB, 1)) KB)"

    $gzFile = $sqlFile -replace "\.sql$", ".sql.gz"
    try {
        $srcStream = [System.IO.File]::OpenRead($sqlFile)
        $destStream = [System.IO.File]::Create($gzFile)
        $gzipStream = [System.IO.Compression.GZipStream]::new($destStream, [System.IO.Compression.CompressionMode]::Compress)
        $srcStream.CopyTo($gzipStream)
        $gzipStream.Close()
        $srcStream.Close()
        $destStream.Close()
        Remove-Item $sqlFile -Force

        $gzSize = (Get-Item $gzFile).Length
        Write-Host "Compresion exitosa: ${gzFile} ($([math]::Round($gzSize/1KB, 1)) KB)"
    } catch {
        Write-Host "Compresion fallo, conservando SQL sin comprimir: $sqlFile"
    }

    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem $BackupDir -Filter "cordillera_backup_*" |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Host "Rotacion: eliminado backup antiguo $($_.Name)"
        }
} else {
    Write-Error "Backup fallo. Verifica que el contenedor '$ContainerName' este corriendo."
    exit 1
}
