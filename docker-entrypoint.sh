#!/bin/sh
set -e

echo "=== Grain Finance Intelligence ==="

# Extract file path from DATABASE_URL (strips the "file:" prefix)
DB_FILE="${DATABASE_URL#file:}"

# Resolve to absolute path (handles both file:/abs and file:./rel)
case "$DB_FILE" in
  /*) DB_PATH="$DB_FILE" ;;
  *)  DB_PATH="/app/$DB_FILE" ;;
esac

if [ ! -f "$DB_PATH" ]; then
  echo "First run — loading demo database..."
  mkdir -p "$(dirname "$DB_PATH")"
  cp /app/prisma/seed-template.db "$DB_PATH"
  echo "Demo data ready."
else
  echo "Database found at $DB_PATH"
fi

echo "Starting server on port ${PORT:-3000}..."
exec node server.js
