#!/bin/sh
set -eu

STANZA="${PGBACKREST_STANZA:-cordillera}"
FULL_DAY="${PITR_FULL_BACKUP_DAY:-7}"
BACKUP_HOUR="${PITR_BACKUP_HOUR:-2}"
CHECK_INTERVAL="${PITR_CHECK_INTERVAL_SECONDS:-300}"
STATE_DIR="${PITR_STATE_DIR:-/var/lib/pgbackrest}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$STATE_DIR"
  chown postgres:postgres "$STATE_DIR"
  exec su-exec postgres "$0" "$@"
fi

mkdir -p "$STATE_DIR"
until pg_isready -h "${PGHOST:-postgres}" -U "${PGUSER}" -d "${PGDATABASE}" >/dev/null 2>&1; do sleep 5; done
pgbackrest --stanza="$STANZA" stanza-create
pgbackrest --stanza="$STANZA" check

while true; do
  TODAY="$(date -u +%Y-%m-%d)"
  HOUR="$(date -u +%H)"
  LAST_BACKUP="$(cat "$STATE_DIR/last-backup-date" 2>/dev/null || true)"
  if [ "$HOUR" = "$(printf '%02d' "$BACKUP_HOUR")" ] && [ "$LAST_BACKUP" != "$TODAY" ]; then
    if [ "$(date -u +%u)" = "$FULL_DAY" ]; then TYPE="full"; else TYPE="diff"; fi
    if pgbackrest --stanza="$STANZA" --type="$TYPE" backup; then
      printf '%s\n' "$TODAY" > "$STATE_DIR/last-backup-date"
      pgbackrest --stanza="$STANZA" check
    fi
  fi
  sleep "$CHECK_INTERVAL"
done
