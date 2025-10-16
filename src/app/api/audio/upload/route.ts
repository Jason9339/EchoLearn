import { auth } from '@/auth';
import { generateLabeledAudioFilename, sanitizePathComponent, validateAudioFile } from '@/app/lib/audio';
import { getSlotLabel } from '@/types/audio';
import postgres from 'postgres';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * POST /api/audio/upload
 * Accepts multipart/form-data: audio (file), sentenceId, slotIndex
 * Returns JSON: { success, recordingId, audioUrl, duration }
 *
 * Saves audio file to local storage and persists metadata to PostgreSQL
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
      console.error('[audio/upload] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    console.error('[audio/upload] unauthorized session', session);
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedUserId = String(userId);

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

    const safeUserId = sanitizePathComponent(normalizedUserId);
    const label = getSlotLabel(slotIndex); // 'official' | 'test'
    const filename = generateLabeledAudioFilename(normalizedUserId, sentenceId, slotIndex, label);

    // Save file to local storage
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'audio', safeUserId, String(sentenceId));
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Public URL path for accessing the file
    const audioUrl = `/uploads/audio/${safeUserId}/${sentenceId}/${filename}`;

    // Optional duration (ms) if client sends it; else approximate 0 for now
    const duration = typeof durationRaw === 'string' ? Number.parseInt(durationRaw, 10) : 0;

    // Insert or update recording in database using UPSERT
    const result = await sql`
      INSERT INTO recordings (user_id, sentence_id, slot_index, audio_url, duration, file_size)
      VALUES (${normalizedUserId}, ${sentenceId}, ${slotIndex}, ${audioUrl}, ${duration}, ${file.size})
      ON CONFLICT (user_id, sentence_id, slot_index)
      DO UPDATE SET
        audio_url = EXCLUDED.audio_url,
        duration = EXCLUDED.duration,
        file_size = EXCLUDED.file_size,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const recordingId = result[0]?.id as string;

    return Response.json({
      success: true,
      recordingId,
      audioUrl,
      duration,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
