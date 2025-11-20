import OpenAI from 'openai';
import type { CourseSentence } from '@/app/lib/definitions';

// Initialize OpenAI client (will be null if no API key)
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

/**
 * Transcribe audio file using OpenAI Whisper API
 * @param audioFile - Audio file to transcribe
 * @returns Transcription with segments and timestamps
 */
export async function transcribeAudio(audioFile: File): Promise<{
  text: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      // Remove language parameter to let Whisper auto-detect
      // This will work for both English and Chinese audio
    });

    return {
      text: transcription.text,
      segments: transcription.segments || [],
    };
  } catch (error) {
    console.error('Whisper API error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

/**
 * Detect the first actual speech segment (skip intro/silence)
 * @param segments - Whisper segments with timestamps
 * @returns Index of first real speech segment
 */
function detectFirstSpeechSegment(
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>
): number {
  if (segments.length === 0) return 0;

  // Strategy 1: Look for the first segment with meaningful content
  for (let i = 0; i < Math.min(10, segments.length); i++) {
    const segment = segments[i];
    const text = segment.text.trim();
    const wordCount = text.split(/\s+/).length;

    // Skip very short segments (likely noise/music)
    if (text.length < 3) continue;

    // Consider it real speech if:
    // 1. Has at least 3 words, AND
    // 2. Contains actual letters/characters (not just punctuation or noise)
    const hasWords = wordCount >= 3;
    const hasLetters = /[a-zA-Z\u4e00-\u9fa5]{2,}/.test(text);

    if (hasWords && hasLetters) {
      console.log(`[detectFirstSpeechSegment] Found first speech at segment ${i}: "${text.substring(0, 50)}..."`);
      return i;
    }
  }

  // Strategy 2: Check if first segment looks like intro music/silence
  // Intro segments often have:
  // - Very short text (Whisper transcribes music as gibberish)
  // - OR starts from 0 but has no real words
  const firstSegment = segments[0];
  if (firstSegment) {
    const firstText = firstSegment.text.trim();
    const hasRealWords = /\b[a-zA-Z]{3,}\b|\p{Script=Han}{2,}/u.test(firstText);

    // If first segment starts at 0 and has no real words, it's likely intro
    if (firstSegment.start < 0.5 && !hasRealWords && firstText.length < 20) {
      console.log(`[detectFirstSpeechSegment] First segment appears to be intro music/noise: "${firstText}"`);
      // Skip to segment 1 if it exists
      if (segments.length > 1) {
        console.log(`[detectFirstSpeechSegment] Skipping to segment 1`);
        return 1;
      }
    }
  }

  // Strategy 3: If we still haven't found speech, use time-based approach
  // Look for first segment that starts after 1 second with meaningful text
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const hasContent = /[a-zA-Z\u4e00-\u9fa5]{5,}/.test(segment.text);
    if (segment.start >= 1 && hasContent) {
      console.log(`[detectFirstSpeechSegment] Using time-based detection, starting at segment ${i} (${segment.start}s)`);
      return i;
    }
  }

  // Fallback: use first segment
  console.log('[detectFirstSpeechSegment] No intro detected, starting from segment 0');
  return 0;
}

/**
 * Split transcription segments into sentences with audio timing
 * @param segments - Whisper segments with timestamps
 * @param maxSentences - Maximum number of sentences to generate
 * @returns Array of course sentences with timing information
 */
export function splitIntoSentences(
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>,
  maxSentences: number
): Array<{
  sentenceId: number;
  text: string;
  startTime: number;
  endTime: number;
}> {
  if (segments.length === 0) {
    return [];
  }

  const sentences: Array<{
    sentenceId: number;
    text: string;
    startTime: number;
    endTime: number;
  }> = [];

  // Log first few segments for debugging
  console.log(`[splitIntoSentences] Total segments from Whisper: ${segments.length}`);
  segments.slice(0, 3).forEach((seg, i) => {
    console.log(`[splitIntoSentences] Segment ${i}: ${seg.start.toFixed(2)}s-${seg.end.toFixed(2)}s: "${seg.text.substring(0, 50)}..."`);
  });

  // Detect and skip intro/silence segments
  const firstSpeechIndex = detectFirstSpeechSegment(segments);
  console.log(`[splitIntoSentences] Skipping ${firstSpeechIndex} intro segments, starting from segment ${firstSpeechIndex}`);

  let currentSentence = '';
  let currentStartTime = 0;
  let sentenceId = 1;

  // Start from the first real speech segment
  for (let i = firstSpeechIndex; i < segments.length; i++) {
    const segment = segments[i];

    if (sentences.length >= maxSentences) {
      break;
    }

    const segmentText = segment.text.trim();

    // If this is the start of a new sentence
    if (currentSentence === '') {
      currentStartTime = segment.start;
    }

    currentSentence += (currentSentence ? ' ' : '') + segmentText;

    // Check if this segment ends a sentence (contains punctuation)
    const endsWithPunctuation = /[.!?。！？]$/.test(segmentText);

    // Or if the sentence is getting too long (more than 20 words)
    const wordCount = currentSentence.split(/\s+/).length;
    const isTooLong = wordCount > 20;

    if (endsWithPunctuation || isTooLong) {
      // Complete the current sentence
      sentences.push({
        sentenceId,
        text: currentSentence.trim(),
        startTime: currentStartTime,
        endTime: segment.end,
      });

      // Reset for next sentence
      currentSentence = '';
      sentenceId++;
    }
  }

  // Handle any remaining text as the last sentence
  if (currentSentence.trim() && sentences.length < maxSentences) {
    const lastSegment = segments[segments.length - 1];
    sentences.push({
      sentenceId,
      text: currentSentence.trim(),
      startTime: currentStartTime,
      endTime: lastSegment?.end || currentStartTime + 5, // fallback duration
    });
  }

  return sentences;
}

/**
 * Generate audio segments from original audio file
 * Uses FFmpeg for actual audio segmentation
 * @param originalAudioUrl - URL of the original audio file
 * @param courseId - Course ID for organizing segmented files
 * @param sentences - Sentences with timing information
 * @returns URLs of generated audio segments
 */
export async function generateAudioSegments(
  originalAudioUrl: string,
  courseId: string,
  sentences: Array<{
    sentenceId: number;
    text: string;
    startTime: number;
    endTime: number;
  }>
): Promise<Array<{
  sentenceId: number;
  audioUrl: string;
}>> {
  // Import audio segmentation service
  const { segmentAndUploadAudio, checkFFmpegAvailability } = await import('@/lib/audio-segmentation');

  console.log('[openai] Starting audio segmentation process');
  console.log('[openai] Original audio URL:', originalAudioUrl);
  console.log('[openai] Sentences to segment:', sentences.length);

  try {
    // Check if FFmpeg is available
    const ffmpegAvailable = await checkFFmpegAvailability();
    
    if (!ffmpegAvailable) {
      console.warn('[openai] FFmpeg not available, falling back to original audio');
      // Fallback: Use original audio URL for all sentences
      return sentences.map(sentence => ({
        sentenceId: sentence.sentenceId,
        audioUrl: originalAudioUrl,
      }));
    }

    // Prepare segments for audio processing
    const audioSegments = sentences.map(sentence => ({
      sentenceId: sentence.sentenceId,
      text: sentence.text,
      startTime: sentence.startTime,
      endTime: sentence.endTime,
    }));

    // Perform actual audio segmentation
    console.log('[openai] Performing FFmpeg audio segmentation...');
    const segmentedAudio = await segmentAndUploadAudio(
      originalAudioUrl,
      courseId,
      audioSegments
    );

    // Convert to expected format
    const result = segmentedAudio.map(segment => ({
      sentenceId: segment.sentenceId,
      audioUrl: segment.audioUrl,
    }));

    console.log(`[openai] Audio segmentation completed: ${result.length}/${sentences.length} segments created`);
    return result;

  } catch (error) {
    console.error('[openai] Audio segmentation failed, falling back to original audio:', error);
    
    // Fallback: Use original audio URL for all sentences
    return sentences.map(sentence => ({
      sentenceId: sentence.sentenceId,
      audioUrl: originalAudioUrl,
    }));
  }
}

/**
 * Check if OpenAI API is configured
 * @returns True if API key is available
 */
export function isOpenAIConfigured(): boolean {
  return !!openai;
}
