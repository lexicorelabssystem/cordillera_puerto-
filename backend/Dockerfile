# ─── BUILD STAGE ───────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

# ─── PRODUCTION STAGE ──────────────────────────────
FROM node:22-alpine

WORKDIR /app

RUN addgroup -S cordillera && adduser -S cordillera -G cordillera

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY backend/package.json ./

RUN mkdir -p uploads/imports uploads/exports uploads/files && chown -R cordillera:cordillera uploads

USER cordillera

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
