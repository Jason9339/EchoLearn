import { auth } from '@/auth';
import {
  extractStoragePathFromUrl,
  generateLabeledAudioFilename,
  getStorageFolderForCourse,
  sanitizePathComponent,
  validateAudioFile,
} from '@/app/lib/audio';
import { getSlotLabel } from '@/types/audio';
import { getSupabaseAdmin } from '@/app/lib/supabase';
import sql from '@/lib/postgres';

/**
 * POST /api/audio/upload
 * Accepts multipart/form-data: audio (file), courseId, sentenceId, slotIndex
 * Returns JSON: { success, recordingId, audioUrl, duration }
 *
 * Uploads audio file to Supabase Storage and persists metadata to PostgreSQL
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
      const courseIdRaw = formData.get('courseId');
      const sentenceIdRaw = formData.get('sentenceId');
      const slotIndexRaw = formData.get('slotIndex');
      const durationRaw = formData.get('duration'); // optional, ms from client if provided

      if (!(file instanceof File)) {
        return Response.json({ success: false, error: 'Missing audio file' }, { status: 400 });
      }

      if (typeof courseIdRaw !== 'string' || typeof sentenceIdRaw !== 'string' || typeof slotIndexRaw !== 'string') {
        return Response.json({ success: false, error: 'Missing courseId, sentenceId or slotIndex' }, { status: 400 });
      }

      const courseId = courseIdRaw;

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

    let previousStoragePath: string | null = null;
    try {
      const existingRecord = await sql<{ audioUrl: string | null }[]>`
        SELECT audio_url AS "audioUrl"
        FROM recordings
        WHERE user_id = ${normalizedUserId}
          AND course_id = ${courseId}
          AND sentence_id = ${sentenceId}
          AND slot_index = ${slotIndex}
        LIMIT 1
      `;
      if (existingRecord.length > 0 && existingRecord[0].audioUrl) {
        previousStoragePath = extractStoragePathFromUrl(existingRecord[0].audioUrl);
      }
    } catch (existingError) {
      console.error('[audio/upload] failed to fetch existing recording for cleanup', existingError, {
        userId: normalizedUserId,
        courseId,
        sentenceId,
        slotIndex,
      });
    }

    const safeUserId = sanitizePathComponent(normalizedUserId);
    const label = getSlotLabel(slotIndex); // 'official' | 'test'
    const filename = generateLabeledAudioFilename(normalizedUserId, sentenceId, slotIndex, label);

    // Upload file to Supabase Storage
    const supabase = getSupabaseAdmin();
    const storageBaseFolder = getStorageFolderForCourse(courseId);
    const storagePath = `${storageBaseFolder}/${safeUserId}/${sentenceId}/${filename}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: 'audio/webm',
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return Response.json({ success: false, error: 'Failed to upload audio file' }, { status: 500 });
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // Optional duration (ms) if client sends it; else approximate 0 for now
    const duration = typeof durationRaw === 'string' ? Number.parseInt(durationRaw, 10) : 0;

    // Insert or update recording in database using UPSERT
    const result = await sql`
      INSERT INTO recordings (user_id, course_id, sentence_id, slot_index, audio_url, duration, file_size)
      VALUES (${normalizedUserId}, ${courseId}, ${sentenceId}, ${slotIndex}, ${audioUrl}, ${duration}, ${file.size})
      ON CONFLICT (user_id, course_id, sentence_id, slot_index)
      DO UPDATE SET
        audio_url = EXCLUDED.audio_url,
        duration = EXCLUDED.duration,
        file_size = EXCLUDED.file_size,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const recordingId = result[0]?.id as string;

    if (previousStoragePath && previousStoragePath !== storagePath) {
      const { error: removeError } = await supabase.storage
        .from('recordings')
        .remove([previousStoragePath]);

      if (removeError) {
        console.error('Supabase cleanup error:', removeError, {
          previousStoragePath,
          userId: normalizedUserId,
          courseId,
          sentenceId,
          slotIndex,
        });
      }
    }

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
