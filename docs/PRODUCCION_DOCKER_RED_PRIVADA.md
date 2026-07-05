# Produccion: Docker, firewall y red privada

## Objetivo

La configuracion de Docker debe evitar que servicios internos queden expuestos a Internet. La entrada publica debe ser el proxy HTTP/HTTPS definido para produccion. Base de datos, Redis, MinIO y paneles de administracion deben quedar detras de red privada o enlazados solo a localhost.

## Red Docker

`docker-compose.yml` separa dos redes:

- `cordillera-public`: red para servicios que necesitan salida o entrada controlada por proxy.
- `cordillera-private`: red interna para comunicacion entre API, worker, PostgreSQL, Redis, MinIO, backup y observabilidad.

Servicios internos en red privada:

- PostgreSQL
- Redis
- MinIO
- Prometheus
- Grafana
- node-exporter
- backup
- pgAdmin, solo con profile `dev`

Servicios con entrada publica/controlada:

- `nginx`, por defecto en `0.0.0.0:80`.
- `backend`, por defecto enlazado a `127.0.0.1:4000` para que lo publique un reverse proxy o plataforma como Coolify.

## Puertos por defecto

Puertos enlazados a localhost:

- PostgreSQL: `127.0.0.1:5433`
- Backend: `127.0.0.1:4000`
- Redis: `127.0.0.1:6379`
- MinIO API: `127.0.0.1:9000`
- MinIO Console: `127.0.0.1:9001`
- Prometheus: `127.0.0.1:9090`
- Grafana: `127.0.0.1:3001`
- pgAdmin: `127.0.0.1:5050`, solo profile `dev`

Puerto publico por defecto:

- Nginx: `0.0.0.0:80`

## Variables de control

Se pueden ajustar en `.env`:

```env
NGINX_BIND_ADDRESS=0.0.0.0
NGINX_PORT=80
BACKEND_BIND_ADDRESS=127.0.0.1
BACKEND_HOST_PORT=4000
POSTGRES_BIND_ADDRESS=127.0.0.1
POSTGRES_HOST_PORT=5433
REDIS_BIND_ADDRESS=127.0.0.1
REDIS_HOST_PORT=6379
MINIO_BIND_ADDRESS=127.0.0.1
MINIO_API_HOST_PORT=9000
MINIO_CONSOLE_HOST_PORT=9001
PROMETHEUS_BIND_ADDRESS=127.0.0.1
PROMETHEUS_HOST_PORT=9090
GRAFANA_BIND_ADDRESS=127.0.0.1
GRAFANA_HOST_PORT=3001
PGADMIN_BIND_ADDRESS=127.0.0.1
PGADMIN_HOST_PORT=5050
```

## Reglas recomendadas de firewall

Antes de produccion:

- Permitir `80/tcp` y `443/tcp` desde Internet hacia el reverse proxy.
- Bloquear desde Internet: `5432`, `5433`, `6379`, `9000`, `9001`, `9090`, `3000`, `3001`, `5050`.
- Permitir SSH solo desde IPs confiables o VPN.
- Acceder a Grafana, Prometheus, MinIO Console y pgAdmin por VPN, tunel SSH o panel protegido de la plataforma.

## Vercel temporal

Si el frontend queda temporalmente en Vercel:

- `FRONTEND_URL` debe ser exactamente la URL de Vercel.
- `CORS_ORIGINS` debe incluir exactamente esa URL.
- `VITE_API_BASE_URL` debe apuntar a la URL publica del backend o proxy.
- No usar `*.vercel.app`.

## Checklist antes de publicar

1. Ejecutar `docker compose config`.
2. Confirmar que PostgreSQL, Redis, MinIO, Prometheus, Grafana y pgAdmin no esten publicados en `0.0.0.0`.
3. Confirmar que `BACKEND_BIND_ADDRESS=127.0.0.1` si se usa proxy local/Coolify.
4. Confirmar que solo el proxy publico escucha `80/443`.
5. Confirmar reglas de firewall externas.
6. Probar login, refresh de sesion, guardado de respuestas, worker y backup.
