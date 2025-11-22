import { auth } from '@/auth';
import sql from '@/lib/postgres';

/**
 * GET /api/peer-review/users
 * Get list of users with their recording statistics
 * Query params: search (optional)
 * Returns JSON: { success, users: [{ id, name, email, recordingCount, ratedByMeCount }] }
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();

  let userId = session?.user?.id ?? null;

  if (!userId && session?.user?.email) {
    try {
      const fallback = await sql<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE email = ${session.user.email}
        LIMIT 1
      `;
      if (fallback.length > 0) {
        userId = String(fallback[0].id);
      }
    } catch (lookupError) {
      console.error('[peer-review/users] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const normalizedUserId = String(userId);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Build query to get users with their recording counts and ratings
    let users;

    if (search) {
      // Search by name or email
      users = await sql`
        SELECT
          u.id::text,
          u.name,
          u.email,
          COUNT(DISTINCT r.id) as "recordingCount",
          COUNT(DISTINCT rat.id) FILTER (WHERE rat.rater_user_id::text = ${normalizedUserId}) as "ratedByMeCount"
        FROM users u
        LEFT JOIN recordings r ON r.user_id = u.id
        LEFT JOIN ratings rat ON rat.recording_id = r.id
        WHERE u.id::text != ${normalizedUserId}
          AND (u.name ILIKE ${`%${search}%`} OR u.email ILIKE ${`%${search}%`})
        GROUP BY u.id, u.name, u.email
        ORDER BY u.name
      `;
    } else {
      // Get all users except current user
      users = await sql`
        SELECT
          u.id::text,
          u.name,
          u.email,
          COUNT(DISTINCT r.id) as "recordingCount",
          COUNT(DISTINCT rat.id) FILTER (WHERE rat.rater_user_id::text = ${normalizedUserId}) as "ratedByMeCount"
        FROM users u
        LEFT JOIN recordings r ON r.user_id = u.id
        LEFT JOIN ratings rat ON rat.recording_id = r.id
        WHERE u.id::text != ${normalizedUserId}
        GROUP BY u.id, u.name, u.email
        ORDER BY u.name
      `;
    }

    return Response.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: user.name || 'Unknown User',
        email: user.email,
        recordingCount: parseInt(String(user.recordingCount)) || 0,
        ratedByMeCount: parseInt(String(user.ratedByMeCount)) || 0,
      })),
    });
  } catch (e) {
    console.error('Get users error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
