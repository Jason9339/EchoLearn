#!/usr/bin/env node

const { readFileSync } = require('fs');
const postgres = require('postgres');

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

async function checkSchema() {
  let sql;

  try {
    sql = postgres(POSTGRES_URL, { ssl: 'require' });

    console.log('Checking recordings table schema...');
    const recordingsSchema = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'recordings'
      ORDER BY ordinal_position
    `;

    console.log('\nrecordings table:');
    recordingsSchema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });

    console.log('\n\nChecking users table schema...');
    const usersSchema = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;

    console.log('\nusers table:');
    usersSchema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });

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

checkSchema();
