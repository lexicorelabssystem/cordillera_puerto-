# ─── BUILD STAGE ───────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend --include=dev

COPY backend/prisma ./backend/prisma
RUN npm --workspace backend run prisma:generate

COPY backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src
RUN npm --workspace backend run build

# ─── PRODUCTION STAGE ──────────────────────────────
FROM node:22-alpine

WORKDIR /app

RUN addgroup -S cordillera && adduser -S cordillera -G cordillera

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY backend/package.json ./

RUN mkdir -p uploads/imports uploads/exports uploads/files && chown -R cordillera:cordillera uploads

USER cordillera

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
