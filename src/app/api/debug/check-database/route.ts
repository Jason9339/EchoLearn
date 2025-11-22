import { auth } from '@/auth';
import sql from '@/lib/postgres';

/**
 * GET /api/debug/check-database
 * Check if required database tables exist
 */
type TableCheck = { exists: boolean; error: string | null };
type CheckResults = {
  tables: Record<string, TableCheck>;
  environment: {
    postgresUrl: boolean;
    supabaseUrl: boolean;
    supabaseServiceKey: boolean;
  };
};

export async function GET(_request: Request): Promise<Response> {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    const results: CheckResults = {
      tables: {},
      environment: {
        postgresUrl: !!process.env.POSTGRES_URL,
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    };

    // Check existing tables
    const existingTables = ['users', 'recordings', 'ratings'];
    for (const tableName of existingTables) {
      try {
        await sql`SELECT 1 FROM ${sql(tableName)} LIMIT 1`;
        results.tables[tableName] = { exists: true, error: null };
      } catch (error) {
        results.tables[tableName] = { 
          exists: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    // Check new tables
    const newTables = ['user_courses', 'course_sentences', 'audio_processing_jobs'];
    for (const tableName of newTables) {
      try {
        await sql`SELECT 1 FROM ${sql(tableName)} LIMIT 1`;
        results.tables[tableName] = { exists: true, error: null };
      } catch (error) {
        results.tables[tableName] = { 
          exists: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    // Check if migration is needed
    const migrationNeeded = newTables.some(table => !results.tables[table]?.exists);

    return Response.json({
      success: true,
      ...results,
      migrationNeeded,
      recommendation: migrationNeeded 
        ? 'Run database migration: Execute the SQL from migrations/create_user_courses_tables.sql in your Supabase SQL editor'
        : 'All tables exist, database is ready'
    });

  } catch (error) {
    console.error('Database check error:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'Check your database connection and environment variables'
    }, { status: 500 });
  }
}
