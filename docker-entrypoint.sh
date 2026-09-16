#!/bin/sh
set -e

echo "=== Conference Intelligence ==="

# Extract file path from DATABASE_URL (strips the "file:" prefix)
DB_FILE="${DATABASE_URL#file:}"

# Resolve to absolute path (handles both file:/abs and file:./rel)
case "$DB_FILE" in
  /*) DB_PATH="$DB_FILE" ;;
  *)  DB_PATH="/app/$DB_FILE" ;;
esac

VERSION_PATH="${DB_PATH%.db}.version"
TEMPLATE_VERSION=$(cat /app/prisma/seed-template.version 2>/dev/null || echo "unknown")
CURRENT_VERSION=$(cat "$VERSION_PATH" 2>/dev/null || echo "")

if [ ! -f "$DB_PATH" ]; then
  echo "No database found — loading demo database (schema v${TEMPLATE_VERSION})..."
  mkdir -p "$(dirname "$DB_PATH")"
  cp /app/prisma/seed-template.db "$DB_PATH"
  echo "$TEMPLATE_VERSION" > "$VERSION_PATH"
  echo "Demo data ready."
elif [ "$TEMPLATE_VERSION" != "$CURRENT_VERSION" ]; then
  echo "Schema updated (${CURRENT_VERSION} → ${TEMPLATE_VERSION}) — resetting demo database..."
  cp /app/prisma/seed-template.db "$DB_PATH"
  echo "$TEMPLATE_VERSION" > "$VERSION_PATH"
  echo "Demo data reset."
elif ! sqlite3 "$DB_PATH" "SELECT 1 FROM User LIMIT 1;" 2>/dev/null | grep -q 1; then
  echo "Database is empty — loading demo database (schema v${TEMPLATE_VERSION})..."
  cp /app/prisma/seed-template.db "$DB_PATH"
  echo "$TEMPLATE_VERSION" > "$VERSION_PATH"
  echo "Demo data ready."
else
  echo "Database up to date (schema v${TEMPLATE_VERSION})."
fi

echo "Starting server on port ${PORT:-3000}..."
exec node server.js
