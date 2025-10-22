import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * GET /api/audio/recordings
 * Get all recordings for the current user
 * Returns JSON: { success, recordings: [{ id, courseId, sentenceId, slotIndex, audioUrl, duration, createdAt }] }
 */
export async function GET(): Promise<Response> {
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
      console.error('[audio/recordings] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const normalizedUserId = String(userId);

    // Query all recordings for this user
    const recordings = await sql`
      SELECT
        id,
        course_id as "courseId",
        sentence_id as "sentenceId",
        slot_index as "slotIndex",
        audio_url as "audioUrl",
        duration,
        file_size as "fileSize",
        created_at as "createdAt"
      FROM recordings
      WHERE user_id = ${normalizedUserId}
      ORDER BY course_id, sentence_id, slot_index
    `;

    return Response.json({
      success: true,
      recordings: recordings.map(rec => ({
        id: rec.id,
        courseId: rec.courseId,
        sentenceId: rec.sentenceId,
        slotIndex: rec.slotIndex,
        audioUrl: rec.audioUrl,
        duration: rec.duration,
        fileSize: rec.fileSize,
        createdAt: rec.createdAt,
      })),
    });
  } catch (e) {
    console.error('Get recordings error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
