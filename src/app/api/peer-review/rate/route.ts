import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * POST /api/peer-review/rate
 * Submit or update a rating for someone else's recording (peer review)
 * Body: { recordingId, score }
 * Returns JSON: { success, ratingId }
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
      console.error('[peer-review/rate] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    console.error('[peer-review/rate] unauthorized session', session);
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedUserId = String(userId);

  try {
    const body = await request.json();
    const { recordingId, score } = body;

    // Validate input
    if (typeof recordingId !== 'string' || typeof score !== 'number') {
      return Response.json({ success: false, error: 'Invalid input: recordingId and score are required' }, { status: 400 });
    }

    if (score < 1 || score > 5) {
      return Response.json({ success: false, error: 'Score must be between 1 and 5' }, { status: 400 });
    }

    // Get recording details to populate sentence_id and slot_index
    const recordings = await sql<{ sentence_id: number; slot_index: number; user_id: string }[]>`
      SELECT sentence_id, slot_index, user_id::text
      FROM recordings
      WHERE id::text = ${recordingId}
      LIMIT 1
    `;

    if (recordings.length === 0) {
      return Response.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    const recording = recordings[0];

    // Prevent users from rating their own recordings in peer review
    if (recording.user_id === normalizedUserId) {
      return Response.json({ success: false, error: 'Cannot rate your own recording' }, { status: 400 });
    }

    // Insert or update rating using UPSERT
    const result = await sql`
      INSERT INTO ratings (recording_id, rater_user_id, sentence_id, slot_index, score)
      VALUES (${recordingId}, ${normalizedUserId}, ${recording.sentence_id}, ${recording.slot_index}, ${score})
      ON CONFLICT (recording_id, rater_user_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const ratingId = result[0]?.id as number;

    return Response.json({
      success: true,
      ratingId,
      recordingId,
      score,
    });
  } catch (error) {
    console.error('Peer review rating submission error:', error);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
