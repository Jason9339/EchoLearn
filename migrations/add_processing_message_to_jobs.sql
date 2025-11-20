-- Add processing_message column to audio_processing_jobs table
-- This will store messages like "Processed with mock data" or "Processed with OpenAI Whisper"

ALTER TABLE audio_processing_jobs
ADD COLUMN IF NOT EXISTS processing_message TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN audio_processing_jobs.processing_message IS 'Message describing how the audio was processed (e.g., mock data vs real OpenAI API)';
