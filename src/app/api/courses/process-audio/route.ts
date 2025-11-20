import { auth } from '@/auth';
import postgres from 'postgres';
import { transcribeAudio, splitIntoSentences, generateAudioSegments, isOpenAIConfigured } from '@/lib/openai';
import { trimIntroFromAudio } from '@/lib/audio-segmentation';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * POST /api/courses/process-audio
 * Process uploaded audio file and generate course content
 * This is an internal API that will be called by background jobs
 * Accepts JSON: { courseId, audioUrl }
 * Returns JSON: { success, sentences }
 */
export async function POST(request: Request): Promise<Response> {
  let courseId: string;
  let audioUrl: string;
  let introSkipSeconds: number;

  try {
    // Parse request body once and store the values
    const body = await request.json();
    courseId = body.courseId;
    audioUrl = body.audioUrl;
    introSkipSeconds = Number(body.introSkipSeconds) || 0;

    if (!courseId || !audioUrl) {
      return Response.json({
        success: false,
        error: 'Missing courseId or audioUrl'
      }, { status: 400 });
    }

    console.log(`[process-audio] Starting processing for course: ${courseId}, audioUrl: ${audioUrl}, introSkipSeconds: ${introSkipSeconds}`);

  } catch (parseError) {
    console.error('[process-audio] Failed to parse request body:', parseError);
    return Response.json({ 
      success: false, 
      error: 'Invalid request body' 
    }, { status: 400 });
  }

  // Check for internal API call
  const isInternalCall = request.headers.get('x-internal-api') === 'true';
  
  if (!isInternalCall) {
    // For external calls, require authentication
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
        console.error('[courses/process-audio] failed to lookup user id by email', lookupError);
      }
    }

    if (!userId) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
  }

  try {
    // Get course information (remove user_id check for internal calls)
    const courseQuery = isInternalCall 
      ? sql`
          SELECT 
            uc.max_sentences as "maxSentences",
            uc.user_id as "userId"
          FROM user_courses uc
          WHERE uc.id = ${courseId}
          LIMIT 1
        `
      : sql`
          SELECT 
            uc.max_sentences as "maxSentences",
            uc.user_id as "userId"
          FROM user_courses uc
          WHERE uc.id = ${courseId}
          LIMIT 1
        `;

    const courseResult = await courseQuery;

    if (courseResult.length === 0) {
      console.error(`[process-audio] Course ${courseId} not found`);
      return Response.json({ 
        success: false, 
        error: 'Course not found' 
      }, { status: 404 });
    }

    const course = courseResult[0];
    const maxSentences = parseInt(String(course.maxSentences));
    console.log(`[process-audio] Found course with maxSentences: ${maxSentences}`);

    // Update job status to processing
    await sql`
      UPDATE audio_processing_jobs
      SET status = 'processing', progress = 10, updated_at = NOW()
      WHERE course_id = ${courseId}
    `;

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      console.log('[process-audio] OpenAI not configured, using mock processing for course:', courseId);
      
      // Mock processing - generate dummy sentences with sample audio
      const mockSentences = Array.from({ length: Math.min(maxSentences, 5) }, (_, i) => ({
        sentenceId: i + 1,
        text: `This is sentence ${i + 1} from your uploaded audio file. (Mock data - OpenAI API not configured)`,
        startTime: i * 3,
        endTime: (i + 1) * 3,
        // Use sample audio files for testing (these should exist in public/audio/)
        audioUrl: `/audio/cmu_us_bdl_arctic/arctic_a000${i + 1}.wav`,
      }));

      // Update progress
      await sql`
        UPDATE audio_processing_jobs
        SET progress = 50, updated_at = NOW()
        WHERE course_id = ${courseId}
      `;

      // Insert mock sentences into database
      for (const sentence of mockSentences) {
        await sql`
          INSERT INTO course_sentences (course_id, sentence_id, text, audio_url, start_time, end_time)
          VALUES (${courseId}, ${sentence.sentenceId}, ${sentence.text}, ${sentence.audioUrl}, ${sentence.startTime}, ${sentence.endTime})
        `;
      }

      // Update course and job status to completed
      await sql`
        UPDATE user_courses
        SET status = 'completed', updated_at = NOW()
        WHERE id = ${courseId}
      `;

      await sql`
        UPDATE audio_processing_jobs
        SET status = 'completed', progress = 100, processing_message = '使用測試資料生成課程（OpenAI API 未配置）', updated_at = NOW()
        WHERE course_id = ${courseId}
      `;

      console.log(`[process-audio] Mock processing completed for course ${courseId} with ${mockSentences.length} sentences`);

      return Response.json({
        success: true,
        sentences: mockSentences,
        message: 'Processed with mock data (OpenAI API not configured)',
      });
    }

    // Real OpenAI processing
    console.log('[process-audio] OpenAI configured, starting real audio processing for course:', courseId);

    // Download audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file');
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Save to temporary file - keep original format (likely MP3)
    const tempDir = os.tmpdir();
    // Detect file format from URL or use mp3 as default
    const urlPath = new URL(audioUrl).pathname;
    const extension = urlPath.substring(urlPath.lastIndexOf('.')).toLowerCase() || '.mp3';
    const tempFileName = `audio_${Date.now()}${extension}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    await fs.writeFile(tempFilePath, Buffer.from(audioBuffer));
    console.log(`[process-audio] Downloaded audio to: ${tempFilePath}`);

    // Trim intro if specified
    let processedFilePath = tempFilePath;
    if (introSkipSeconds > 0) {
      console.log(`[process-audio] Trimming ${introSkipSeconds}s intro from audio...`);
      processedFilePath = await trimIntroFromAudio(tempFilePath, introSkipSeconds);
      console.log(`[process-audio] Intro trimmed, new file: ${processedFilePath}`);
    }

    // Read the processed file for Whisper
    const processedBuffer = await fs.readFile(processedFilePath);

    // Detect the actual file format to set correct MIME type
    const fileExtension = path.extname(processedFilePath).toLowerCase();
    const mimeType = fileExtension === '.mp3' ? 'audio/mpeg' :
                     fileExtension === '.wav' ? 'audio/wav' :
                     fileExtension === '.m4a' ? 'audio/mp4' :
                     fileExtension === '.ogg' ? 'audio/ogg' :
                     'audio/mpeg'; // default to mp3

    const audioFile = new File([new Uint8Array(processedBuffer)], `audio${fileExtension}`, { type: mimeType });

    console.log(`[process-audio] Prepared audio file for Whisper: ${fileExtension}, ${mimeType}, ${(processedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    // Update progress
    await sql`
      UPDATE audio_processing_jobs
      SET progress = 30, updated_at = NOW()
      WHERE course_id = ${courseId}
    `;

    // Transcribe audio using Whisper
    console.log('[process-audio] Transcribing audio with Whisper API...');
    const transcription = await transcribeAudio(audioFile);

    // Clean up temporary files
    try {
      await fs.unlink(tempFilePath);
      if (processedFilePath !== tempFilePath) {
        await fs.unlink(processedFilePath);
      }
    } catch (cleanupError) {
      console.warn('[process-audio] Failed to cleanup temp files:', cleanupError);
    }

    // Update progress
    await sql`
      UPDATE audio_processing_jobs
      SET progress = 60, updated_at = NOW()
      WHERE course_id = ${courseId}
    `;

    // Split into sentences
    console.log('[process-audio] Splitting transcription into sentences...');
    const sentences = splitIntoSentences(transcription.segments, maxSentences);

    // Adjust timestamps if intro was skipped
    // Whisper timestamps are relative to the trimmed audio (starting at 0)
    // We need to add introSkipSeconds to map them back to the original audio
    if (introSkipSeconds > 0) {
      console.log(`[process-audio] Adjusting timestamps by +${introSkipSeconds}s to match original audio`);
      sentences.forEach(sentence => {
        sentence.startTime = Number(sentence.startTime) + introSkipSeconds;
        sentence.endTime = Number(sentence.endTime) + introSkipSeconds;
      });
    }

    // Update progress
    await sql`
      UPDATE audio_processing_jobs
      SET progress = 80, updated_at = NOW()
      WHERE course_id = ${courseId}
    `;

    // Generate audio segments using FFmpeg
    console.log('[process-audio] Generating audio segments...');
    const audioSegments = await generateAudioSegments(audioUrl, courseId, sentences);

    // Insert sentences into database
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const audioSegment = audioSegments.find(seg => seg.sentenceId === sentence.sentenceId);
      const audioUrlForInsert: string | null = audioSegment?.audioUrl ?? null;

      await sql`
        INSERT INTO course_sentences (course_id, sentence_id, text, audio_url, start_time, end_time)
        VALUES (${courseId}, ${sentence.sentenceId}, ${sentence.text}, ${audioUrlForInsert}, ${sentence.startTime}, ${sentence.endTime})
      `;
    }

    // Update course and job status to completed
    await sql`
      UPDATE user_courses
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${courseId}
    `;

    await sql`
      UPDATE audio_processing_jobs
      SET status = 'completed', progress = 100, processing_message = '使用 OpenAI Whisper API 成功處理音檔', updated_at = NOW()
      WHERE course_id = ${courseId}
    `;

    console.log(`[process-audio] Successfully processed course ${courseId} with ${sentences.length} sentences`);

    return Response.json({
      success: true,
      sentences,
      message: `Successfully processed with OpenAI Whisper API - generated ${sentences.length} sentences`,
    });

  } catch (error) {
    console.error('[process-audio] Audio processing error:', error);

    try {
      // Update job status to failed (use the courseId we already parsed)
      await sql`
        UPDATE audio_processing_jobs
        SET status = 'failed', error_message = ${String(error)}, updated_at = NOW()
        WHERE course_id = ${courseId}
      `;

      await sql`
        UPDATE user_courses
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${courseId}
      `;
    } catch (updateError) {
      console.error('[process-audio] Failed to update error status:', updateError);
    }

    return Response.json({ 
      success: false, 
      error: `Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}