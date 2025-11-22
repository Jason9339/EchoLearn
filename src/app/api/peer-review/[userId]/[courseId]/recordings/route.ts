import { auth } from '@/auth';
import sql from '@/lib/postgres';

/**
 * GET /api/peer-review/[userId]/[courseId]/recordings
 * Get recordings for a specific user and course with existing ratings
 * Returns JSON: { success, userName, recordings: [{ id, sentenceId, slotIndex, audioUrl, duration, myRating }] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; courseId: string }> }
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
      console.error('[peer-review/recordings] failed to lookup user id by email', lookupError);
    }
  }

  if (!currentUserId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId: targetUserId, courseId } = await params;
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

    // Get recordings for this user and course
    // Include ratings made by current user
    const recordings = await sql`
      SELECT
        r.id::text,
        r.course_id as "courseId",
        r.sentence_id as "sentenceId",
        r.slot_index as "slotIndex",
        r.audio_url as "audioUrl",
        r.duration,
        r.file_size as "fileSize",
        r.created_at as "createdAt",
        rat.score as "myRating",
        (
          SELECT COUNT(*)
          FROM ratings rat_all
          WHERE rat_all.recording_id = r.id
        ) as "ratingCount"
      FROM recordings r
      LEFT JOIN ratings rat ON rat.recording_id = r.id AND rat.rater_user_id::text = ${normalizedCurrentUserId}
      WHERE r.user_id::text = ${targetUserId}
        AND r.course_id = ${courseId}
      ORDER BY r.sentence_id, r.slot_index
    `;

    return Response.json({
      success: true,
      userName: userInfo[0].name || 'Unknown User',
      userEmail: userInfo[0].email,
      recordings: recordings.map(rec => ({
        id: rec.id,
        courseId: rec.courseId,
        sentenceId: rec.sentenceId,
        slotIndex: rec.slotIndex,
        audioUrl: rec.audioUrl,
        duration: rec.duration,
        fileSize: rec.fileSize,
        createdAt: rec.createdAt,
        myRating: rec.myRating || null,
        ratingCount: Number(rec.ratingCount) || 0,
      })),
    });
  } catch (e) {
    console.error('Get recordings error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
