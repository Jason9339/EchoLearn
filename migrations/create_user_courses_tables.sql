-- Create user_courses table for custom courses
CREATE TABLE IF NOT EXISTS user_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  max_sentences INTEGER NOT NULL CHECK (max_sentences IN (5,10,15,20,25,30)),
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  original_audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create course_sentences table for course content
CREATE TABLE IF NOT EXISTS course_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES user_courses(id) ON DELETE CASCADE,
  sentence_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  audio_url TEXT,
  start_time DECIMAL(10,3), -- seconds
  end_time DECIMAL(10,3),   -- seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, sentence_id)
);

-- Create audio_processing_jobs table for background processing
CREATE TABLE IF NOT EXISTS audio_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES user_courses(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_courses_user_id ON user_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_courses_status ON user_courses(status);
CREATE INDEX IF NOT EXISTS idx_course_sentences_course_id ON course_sentences(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sentences_order ON course_sentences(course_id, sentence_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON audio_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_course_id ON audio_processing_jobs(course_id);

-- Add updated_at trigger for user_courses
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_courses_updated_at 
    BEFORE UPDATE ON user_courses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_processing_jobs_updated_at 
    BEFORE UPDATE ON audio_processing_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
