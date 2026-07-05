# Estrategia de Rollback de Migraciones

## Principio general

Prisma no genera automáticamente migraciones "down". Cada migración es irreversible por sí sola.  
La estrategia recomendada es **forward-only**: si una migración sale mal, se crea una nueva migración que corrija el estado, en vez de revertir.

## Cuándo aplicar cada enfoque

| Escenario | Enfoque |
|---|---|
| Migración aún no aplicada en producción | Borrar carpeta de migración y recrear |
| Migración ya aplicada en staging/testing | `prisma migrate reset` (pierde datos) o forward fix |
| Migración ya aplicada en producción | **Solo forward fix** — nueva migración correctiva |
| Error en datos (no esquema) | Script manual de corrección, nunca rollback de esquema |

## Procedimiento Forward Fix

1. Identificar el problema en la migración fallida
2. Crear una nueva migración con `prisma migrate dev --create-only`
3. Editar el SQL para deshacer o corregir el cambio
4. Aplicar con `prisma migrate deploy`
5. Verificar estado con `prisma migrate status`

Ejemplo: Si una migración creó una columna con tipo incorrecto:
```sql
-- Nueva migración forward-fix:
ALTER TABLE ejemplo ALTER COLUMN columna TYPE integer USING columna::integer;
```

## Rollback local (solo desarrollo)

```bash
# Opción 1: Resetear toda la BD (pierde datos)
npm run db:reset

# Opción 2: Retroceder a una migración específica (requiere BD limpia)
npx prisma migrate reset --force
# Luego eliminar las carpetas de migraciones no deseadas

# Opción 3: Marcar migración como fallida sin aplicarla
npx prisma migrate resolve --applied MIGRATION_NAME_QUE_SI_APLICO
npx prisma migrate resolve --rolled-back MIGRATION_NAME_A_DESHACER
```

## Migraciones con NOT VALID

Las migraciones que usan `NOT VALID` + `VALIDATE CONSTRAINT` (como las de esta base de código) no bloquean la tabla. Si `VALIDATE CONSTRAINT` falla porque hay datos inválidos, se puede:

1. Corregir los datos inválidos
2. Ejecutar `ALTER TABLE ... VALIDATE CONSTRAINT nombre` manualmente

## Restricciones

- **Nunca** editar una migración ya aplicada en producción
- **Nunca** borrar carpetas de migración de producción
- **Siempre** probar migraciones en staging primero
- **Siempre** hacer backup antes de `prisma migrate deploy` en producción:  
  `pg_dump cordillera_dev > backup_$(date +%Y%m%d_%H%M%S).sql`
