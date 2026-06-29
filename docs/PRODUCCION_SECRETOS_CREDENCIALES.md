# Fase 2 - Secretos y credenciales antes de produccion

## Estado aplicado

- El backend valida variables de entorno al arrancar.
- En `NODE_ENV=production` se rechazan secretos placeholder o defaults debiles.
- `ENABLE_DEMO_SEED=true` queda bloqueado en produccion.
- `COOKIE_SECRET`, `FRONTEND_URL`, `REDIS_URL` y `CORS_ORIGINS` exactos son obligatorios en produccion.
- `BCRYPT_ROUNDS` debe ser al menos 12 en produccion.
- MinIO requiere credenciales fuertes en produccion.
- Los seeds demo quedan bloqueados en produccion salvo `ALLOW_DEMO_SEED=true`, pensado solo para staging controlado.
- Los scripts de reset no imprimen claves temporales completas.

## Credenciales que se deben regenerar

Regenerar antes de publicar:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`
- `PGADMIN_DEFAULT_PASSWORD` si se usa el perfil dev
- `SMTP_USER`
- `SMTP_PASS`
- `IMPORTED_STUDENT_TEMP_PASSWORD` y `IMPORTED_TEACHER_TEMP_PASSWORD` si se importaran usuarios
- Claves temporales usadas en importaciones o reseteos de alumnos
- Cualquier usuario demo/admin creado durante pruebas

## Politica de seeds

No ejecutar seeds demo sobre produccion real.

Permitido:

- Desarrollo local.
- Staging aislado y desechable.
- Ambientes de carga con datos ficticios.

Bloqueado:

- Base productiva real.
- Ambientes con datos reales de alumnos.

## Checklist antes de arrancar produccion

- `NODE_ENV=production`.
- `ENABLE_DEMO_SEED=false`.
- `ALLOW_DEMO_SEED` no definido.
- `CORS_ORIGINS` contiene solo dominios exactos autorizados.
- `FRONTEND_URL` apunta al frontend publicado.
- `JWT_SECRET` y `COOKIE_SECRET` son distintos y largos.
- SMTP esta configurado solo cuando `NOTIFICATION_EMAILS_ENABLED=true`.
- No hay credenciales reales en Git.
- Los usuarios creados por demo fueron eliminados o se forzo cambio de clave.
