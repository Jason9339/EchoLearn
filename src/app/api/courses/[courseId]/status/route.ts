import { auth } from '@/auth';
import postgres from 'postgres';
import type { CourseStatusResponse, CourseSentence } from '@/app/lib/definitions';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * GET /api/courses/[courseId]/status
 * Get course processing status and sentences
 * Returns JSON: { success, status, progress, errorMessage, sentences }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
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
      console.error('[courses/status] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    } as CourseStatusResponse, { status: 401 });
  }

  try {
    const { courseId } = await params;

    // Get course information and verify ownership
    const courseResult = await sql`
      SELECT 
        uc.status,
        uc.title,
        uc.description,
        apj.progress,
        apj.error_message as "errorMessage"
      FROM user_courses uc
      LEFT JOIN audio_processing_jobs apj ON apj.course_id = uc.id
      WHERE uc.id = ${courseId} AND uc.user_id = ${userId}
      LIMIT 1
    `;

    if (courseResult.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Course not found' 
      } as CourseStatusResponse, { status: 404 });
    }

    const course = courseResult[0];
    const status = course.status as 'processing' | 'completed' | 'failed';
    const progress = parseInt(String(course.progress)) || 0;
    const errorMessage = course.errorMessage || undefined;

    // If course is completed, get sentences
    let sentences: CourseSentence[] = [];
    if (status === 'completed') {
      const sentenceResult = await sql`
        SELECT 
          id,
          course_id as "courseId",
          sentence_id as "sentenceId",
          text,
          audio_url as "audioUrl",
          start_time as "startTime",
          end_time as "endTime",
          created_at as "createdAt"
        FROM course_sentences
        WHERE course_id = ${courseId}
        ORDER BY sentence_id ASC
      `;

      sentences = sentenceResult.map(row => ({
        id: String(row.id),
        courseId: String(row.courseId),
        sentenceId: parseInt(String(row.sentenceId)),
        text: String(row.text),
        audioUrl: row.audioUrl ? String(row.audioUrl) : undefined,
        startTime: row.startTime ? parseFloat(String(row.startTime)) : undefined,
        endTime: row.endTime ? parseFloat(String(row.endTime)) : undefined,
        createdAt: String(row.createdAt),
      }));
    }

    return Response.json({
      success: true,
      status,
      progress,
      errorMessage,
      sentences: sentences.length > 0 ? sentences : undefined,
    } as CourseStatusResponse);

  } catch (error) {
    console.error('Course status error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    } as CourseStatusResponse, { status: 500 });
  }
}
