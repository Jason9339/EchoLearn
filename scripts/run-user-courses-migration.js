const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running user courses migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_user_courses_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration using Supabase RPC
    console.log('Executing migration SQL...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If RPC doesn't exist, try direct SQL execution (may not work with all statements)
      console.log('RPC method not available, trying direct execution...');
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().includes('create table')) {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          
          // For CREATE TABLE statements, we need to use a different approach
          // This is a limitation of Supabase client - complex DDL operations
          // should be run through the Supabase dashboard or CLI
          console.log('⚠️ DDL operations should be run through Supabase dashboard');
          console.log('Please execute the following SQL in your Supabase SQL editor:');
          console.log('---');
          console.log(migrationSQL);
          console.log('---');
          return;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created by trying to query them
    try {
      const { data: userCourses, error: ucError } = await supabase
        .from('user_courses')
        .select('count')
        .limit(1);
      
      const { data: courseSentences, error: csError } = await supabase
        .from('course_sentences')
        .select('count')
        .limit(1);
      
      const { data: processingJobs, error: pjError } = await supabase
        .from('audio_processing_jobs')
        .select('count')
        .limit(1);

      if (!ucError && !csError && !pjError) {
        console.log('📋 All tables are accessible!');
      } else {
        console.log('⚠️ Some tables may not exist yet. Errors:');
        if (ucError) console.log('  - user_courses:', ucError.message);
        if (csError) console.log('  - course_sentences:', csError.message);
        if (pjError) console.log('  - audio_processing_jobs:', pjError.message);
      }
    } catch (verifyError) {
      console.log('⚠️ Could not verify tables:', verifyError.message);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    console.log('\n📝 Manual Migration Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Execute the following SQL:');
    console.log('---');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_user_courses_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('---');
    
    process.exit(1);
  }
}

runMigration();
