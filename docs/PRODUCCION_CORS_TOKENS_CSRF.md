# Fase 3 - CORS exacto, tokens y CSRF

## Estado aplicado

- CORS y CSRF usan la misma lista de origenes permitidos.
- En produccion no se aceptan comodines como `*` o `*.vercel.app`.
- Los dominios temporales de Vercel deben agregarse completos y exactos en `CORS_ORIGINS` y `FRONTEND_URL`.
- CSRF bloquea metodos mutantes en produccion si no traen `Origin` ni `Referer`.
- El refresh token se entrega por cookie httpOnly y ya no se persiste en `localStorage` del frontend.
- El backend no expone el refresh token por defecto en la respuesta JSON del controller.

## Configuracion para Vercel temporal

Ejemplo:

```env
FRONTEND_URL=https://mi-proyecto-temporal.vercel.app
CORS_ORIGINS=https://mi-proyecto-temporal.vercel.app
```

Si existe preview o dominio adicional, agregarlo exacto separado por coma:

```env
CORS_ORIGINS=https://mi-proyecto-temporal.vercel.app,https://preview-exacto.vercel.app
```

No usar:

```env
CORS_ORIGINS=*.vercel.app
CORS_ORIGINS=*
```

## Configuracion para dominio definitivo

Cuando `educacor.cl` quede listo:

```env
FRONTEND_URL=https://app.educacor.cl
CORS_ORIGINS=https://app.educacor.cl
```

Si el backend queda en subdominio propio, configurar `VITE_API_BASE_URL` en Vercel:

```env
VITE_API_BASE_URL=https://api.educacor.cl/api/v1
```

## Politica de tokens

- Access token: cookie httpOnly + memoria del frontend durante la sesion activa.
- Refresh token: cookie httpOnly, rotado en cada refresh y revocado al logout/cambio de clave.
- No guardar refresh token en `localStorage`.
- No imprimir tokens en logs.

## Checklist antes de publicar

- `CORS_ORIGINS` no contiene `localhost` en produccion.
- `CORS_ORIGINS` no contiene `*` ni `*.`.
- `FRONTEND_URL` coincide con el dominio real del frontend.
- Frontend usa `credentials: include`.
- Cookies se envian con `httpOnly`, `secure` y `sameSite=none` en produccion.
- Login, refresh, logout y cambio de clave funcionan desde el dominio exacto configurado.
