# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps — tsx is needed for the seeder stage)
RUN npm ci --legacy-peer-deps

# Generate Prisma client including the linux-musl binary for the runner stage
RUN npx prisma generate


# ── Stage 2: Build Next.js app ────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder values let `next build` succeed; real values are supplied at runtime.
ENV DATABASE_URL="file:/tmp/build-placeholder.db"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-placeholder-overridden-at-runtime"

RUN npm run build


# ── Stage 3: Seed the demo database ───────────────────────────────────────────
# Runs db push + seed.ts at build time so the runner needs zero runtime tooling.
FROM node:20-alpine AS seeder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

ENV DATABASE_URL="file:/app/prisma/seed-template.db"

RUN npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss
RUN npx tsx prisma/seed.ts


# ── Stage 4: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Default path — overridden by docker-compose or cloud platform env vars
ENV DATABASE_URL="file:/data/grain.db"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Prisma engine binaries (standalone output may not bundle native .so files)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma

# Pre-seeded SQLite template — copied to /data/grain.db on first container start
COPY --from=seeder --chown=nextjs:nodejs /app/prisma/seed-template.db ./prisma/seed-template.db

# Persistent data directory (mount a volume here in production)
RUN mkdir -p /data && chown nextjs:nodejs /data

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
