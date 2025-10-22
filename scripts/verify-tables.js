#!/usr/bin/env node

/**
 * Verify database tables
 */

const { readFileSync } = require('fs');
const postgres = require('postgres');

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

async function verifyTables() {
  let sql;

  try {
    sql = postgres(POSTGRES_URL, { ssl: 'require' });

    console.log('Checking ratings table...');
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ratings'
      ORDER BY ordinal_position
    `;

    if (result.length === 0) {
      console.log('✗ ratings table does not exist');
    } else {
      console.log('✓ ratings table exists with columns:');
      result.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

verifyTables();
