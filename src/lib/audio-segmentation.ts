import ffmpeg from 'fluent-ffmpeg';
import { getSupabaseAdmin } from '@/app/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Audio segmentation service using FFmpeg
 * Handles downloading, segmenting, and uploading audio files
 */

export interface AudioSegment {
  sentenceId: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface SegmentedAudio {
  sentenceId: number;
  audioUrl: string;
  localPath?: string;
}

/**
 * Download audio file from URL to temporary location
 * @param audioUrl - URL of the audio file to download
 * @returns Path to the downloaded file
 */
async function downloadAudioFile(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const tempDir = os.tmpdir();
  const fileName = `audio_${Date.now()}.wav`;
  const filePath = path.join(tempDir, fileName);

  await fs.writeFile(filePath, Buffer.from(buffer));
  console.log(`[audio-segmentation] Downloaded audio to: ${filePath}`);
  
  return filePath;
}

/**
 * Segment audio file using FFmpeg
 * @param inputPath - Path to the input audio file
 * @param segments - Array of segments with timing information
 * @returns Array of segmented audio file paths
 */
async function segmentAudioFile(
  inputPath: string,
  segments: AudioSegment[]
): Promise<{ sentenceId: number; filePath: string }[]> {
  const tempDir = os.tmpdir();
  const segmentedFiles: { sentenceId: number; filePath: string }[] = [];

  console.log(`[audio-segmentation] Starting segmentation of ${segments.length} segments`);

  for (const segment of segments) {
    const outputFileName = `segment_${segment.sentenceId}_${Date.now()}.wav`;
    const outputPath = path.join(tempDir, outputFileName);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(segment.startTime) // Start time in seconds
          .duration(segment.endTime - segment.startTime) // Duration in seconds
          .audioCodec('pcm_s16le') // Use PCM codec for compatibility
          .audioFrequency(44100) // Standard sample rate
          .audioChannels(1) // Mono audio
          .format('wav')
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log(`[audio-segmentation] FFmpeg command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            console.log(`[audio-segmentation] Segment ${segment.sentenceId}: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log(`[audio-segmentation] Segment ${segment.sentenceId} completed: ${outputPath}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`[audio-segmentation] FFmpeg error for segment ${segment.sentenceId}:`, err);
            reject(err);
          })
          .run();
      });

      segmentedFiles.push({
        sentenceId: segment.sentenceId,
        filePath: outputPath,
      });

    } catch (error) {
      console.error(`[audio-segmentation] Failed to segment audio for sentence ${segment.sentenceId}:`, error);
      // Continue with other segments even if one fails
    }
  }

  console.log(`[audio-segmentation] Successfully segmented ${segmentedFiles.length}/${segments.length} files`);
  return segmentedFiles;
}

/**
 * Upload segmented audio files to Supabase Storage
 * @param courseId - Course ID for organizing files
 * @param segmentedFiles - Array of segmented audio files
 * @returns Array of uploaded file URLs
 */
async function uploadSegmentedFiles(
  courseId: string,
  segmentedFiles: { sentenceId: number; filePath: string }[]
): Promise<SegmentedAudio[]> {
  const supabase = getSupabaseAdmin();
  const uploadedFiles: SegmentedAudio[] = [];

  console.log(`[audio-segmentation] Uploading ${segmentedFiles.length} segmented files`);

  for (const file of segmentedFiles) {
    try {
      const fileBuffer = await fs.readFile(file.filePath);
      const fileName = `sentence_${file.sentenceId}.wav`;
      const storagePath = `course-segments/${courseId}/${fileName}`;

    const { data: _uploaded, error } = await supabase.storage
        .from('recordings')
        .upload(storagePath, fileBuffer, {
          contentType: 'audio/wav',
          upsert: true, // Overwrite if exists
        });

      if (error) {
        console.error(`[audio-segmentation] Upload error for sentence ${file.sentenceId}:`, error);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(storagePath);

      uploadedFiles.push({
        sentenceId: file.sentenceId,
        audioUrl: urlData.publicUrl,
        localPath: file.filePath,
      });

      console.log(`[audio-segmentation] Uploaded sentence ${file.sentenceId}: ${urlData.publicUrl}`);

    } catch (error) {
      console.error(`[audio-segmentation] Failed to upload sentence ${file.sentenceId}:`, error);
    }
  }

  console.log(`[audio-segmentation] Successfully uploaded ${uploadedFiles.length}/${segmentedFiles.length} files`);
  return uploadedFiles;
}

/**
 * Clean up temporary files
 * @param filePaths - Array of file paths to delete
 */
async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  console.log(`[audio-segmentation] Cleaning up ${filePaths.length} temporary files`);
  
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      console.log(`[audio-segmentation] Deleted: ${filePath}`);
    } catch (error) {
      console.warn(`[audio-segmentation] Failed to delete ${filePath}:`, error);
    }
  }
}

/**
 * Main function to segment audio and upload to storage
 * @param originalAudioUrl - URL of the original audio file
 * @param courseId - Course ID for organizing files
 * @param segments - Array of segments with timing information
 * @returns Array of segmented audio URLs
 */
export async function segmentAndUploadAudio(
  originalAudioUrl: string,
  courseId: string,
  segments: AudioSegment[]
): Promise<SegmentedAudio[]> {
  const tempFiles: string[] = [];

  try {
    console.log(`[audio-segmentation] Starting audio segmentation for course: ${courseId}`);
    console.log(`[audio-segmentation] Original audio: ${originalAudioUrl}`);
    console.log(`[audio-segmentation] Segments to create: ${segments.length}`);

    // Step 1: Download original audio file
    const inputPath = await downloadAudioFile(originalAudioUrl);
    tempFiles.push(inputPath);

    // Step 2: Segment the audio file
    const segmentedFiles = await segmentAudioFile(inputPath, segments);
    tempFiles.push(...segmentedFiles.map(f => f.filePath));

    // Step 3: Upload segmented files to Supabase Storage
    const uploadedFiles = await uploadSegmentedFiles(courseId, segmentedFiles);

    // Step 4: Clean up temporary files
    await cleanupTempFiles(tempFiles);

    console.log(`[audio-segmentation] Audio segmentation completed successfully`);
    console.log(`[audio-segmentation] Created ${uploadedFiles.length} audio segments`);

    return uploadedFiles;

  } catch (error) {
    console.error('[audio-segmentation] Audio segmentation failed:', error);
    
    // Clean up temporary files even on error
    if (tempFiles.length > 0) {
      await cleanupTempFiles(tempFiles).catch(console.warn);
    }
    
    throw error;
  }
}

/**
 * Check if FFmpeg is available
 * @returns Promise that resolves to true if FFmpeg is available
 */
export async function checkFFmpegAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        console.warn('[audio-segmentation] FFmpeg not available:', err.message);
        resolve(false);
      } else {
        console.log('[audio-segmentation] FFmpeg is available');
        resolve(true);
      }
    });
  });
}

/**
 * Get FFmpeg information for debugging
 * @returns Promise with FFmpeg info
 */
export async function getFFmpegInfo(): Promise<{
  available: boolean;
  version?: string;
  formats?: string[];
}> {
  try {
    const available = await checkFFmpegAvailability();
    
    if (!available) {
      return { available: false };
    }

    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve({ available: false });
        } else {
          resolve({
            available: true,
            formats: Object.keys(formats || {}).slice(0, 10), // First 10 formats
          });
        }
      });
    });
  } catch (error) {
    console.error('[audio-segmentation] Error getting FFmpeg info:', error);
    return { available: false };
  }
}
