#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 3 * * *}"

mkdir -p "$BACKUP_DIR"

cat > /usr/local/bin/backup.sh << 'EOF'
#!/bin/sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cordillera_backup_${TIMESTAMP}.sql.gz"
pg_dump -h "${PGHOST:-postgres}" -U "${PGUSER:-cordillera}" -d "${PGDATABASE:-cordillera_dev}" --no-owner --no-acl | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup exitoso: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ERROR: Backup fallo" >&2
fi

find "$BACKUP_DIR" -name "cordillera_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null
echo "[$(date)] Rotacion completada (retencion: ${RETENTION_DAYS} dias)"
EOF

chmod +x /usr/local/bin/backup.sh

echo "$CRON_SCHEDULE /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" | crontab -

echo "Backup service iniciado. Schedule: $CRON_SCHEDULE"
echo "Backups guardados en: $BACKUP_DIR"

/usr/sbin/crond -f -l 2
