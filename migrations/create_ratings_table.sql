-- Create ratings table for recording ratings
-- Each recording can have multiple ratings from different users

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  recording_id UUID NOT NULL,
  rater_user_id UUID NOT NULL,
  sentence_id INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one rating per user per recording
  UNIQUE (recording_id, rater_user_id)
);

-- Index for faster queries by recording
CREATE INDEX IF NOT EXISTS idx_ratings_recording_id ON ratings(recording_id);

-- Index for faster queries by rater
CREATE INDEX IF NOT EXISTS idx_ratings_rater_user_id ON ratings(rater_user_id);

-- Index for faster queries by sentence and slot
CREATE INDEX IF NOT EXISTS idx_ratings_sentence_slot ON ratings(sentence_id, slot_index);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ratings_updated_at_trigger
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_ratings_updated_at();
