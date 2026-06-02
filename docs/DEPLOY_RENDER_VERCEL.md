# Deploy Render + Vercel

## 1. Backend y base de datos en Render

Opcion recomendada: usar Blueprint con `render.yaml`.

1. En Render, crear un nuevo Blueprint desde este repositorio.
2. Render creara:
   - `cordillera-db` como PostgreSQL.
   - `cordillera-backend` como Web Service Docker.
3. En el servicio `cordillera-backend`, completar estas variables cuando tengas la URL de Vercel:
   - `CORS_ORIGINS=https://TU-FRONTEND.vercel.app`
   - `FRONTEND_URL=https://TU-FRONTEND.vercel.app`

El backend queda disponible normalmente como:

```txt
https://cordillera-backend.onrender.com
```

Health check:

```txt
https://cordillera-backend.onrender.com/health
```

## 2. Frontend en Vercel

Crear un proyecto de Vercel apuntando al mismo repositorio.

Configuracion recomendada si el proyecto usa la raiz del repo:

```txt
Framework Preset: Vite
Root Directory: .
Install Command: npm install --include=dev
Build Command: npm run build:shared && npm run build:frontend
Output Directory: frontend/dist
```

Variable obligatoria en Vercel:

```txt
VITE_API_BASE_URL=https://cordillera-backend.onrender.com/api/v1
```

Si Vercel se configura con `Root Directory: frontend`, usar:

```txt
Install Command: npm install --include=dev
Build Command: npm run build
Output Directory: dist
```

En ese caso hay que asegurarse de que `shared` no sea requerido por imports del frontend durante build.

## 3. Despues del primer deploy

Cuando Vercel entregue la URL real del frontend, volver a Render y actualizar:

```txt
CORS_ORIGINS=https://TU-FRONTEND.vercel.app
FRONTEND_URL=https://TU-FRONTEND.vercel.app
```

Luego reiniciar el servicio backend.

## 4. Errores comunes

- Si Vercel muestra deploy rojo, revisar que el proyecto use la raiz del repo o que los comandos coincidan con la carpeta elegida.
- Si el frontend abre pero no inicia sesion, revisar `VITE_API_BASE_URL` en Vercel y `CORS_ORIGINS` en Render.
- Si Render falla construyendo Docker, verificar que el servicio use `Dockerfile Path: backend/Dockerfile` y que el contexto sea la raiz del repositorio.
- Si Render inicia pero no hay tablas, revisar logs de `prisma migrate deploy`.
