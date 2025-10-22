#!/usr/bin/env node

/**
 * Database migration runner
 * Usage: node scripts/run-migration.js migrations/create_ratings_table.sql
 */

const { readFileSync } = require('fs');
const postgres = require('postgres');

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  console.error('Example: node scripts/run-migration.js migrations/create_ratings_table.sql');
  process.exit(1);
}

// Load environment variables from .env file manually
function loadEnv() {
  try {
    const envFile = readFileSync('.env', 'utf8');
    const lines = envFile.split('\n');
    const env = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    }
    return env;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const POSTGRES_URL = env.POSTGRES_URL || process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error('Error: POSTGRES_URL environment variable is not set');
  console.error('Please set it in your .env file');
  process.exit(1);
}

async function runMigration() {
  let sql;

  try {
    // Read migration file
    console.log(`Reading migration file: ${migrationFile}`);
    const migrationSQL = readFileSync(migrationFile, 'utf8');

    // Connect to database
    console.log('Connecting to database...');
    sql = postgres(POSTGRES_URL, { ssl: 'require' });

    // Run migration
    console.log('Running migration...');
    console.log('---');

    await sql.unsafe(migrationSQL);

    console.log('---');
    console.log('✓ Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('---');
    console.error('✗ Migration failed!');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

runMigration();
