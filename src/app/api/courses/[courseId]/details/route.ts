import { auth } from '@/auth';
import sql from '@/lib/postgres';
import type { UserCourse } from '@/app/lib/definitions';

/**
 * GET /api/courses/[courseId]/details
 * Get detailed information about a user-created course.
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
      console.error('[courses/details] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    console.error('[courses/details] unauthorized session', session);
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedUserId = String(userId);

  try {
    const { courseId } = await params;

    // Fetch course details
    const courseDetails = await sql<UserCourse[]>`
      SELECT
        id,
        user_id AS "userId",
        title,
        description,
        max_sentences AS "maxSentences",
        status,
        original_audio_url AS "originalAudioUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_courses
      WHERE id = ${courseId} AND user_id = ${normalizedUserId}
      LIMIT 1
    `;

    if (courseDetails.length === 0) {
      return Response.json({ success: false, error: 'Course not found or unauthorized' }, { status: 404 });
    }

    const course = courseDetails[0];

    return Response.json({
      success: true,
      course: {
        id: String(course.id),
        userId: String(course.userId),
        title: String(course.title),
        description: String(course.description),
        maxSentences: parseInt(String(course.maxSentences)),
        status: course.status as 'processing' | 'completed' | 'failed',
        originalAudioUrl: course.originalAudioUrl ? String(course.originalAudioUrl) : undefined,
        createdAt: String(course.createdAt),
        updatedAt: String(course.updatedAt),
      },
    });

  } catch (error) {
    console.error('Get course details error:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
