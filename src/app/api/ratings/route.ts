import { auth } from '@/auth';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * POST /api/ratings
 * Submit or update a rating for a recording
 * Body: { sentenceId, slotIndex, score }
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
      console.error('[ratings] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    console.error('[ratings] unauthorized session', session);
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedUserId = String(userId);

  try {
    const body = await request.json();
    const { courseId, sentenceId, slotIndex, score } = body;

    // Validate input
    if (typeof courseId !== 'string' || typeof sentenceId !== 'number' || typeof slotIndex !== 'number' || typeof score !== 'number') {
      return Response.json({ success: false, error: 'Invalid input: courseId, sentenceId, slotIndex, and score are required' }, { status: 400 });
    }

    if (score < 1 || score > 5) {
      return Response.json({ success: false, error: 'Score must be between 1 and 5' }, { status: 400 });
    }

    // First, find the recording_id for this course, sentence and slot
    // We need to find the recording that the current user wants to rate
    // Note: The user might be rating someone else's recording, or their own
    // For now, we'll assume they're rating their own recording
    const recordings = await sql<{ id: string }[]>`
      SELECT id::text
      FROM recordings
      WHERE user_id::text = ${normalizedUserId}
        AND course_id = ${courseId}
        AND sentence_id = ${sentenceId}
        AND slot_index = ${slotIndex}
      LIMIT 1
    `;

    if (recordings.length === 0) {
      return Response.json({ success: false, error: 'No recording found for this sentence and slot' }, { status: 404 });
    }

    const recordingId = recordings[0].id;

    // Insert or update rating using UPSERT
    const result = await sql`
      INSERT INTO ratings (recording_id, rater_user_id, sentence_id, slot_index, score)
      VALUES (${recordingId}, ${normalizedUserId}, ${sentenceId}, ${slotIndex}, ${score})
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
    console.error('Rating submission error:', error);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/ratings
 * Get all ratings for the current user's recordings
 * Query params: sentenceId (optional), slotIndex (optional)
 * Returns JSON: { success, ratings: [{ id, recordingId, sentenceId, slotIndex, score, createdAt }] }
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
      console.error('[ratings] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const normalizedUserId = String(userId);
    const { searchParams } = new URL(request.url);
    const sentenceId = searchParams.get('sentenceId');
    const slotIndex = searchParams.get('slotIndex');

    // Build query based on filters
    let ratings;
    if (sentenceId !== null && slotIndex !== null) {
      // Filter by sentence and slot
      const sentenceIdNum = Number.parseInt(sentenceId, 10);
      const slotIndexNum = Number.parseInt(slotIndex, 10);

      ratings = await sql`
        SELECT
          r.id,
          r.recording_id as "recordingId",
          r.sentence_id as "sentenceId",
          r.slot_index as "slotIndex",
          r.score,
          r.created_at as "createdAt"
        FROM ratings r
        INNER JOIN recordings rec ON r.recording_id = rec.id
        WHERE rec.user_id::text = ${normalizedUserId}
          AND r.rater_user_id::text = ${normalizedUserId}
          AND r.sentence_id = ${sentenceIdNum}
          AND r.slot_index = ${slotIndexNum}
      `;
    } else {
      // Get all ratings for user's recordings
      ratings = await sql`
        SELECT
          r.id,
          r.recording_id as "recordingId",
          r.sentence_id as "sentenceId",
          r.slot_index as "slotIndex",
          r.score,
          r.created_at as "createdAt"
        FROM ratings r
        INNER JOIN recordings rec ON r.recording_id = rec.id
        WHERE rec.user_id::text = ${normalizedUserId}
          AND r.rater_user_id::text = ${normalizedUserId}
        ORDER BY r.sentence_id, r.slot_index
      `;
    }

    return Response.json({
      success: true,
      ratings: ratings.map(rating => ({
        id: rating.id,
        recordingId: rating.recordingId,
        sentenceId: rating.sentenceId,
        slotIndex: rating.slotIndex,
        score: rating.score,
        createdAt: rating.createdAt,
      })),
    });
  } catch (e) {
    console.error('Get ratings error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
