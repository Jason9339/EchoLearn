import { auth } from '@/auth';
import sql from '@/lib/postgres';
import { courses as builtInCourses } from '@/app/lib/placeholder-data';
import type { Course, UserCourse } from '@/app/lib/definitions';

/**
 * GET /api/courses/user
 * Get all courses (built-in + user custom courses)
 * Returns JSON: { success, courses: { builtIn, custom } }
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
      console.error('[courses/user] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    // Get user's custom courses
    const customCoursesResult = await sql`
      SELECT 
        id,
        user_id as "userId",
        title,
        description,
        max_sentences as "maxSentences",
        status,
        original_audio_url as "originalAudioUrl",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_courses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    const customCourses: UserCourse[] = customCoursesResult.map(row => ({
      id: String(row.id),
      userId: String(row.userId),
      title: String(row.title),
      description: String(row.description),
      maxSentences: parseInt(String(row.maxSentences)),
      status: row.status as 'processing' | 'completed' | 'failed',
      originalAudioUrl: row.originalAudioUrl ? String(row.originalAudioUrl) : undefined,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));

    return Response.json({
      success: true,
      courses: {
        builtIn: builtInCourses,
        custom: customCourses,
      },
    });

  } catch (error) {
    console.error('Get user courses error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
