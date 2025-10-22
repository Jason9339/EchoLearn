import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * GET /api/peer-review/[userId]/courses
 * Get courses for a specific user with their recording statistics
 * Returns JSON: { success, userName, courses: [{ courseId, courseName, recordingCount, ratedByMeCount }] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const session = await auth();

  let currentUserId = session?.user?.id ?? null;

  if (!currentUserId && session?.user?.email) {
    try {
      const fallback = await sql<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE email = ${session.user.email}
        LIMIT 1
      `;
      if (fallback.length > 0) {
        currentUserId = String(fallback[0].id);
      }
    } catch (lookupError) {
      console.error('[peer-review/courses] failed to lookup user id by email', lookupError);
    }
  }

  if (!currentUserId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId: targetUserId } = await params;
    const normalizedCurrentUserId = String(currentUserId);

    // Get user information
    const userInfo = await sql`
      SELECT name, email
      FROM users
      WHERE id::text = ${targetUserId}
      LIMIT 1
    `;

    if (userInfo.length === 0) {
      return Response.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Query recording statistics grouped by course_id
    const courseStats = await sql`
      SELECT
        r.course_id as "courseId",
        COUNT(DISTINCT r.id) as "recordingCount",
        COUNT(DISTINCT rat.id) FILTER (WHERE rat.rater_user_id::text = ${normalizedCurrentUserId}) as "ratedByMeCount"
      FROM recordings r
      LEFT JOIN ratings rat ON rat.recording_id = r.id
      WHERE r.user_id::text = ${targetUserId}
      GROUP BY r.course_id
      ORDER BY r.course_id
    `;

    // Map course IDs to course names
    const courseNameMap: Record<string, string> = {
      'shadowing-101': 'Shadowing Man',
      'daily-practice': 'Shadowing Women',
    };

    const courses = courseStats.map(stat => ({
      courseId: String(stat.courseId),
      courseName: courseNameMap[String(stat.courseId)] || `Course ${stat.courseId}`,
      recordingCount: parseInt(String(stat.recordingCount)) || 0,
      ratedByMeCount: parseInt(String(stat.ratedByMeCount)) || 0,
    }));

    return Response.json({
      success: true,
      userName: userInfo[0].name || 'Unknown User',
      userEmail: userInfo[0].email,
      courses,
    });
  } catch (e) {
    console.error('Get user courses error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
