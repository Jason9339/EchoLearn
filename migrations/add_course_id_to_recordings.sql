-- Add course_id column to recordings table
ALTER TABLE recordings
ADD COLUMN course_id VARCHAR(255);

-- Update existing records to use default course (shadowing-101)
-- This assumes existing recordings are from the default course
UPDATE recordings
SET course_id = 'shadowing-101'
WHERE course_id IS NULL;

-- Make course_id NOT NULL after backfilling
ALTER TABLE recordings
ALTER COLUMN course_id SET NOT NULL;

-- Drop the old unique constraint
ALTER TABLE recordings
DROP CONSTRAINT IF EXISTS recordings_user_id_sentence_id_slot_index_key;

-- Add new unique constraint including course_id
ALTER TABLE recordings
ADD CONSTRAINT recordings_user_id_course_id_sentence_id_slot_index_key
  UNIQUE (user_id, course_id, sentence_id, slot_index);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_recordings_course_id ON recordings(course_id);
