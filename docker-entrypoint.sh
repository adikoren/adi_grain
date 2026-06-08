#!/bin/sh
set -e

echo "🌾 Grain Finance Intelligence Tool"
echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || \
  npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

# Seed only if DB is empty (check for admin user)
USER_COUNT=$(npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'EOF'
SELECT COUNT(*) as count FROM "User";
EOF
2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "Seeding initial data..."
  node prisma/seed.js 2>/dev/null || echo "Seed skipped (compile seed manually if needed)"
fi

echo "Starting server on port ${PORT:-3000}..."
exec node server.js
