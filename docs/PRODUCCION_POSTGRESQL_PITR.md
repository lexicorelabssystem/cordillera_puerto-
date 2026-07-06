# Produccion: PostgreSQL PITR y recuperacion

## Capas de respaldo

1. `pgBackRest` guarda backups fisicos y WAL cifrados en un proveedor S3 externo.
2. `pg_dump` conserva dumps logicos locales durante 30 dias para recuperaciones selectivas.
3. Git conserva configuracion y migraciones, pero nunca reemplaza el backup de datos.

El bucket PITR debe estar en otro proveedor o cuenta. No usar el MinIO del mismo servidor como unica copia.

## Objetivos

- RPO: hasta 60 segundos, sujeto a conectividad y `archive_timeout`.
- RTO inicial: 30 a 120 minutos, a medir en el simulacro real.
- Completo: domingo a las 02:00 UTC; diferencial: los demas dias a las 02:00 UTC.
- Retencion: 4 completos y 14 diferenciales, mas los WAL requeridos.

## Preparacion

1. Crear un bucket privado externo con versionado y bloqueo contra borrado si esta disponible.
2. Crear credenciales limitadas al prefijo `cordillera/postgresql`.
3. Generar y custodiar `PITR_REPO_CIPHER_PASS` fuera del servidor.
4. Configurar todas las variables `PITR_*` de `.env.example`.
5. Ejecutar `docker compose build postgres` y `docker compose up -d postgres backup`.

Perder `PITR_REPO_CIPHER_PASS` vuelve irrecuperables los backups cifrados.

## Verificacion

```powershell
.\scripts\pitr-check.ps1
docker compose exec -T postgres pgbackrest --stanza=cordillera info
```

Alertar si `failed_count` aumenta, `last_archived_time` queda atrasado o no hay backup reciente.

## Primera copia

```powershell
docker compose exec -T postgres pgbackrest --stanza=cordillera --type=full backup
docker compose exec -T postgres pgbackrest --stanza=cordillera info
```

## Simulacro de restauracion

Nunca ensayar sobre `pgdata`. El script restaura en un volumen aislado:

```powershell
.\scripts\pitr-restore-test.ps1
.\scripts\pitr-restore-test.ps1 -TargetTime "2026-06-28 12:30:00+00"
```

Luego iniciar PostgreSQL temporalmente con ese volumen, sin conexion de la aplicacion, y validar arranque, migraciones y conteos funcionales, ademas del tiempo total. Eliminar solamente el volumen de prueba con:

```powershell
.\scripts\pitr-restore-test.ps1 -DestroyTestVolume
```

## Recuperacion de desastre

1. Bloquear escrituras de API y worker.
2. Preservar el volumen averiado; restaurar primero en uno nuevo.
3. Elegir el ultimo backup o un instante anterior al incidente.
4. Restaurar y validar integridad tecnica y funcional.
5. Promover el volumen nuevo solo tras aprobacion.
6. Levantar PostgreSQL, migraciones controladas, API y worker.
7. Registrar RPO, RTO, causa y evidencias.

La fase no queda validada operacionalmente hasta completar una restauracion real desde el bucket externo. Repetir el simulacro trimestralmente y tras cambios de PostgreSQL, pgBackRest, cifrado o proveedor.
