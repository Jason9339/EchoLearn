#!/bin/bash

# Script to run database migrations
# Usage: ./scripts/run-migration.sh migrations/create_ratings_table.sql

if [ -z "$1" ]; then
  echo "Usage: $0 <migration-file>"
  echo "Example: $0 migrations/create_ratings_table.sql"
  exit 1
fi

MIGRATION_FILE=$1

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Migration file '$MIGRATION_FILE' not found"
  exit 1
fi

if [ -z "$POSTGRES_URL" ]; then
  echo "Error: POSTGRES_URL environment variable is not set"
  echo "Please set it in your .env.local file or export it"
  exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "---"

psql "$POSTGRES_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo "---"
  echo "Migration completed successfully!"
else
  echo "---"
  echo "Migration failed!"
  exit 1
fi
