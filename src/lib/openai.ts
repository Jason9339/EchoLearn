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
  const sentences: Array<{
    sentenceId: number;
    text: string;
    startTime: number;
    endTime: number;
  }> = [];

  let currentSentence = '';
  let currentStartTime = 0;
  let sentenceId = 1;

  for (const segment of segments) {
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
 * Currently uses the original audio URL for all sentences as a temporary solution
 * @param originalAudioUrl - URL of the original audio file
 * @param sentences - Sentences with timing information
 * @returns URLs of generated audio segments
 */
export async function generateAudioSegments(
  originalAudioUrl: string,
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
  // TODO: Implement actual audio segmentation with ffmpeg
  // This would require:
  // 1. Download original audio file
  // 2. Use ffmpeg or similar to extract segments based on startTime/endTime
  // 3. Upload segments to Supabase Storage
  // 4. Return URLs of uploaded segments

  console.log('Audio segmentation not yet implemented - using original audio for all sentences');
  console.log('Original audio URL:', originalAudioUrl);
  console.log('Sentences to segment:', sentences.length);

  // Temporary solution: Use the original audio URL for all sentences
  // This allows users to hear the full audio for each sentence
  return sentences.map(sentence => ({
    sentenceId: sentence.sentenceId,
    audioUrl: originalAudioUrl, // Use original audio instead of placeholder
  }));
}

/**
 * Check if OpenAI API is configured
 * @returns True if API key is available
 */
export function isOpenAIConfigured(): boolean {
  return !!openai;
}
