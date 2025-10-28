import { auth } from '@/auth';
import postgres from 'postgres';
import { getSupabaseAdmin } from '@/app/lib/supabase';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * DELETE /api/courses/[courseId]/delete
 * Delete a user-created course and all associated data
 * This will cascade delete:
 * - Course sentences
 * - Audio processing jobs
 * - Recordings for this course
 * - Storage files
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
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
      console.error('[courses/delete] failed to lookup user id by email', lookupError);
    }
  }

  if (!userId) {
    console.error('[courses/delete] unauthorized session', session);
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalizedUserId = String(userId);

  try {
    const { courseId } = await params;

    console.log(`[courses/delete] Starting deletion for course: ${courseId}, user: ${normalizedUserId}`);

    // First, verify the course exists and belongs to the user
    const courseCheck = await sql`
      SELECT 
        id,
        title,
        original_audio_url as "originalAudioUrl"
      FROM user_courses
      WHERE id = ${courseId} AND user_id = ${normalizedUserId}
      LIMIT 1
    `;

    if (courseCheck.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Course not found or unauthorized' 
      }, { status: 404 });
    }

    const course = courseCheck[0];
    console.log(`[courses/delete] Found course: ${course.title}`);

    // Get all storage files that need to be deleted
    const supabase = getSupabaseAdmin();
    const filesToDelete: string[] = [];

    // 1. Original audio file (from course-uploads)
    if (course.originalAudioUrl) {
      try {
        const url = new URL(course.originalAudioUrl);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf('recordings');
        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
          const storagePath = pathParts.slice(bucketIndex + 1).join('/');
          filesToDelete.push(storagePath);
          console.log(`[courses/delete] Will delete original audio: ${storagePath}`);
        }
      } catch (urlError) {
        console.warn('[courses/delete] Could not parse original audio URL:', course.originalAudioUrl);
      }
    }

    // 2. Generated sentence audio files (if any)
    const sentenceAudios = await sql`
      SELECT audio_url
      FROM course_sentences
      WHERE course_id = ${courseId} AND audio_url IS NOT NULL
    `;

    for (const sentence of sentenceAudios) {
      if (sentence.audio_url) {
        try {
          const url = new URL(sentence.audio_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.indexOf('recordings');
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            const storagePath = pathParts.slice(bucketIndex + 1).join('/');
            filesToDelete.push(storagePath);
            console.log(`[courses/delete] Will delete sentence audio: ${storagePath}`);
          }
        } catch (urlError) {
          console.warn('[courses/delete] Could not parse sentence audio URL:', sentence.audio_url);
        }
      }
    }

    // 3. User recordings for this course
    const userRecordings = await sql`
      SELECT audio_url
      FROM recordings
      WHERE course_id = ${courseId} AND user_id = ${normalizedUserId}
    `;

    for (const recording of userRecordings) {
      if (recording.audio_url) {
        try {
          const url = new URL(recording.audio_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.indexOf('recordings');
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            const storagePath = pathParts.slice(bucketIndex + 1).join('/');
            filesToDelete.push(storagePath);
            console.log(`[courses/delete] Will delete user recording: ${storagePath}`);
          }
        } catch (urlError) {
          console.warn('[courses/delete] Could not parse recording URL:', recording.audio_url);
        }
      }
    }

    // Start database transaction for deletion
    console.log(`[courses/delete] Starting database deletion for course: ${courseId}`);

    // Delete in correct order due to foreign key constraints:
    // 1. Ratings (references recordings)
    const deletedRatings = await sql`
      DELETE FROM ratings
      WHERE recording_id IN (
        SELECT id FROM recordings WHERE course_id = ${courseId} AND user_id = ${normalizedUserId}
      )
    `;
    console.log(`[courses/delete] Deleted ${deletedRatings.count} ratings`);

    // 2. Recordings (references user_courses)
    const deletedRecordings = await sql`
      DELETE FROM recordings
      WHERE course_id = ${courseId} AND user_id = ${normalizedUserId}
    `;
    console.log(`[courses/delete] Deleted ${deletedRecordings.count} recordings`);

    // 3. Course sentences (references user_courses)
    const deletedSentences = await sql`
      DELETE FROM course_sentences
      WHERE course_id = ${courseId}
    `;
    console.log(`[courses/delete] Deleted ${deletedSentences.count} course sentences`);

    // 4. Audio processing jobs (references user_courses)
    const deletedJobs = await sql`
      DELETE FROM audio_processing_jobs
      WHERE course_id = ${courseId}
    `;
    console.log(`[courses/delete] Deleted ${deletedJobs.count} processing jobs`);

    // 5. Finally, delete the course itself
    const deletedCourse = await sql`
      DELETE FROM user_courses
      WHERE id = ${courseId} AND user_id = ${normalizedUserId}
    `;
    console.log(`[courses/delete] Deleted ${deletedCourse.count} course record`);

    if (deletedCourse.count === 0) {
      throw new Error('Failed to delete course - no rows affected');
    }

    // Delete storage files
    console.log(`[courses/delete] Deleting ${filesToDelete.length} storage files`);
    let deletedFiles = 0;
    let failedFiles = 0;

    for (const filePath of filesToDelete) {
      try {
        const { error } = await supabase.storage
          .from('recordings')
          .remove([filePath]);

        if (error) {
          console.warn(`[courses/delete] Failed to delete storage file ${filePath}:`, error.message);
          failedFiles++;
        } else {
          console.log(`[courses/delete] Successfully deleted storage file: ${filePath}`);
          deletedFiles++;
        }
      } catch (storageError) {
        console.warn(`[courses/delete] Error deleting storage file ${filePath}:`, storageError);
        failedFiles++;
      }
    }

    console.log(`[courses/delete] Deletion completed for course: ${courseId}`);
    console.log(`[courses/delete] Storage files - deleted: ${deletedFiles}, failed: ${failedFiles}`);

    return Response.json({
      success: true,
      message: 'Course deleted successfully',
      deletedData: {
        course: deletedCourse.count,
        sentences: deletedSentences.count,
        recordings: deletedRecordings.count,
        ratings: deletedRatings.count,
        jobs: deletedJobs.count,
        storageFiles: deletedFiles,
        failedStorageFiles: failedFiles,
      },
    });

  } catch (error) {
    console.error('[courses/delete] Deletion error:', error);
    return Response.json({ 
      success: false, 
      error: `Failed to delete course: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
