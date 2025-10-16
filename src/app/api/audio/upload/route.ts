import { auth } from '@/auth';
import { generateLabeledAudioFilename, validateAudioFile } from '@/app/lib/audio';
import { OFFICIAL_SLOT, getSlotLabel } from '@/types/audio';

/**
 * POST /api/audio/upload
 * Accepts multipart/form-data: audio (file), sentenceId, slotIndex
 * Returns JSON: { success, recordingId, audioUrl, duration }
 *
 * NOTE: This implementation stubs persistence and returns a fake id/url.
 *       Hooks are marked with TODOs for wiring to PostgreSQL later.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('audio');
    const sentenceIdRaw = formData.get('sentenceId');
    const slotIndexRaw = formData.get('slotIndex');
    const durationRaw = formData.get('duration'); // optional, ms from client if provided

    if (!(file instanceof File)) {
      return Response.json({ success: false, error: 'Missing audio file' }, { status: 400 });
    }

    if (typeof sentenceIdRaw !== 'string' || typeof slotIndexRaw !== 'string') {
      return Response.json({ success: false, error: 'Missing sentenceId or slotIndex' }, { status: 400 });
    }

    const sentenceId = Number.parseInt(sentenceIdRaw, 10);
    const slotIndex = Number.parseInt(slotIndexRaw, 10);
    if (!Number.isFinite(sentenceId) || !Number.isFinite(slotIndex)) {
      return Response.json({ success: false, error: 'Invalid sentenceId or slotIndex' }, { status: 400 });
    }

    // Validate file properties
    const { isValid, error } = validateAudioFile(file);
    if (!isValid) {
      return Response.json({ success: false, error }, { status: 400 });
    }

    const userId = String(session.user.id);
    const label = getSlotLabel(slotIndex); // 'official' | 'test'
    const filename = generateLabeledAudioFilename(userId, sentenceId, slotIndex, label);

    // TODO: Persist file to storage (e.g., local FS, S3, GCS). For now, stub URL.
    // Example path suggestion (if using local FS): /uploads/audio/{userId}/{sentenceId}/{filename}
    const fakeStorageUrl = `/uploads/${filename}`;

    // Optional duration (ms) if client sends it; else approximate 0 for now
    const duration = typeof durationRaw === 'string' ? Number.parseInt(durationRaw, 10) : 0;

    // TODO: Insert row into PostgreSQL 'recordings' table
    // Suggested schema fields: id, user_id, sentence_id, slot_index, audio_url, duration, file_size
    // Example pseudo:
    // const { rows: [rec] } = await db.query(
    //   `INSERT INTO recordings (user_id, sentence_id, slot_index, audio_url, duration, file_size)
    //    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    //   [userId, sentenceId, slotIndex, fakeStorageUrl, duration, file.size]
    // );
    // const recordingId = rec.id as string;

    // For stub response, synthesize a deterministic id
    const recordingId = `${userId}-${sentenceId}-${slotIndex}-${Date.now()}`;

    return Response.json({
      success: true,
      recordingId,
      audioUrl: fakeStorageUrl,
      duration,
    });
  } catch (e) {
    console.error('Upload error:', e);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}


