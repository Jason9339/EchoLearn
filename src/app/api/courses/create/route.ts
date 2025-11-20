import { auth } from '@/auth';
import postgres from 'postgres';
import { getSupabaseAdmin } from '@/app/lib/supabase';
import type { CreateCourseRequest, CreateCourseResponse } from '@/app/lib/definitions';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * Process audio in background by calling the process-audio API
 */
async function processAudioInBackground(courseId: string, audioUrl: string, introSkipSeconds?: number): Promise<void> {
  try {
    // Get the base URL for internal API calls
    const baseUrl =
      // Prefer explicit NextAuth URL in local/dev
      process.env.NEXTAUTH_URL ||
      // Vercel provides the deployment hostname without protocol
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      // Fallback to the current dev server port (default 3000)
      `http://localhost:${process.env.PORT || 3000}`;

    // Call the process-audio API internally
    const response = await fetch(`${baseUrl}/api/courses/process-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add internal API authentication header
        'x-internal-api': 'true',
      },
      body: JSON.stringify({
        courseId,
        audioUrl,
        introSkipSeconds: introSkipSeconds || 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Process audio API failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Background processing completed:', result);
  } catch (error) {
    console.error('Background processing error:', error);
    
    // Update job status to failed
    await sql`
      UPDATE audio_processing_jobs
      SET status = 'failed', error_message = ${String(error)}, updated_at = NOW()
      WHERE course_id = ${courseId}
    `.catch(console.error);

    await sql`
      UPDATE user_courses
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${courseId}
    `.catch(console.error);
  }
}

/**
 * POST /api/courses/create
 * Create a new user course and start processing
 * Accepts JSON: { tempId, title, description, maxSentences }
 * Returns JSON: { success, courseId, jobId }
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();

  let userId = session?.user?.id ?? null;

  if (!userId && session?.user?.email) {
    try {
      const userRecords = await sql<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE email = ${session.user.email}
        LIMIT 1
      `;
      if (userRecords.length > 0) {
        userId = String(userRecords[0].id);
      }
    } catch (lookupError) {
      console.error('[courses/create] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    } as CreateCourseResponse, { status: 401 });
  }

  try {
    const body: CreateCourseRequest = await request.json();
    const { tempId, title, description, maxSentences, introSkipSeconds } = body;

    // Validate input
    if (!tempId || !title || !maxSentences) {
      return Response.json({
        success: false,
        error: 'Missing required fields'
      } as CreateCourseResponse, { status: 400 });
    }

    if (![5, 10, 15, 20, 25, 30].includes(maxSentences)) {
      return Response.json({ 
        success: false, 
        error: 'Invalid maxSentences value' 
      } as CreateCourseResponse, { status: 400 });
    }

    // Get the uploaded audio URL from tempId by directly querying Supabase Storage
    console.log(`[courses/create] Looking for audio file with tempId: ${tempId}`);
    const supabase = getSupabaseAdmin();
    
    // List files in the temp upload directory
    const { data: files, error: listError } = await supabase.storage
      .from('recordings')
      .list(`course-uploads/${tempId}`, {
        limit: 1,
      });

    console.log(`[courses/create] Storage query result:`, { 
      files: files?.length || 0, 
      error: listError?.message,
      path: `course-uploads/${tempId}`
    });

    if (listError || !files || files.length === 0) {
      console.error('Failed to find uploaded audio file:', {
        tempId,
        error: listError,
        filesFound: files?.length || 0
      });
      return Response.json({ 
        success: false, 
        error: `Uploaded audio file not found for tempId: ${tempId}. Please try uploading again.` 
      } as CreateCourseResponse, { status: 404 });
    }

    const file = files[0];
    const storagePath = `course-uploads/${tempId}/${file.name}`;

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // Create user course record
    console.log(`[courses/create] Creating course record for user: ${userId}`);
    let courseResult;
    try {
      courseResult = await sql`
        INSERT INTO user_courses (user_id, title, description, max_sentences, status, original_audio_url)
        VALUES (${userId}, ${title}, ${description || ''}, ${maxSentences}, 'processing', ${audioUrl})
        RETURNING id
      `;
    } catch (dbError) {
      console.error('[courses/create] Database error creating course:', dbError);
      
      // Check if it's a table not found error
      if (dbError instanceof Error && dbError.message.includes('relation "user_courses" does not exist')) {
        return Response.json({ 
          success: false, 
          error: 'Database tables not found. Please run the database migration first. See README for instructions.' 
        } as CreateCourseResponse, { status: 500 });
      }
      
      return Response.json({ 
        success: false, 
        error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` 
      } as CreateCourseResponse, { status: 500 });
    }

    if (courseResult.length === 0) {
      throw new Error('Failed to create course record');
    }

    const courseId = courseResult[0].id;
    console.log(`[courses/create] Created course with ID: ${courseId}`);

    // Create processing job
    console.log(`[courses/create] Creating processing job for course: ${courseId}`);
    let jobResult;
    try {
      jobResult = await sql`
        INSERT INTO audio_processing_jobs (user_id, course_id, audio_url, status, progress)
        VALUES (${userId}, ${courseId}, ${audioUrl}, 'pending', 0)
        RETURNING id
      `;
    } catch (dbError) {
      console.error('[courses/create] Database error creating job:', dbError);
      return Response.json({ 
        success: false, 
        error: `Failed to create processing job: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` 
      } as CreateCourseResponse, { status: 500 });
    }

    if (jobResult.length === 0) {
      throw new Error('Failed to create processing job');
    }

    const jobId = jobResult[0].id;
    console.log(`[courses/create] Created processing job with ID: ${jobId}`);

    // Trigger background processing immediately
    console.log(`Created course ${courseId} with job ${jobId} for user ${userId}`);

    // Start processing in the background (don't wait for completion)
    processAudioInBackground(String(courseId), audioUrl, introSkipSeconds).catch(error => {
      console.error('Background processing failed:', error);
    });

    return Response.json({
      success: true,
      courseId: String(courseId),
      jobId: String(jobId),
    } as CreateCourseResponse);

  } catch (error) {
    console.error('Course creation error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    } as CreateCourseResponse, { status: 500 });
  }
}
