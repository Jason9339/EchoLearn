-- Create AI Scores Table
-- This table stores AI scoring results for user recordings
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS ai_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    course_id TEXT NOT NULL,
    sentence_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,
    score DECIMAL(3, 2) NOT NULL CHECK (score >= 0 AND score <= 5), -- AI score from 0.00 to 5.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique score per user, course, sentence, and slot
    UNIQUE(user_id, course_id, sentence_id, slot_index)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_scores_user_id ON ai_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_course_id ON ai_scores(course_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_user_course ON ai_scores(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_user_course_sentence ON ai_scores(user_id, course_id, sentence_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_ai_scores_updated_at
    BEFORE UPDATE ON ai_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE ai_scores ENABLE ROW LEVEL SECURITY;

-- Users can only access their own scores
CREATE POLICY "Users can view own ai_scores" ON ai_scores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_scores" ON ai_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_scores" ON ai_scores
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai_scores" ON ai_scores
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE ai_scores IS 'Stores AI-generated pronunciation scores for user recordings';
COMMENT ON COLUMN ai_scores.score IS 'AI score from 0.00 to 5.00, rounded to 2 decimal places';
COMMENT ON COLUMN ai_scores.course_id IS 'Course ID (can be custom course UUID or default course string)';
COMMENT ON COLUMN ai_scores.sentence_id IS 'Sentence ID within the course';
COMMENT ON COLUMN ai_scores.slot_index IS 'Recording slot index (0-3)';
