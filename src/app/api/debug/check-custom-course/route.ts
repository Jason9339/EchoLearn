import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * GET /api/debug/check-custom-course
 * Debug API to check custom course data and audio URLs
 */
export async function GET(request: Request): Promise<Response> {
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
      console.error('[debug/check-custom-course] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if recordings table has course_id column
    let recordingsTableStructure = null;
    try {
      const tableInfo = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'recordings' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      recordingsTableStructure = tableInfo.map(col => ({
        columnName: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable,
      }));
    } catch (error) {
      console.error('Failed to get recordings table structure:', error);
    }

    // Check user courses
    const userCourses = await sql`
      SELECT 
        id,
        title,
        status,
        created_at as "createdAt"
      FROM user_courses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    // Check course sentences for the latest course
    let courseSentences = [];
    if (userCourses.length > 0) {
      const latestCourseId = userCourses[0].id;
      courseSentences = await sql`
        SELECT 
          sentence_id as "sentenceId",
          text,
          audio_url as "audioUrl",
          start_time as "startTime",
          end_time as "endTime"
        FROM course_sentences
        WHERE course_id = ${latestCourseId}
        ORDER BY sentence_id ASC
      `;
    }

    // Check processing jobs
    const processingJobs = await sql`
      SELECT 
        course_id as "courseId",
        status,
        progress,
        error_message as "errorMessage",
        created_at as "createdAt"
      FROM audio_processing_jobs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    // Check recordings for custom courses
    let customCourseRecordings = [];
    if (userCourses.length > 0) {
      try {
        const latestCourseId = userCourses[0].id;
        customCourseRecordings = await sql`
          SELECT 
            id,
            course_id as "courseId",
            sentence_id as "sentenceId",
            slot_index as "slotIndex",
            audio_url as "audioUrl"
          FROM recordings
          WHERE course_id = ${latestCourseId}
          ORDER BY sentence_id, slot_index
          LIMIT 10
        `;
      } catch (error) {
        console.error('Failed to query recordings with course_id:', error);
      }
    }

    return Response.json({
      success: true,
      debug: {
        userId,
        recordingsTableStructure,
        userCoursesCount: userCourses.length,
        userCourses: userCourses.map(course => ({
          id: String(course.id),
          title: String(course.title),
          status: course.status,
          createdAt: String(course.createdAt),
        })),
        courseSentences: courseSentences.map(sentence => ({
          sentenceId: sentence.sentenceId,
          text: String(sentence.text),
          audioUrl: sentence.audioUrl ? String(sentence.audioUrl) : null,
          startTime: sentence.startTime,
          endTime: sentence.endTime,
        })),
        processingJobs: processingJobs.map(job => ({
          courseId: String(job.courseId),
          status: job.status,
          progress: job.progress,
          errorMessage: job.errorMessage ? String(job.errorMessage) : null,
          createdAt: String(job.createdAt),
        })),
        customCourseRecordings: customCourseRecordings.map(rec => ({
          id: String(rec.id),
          courseId: String(rec.courseId),
          sentenceId: rec.sentenceId,
          slotIndex: rec.slotIndex,
          audioUrl: String(rec.audioUrl),
        })),
      },
    });

  } catch (error) {
    console.error('[debug/check-custom-course] Database error:', error);
    return Response.json({ 
      success: false, 
      error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
