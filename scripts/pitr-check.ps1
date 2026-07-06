param([string]$ComposeFile = "docker-compose.yml")
$ErrorActionPreference = "Stop"
docker compose -f $ComposeFile exec -T postgres pgbackrest --stanza=cordillera check
if ($LASTEXITCODE -ne 0) { throw "pgBackRest check failed." }
docker compose -f $ComposeFile exec -T postgres pgbackrest --stanza=cordillera info
if ($LASTEXITCODE -ne 0) { throw "pgBackRest info failed." }
docker compose -f $ComposeFile exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT archived_count, failed_count, last_archived_wal, last_archived_time FROM pg_stat_archiver;"'
if ($LASTEXITCODE -ne 0) { throw "Could not read pg_stat_archiver." }
