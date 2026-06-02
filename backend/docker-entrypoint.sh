#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED_ON_STARTUP" = "true" ]; then
  echo "Running seed..."
  node dist/seed.js || echo "Seed: will retry on next startup"
else
  echo "Skipping seed (set RUN_SEED_ON_STARTUP=true to enable)"
fi

echo "Starting server..."
exec node dist/server.js
