#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running seed..."
node dist/seed.js || echo "Seed: will retry on next startup"

echo "Starting server..."
exec node dist/server.js
