import { auth } from '@/auth';
import { extractStoragePathFromUrl } from '@/app/lib/audio';
import { getSupabaseAdmin } from '@/app/lib/supabase';
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

/**
 * DELETE /api/audio/recordings
 * Body: { recordingId }
 * Removes the recording, associated ratings, and storage file for the current user
 */
export async function DELETE(request: Request): Promise<Response> {
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
      console.error('[audio/recordings] failed to lookup user id by email (delete)', lookupError);
    }
  }

  if (!userId) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[audio/recordings] failed to parse delete body', parseError);
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const recordingId = typeof (body as { recordingId?: unknown })?.recordingId === 'string'
    ? (body as { recordingId: string }).recordingId
    : null;

  if (!recordingId) {
    return Response.json({ success: false, error: 'Missing recordingId' }, { status: 400 });
  }

  try {
    const normalizedUserId = String(userId);

    const existingRecords = await sql<{
      id: string;
      audioUrl: string | null;
      sentenceId: number;
      slotIndex: number;
    }[]>`
      SELECT
        id::text AS id,
        audio_url AS "audioUrl",
        sentence_id AS "sentenceId",
        slot_index AS "slotIndex"
      FROM recordings
      WHERE id::text = ${recordingId}
        AND user_id::text = ${normalizedUserId}
      LIMIT 1
    `;

    if (existingRecords.length === 0) {
      return Response.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    const record = existingRecords[0];
    const supabase = getSupabaseAdmin();
    const storagePath = record.audioUrl ? extractStoragePathFromUrl(record.audioUrl) : null;
    let storageWarning: string | null = null;

    if (storagePath) {
      const { error: removeError } = await supabase.storage
        .from('recordings')
        .remove([storagePath]);

      if (removeError) {
        console.error('[audio/recordings] failed to delete storage object', removeError, {
          storagePath,
          recordingId,
          userId: normalizedUserId,
        });
        storageWarning = 'Failed to delete audio file from storage';
      }
    }

    const deletionResult = await sql.begin(async (tx) => {
      const deletedRatings = await tx`
        DELETE FROM ratings
        WHERE recording_id = ${recordingId}
        RETURNING id
      `;

      const deletedRecording = await tx`
        DELETE FROM recordings
        WHERE id::text = ${recordingId}
          AND user_id::text = ${normalizedUserId}
        RETURNING id::text
      `;

      return {
        deletedRatingsCount: deletedRatings.length,
        deletedRecordingId: deletedRecording[0]?.id as string | undefined,
      };
    });

    if (!deletionResult.deletedRecordingId) {
      console.warn('[audio/recordings] deletion completed without affected row', {
        recordingId,
        userId: normalizedUserId,
      });
      return Response.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      recordingId: deletionResult.deletedRecordingId,
      deletedRatings: deletionResult.deletedRatingsCount,
      storageWarning,
    });
  } catch (error) {
    console.error('Delete recordings error:', error);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
