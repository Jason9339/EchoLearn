-- EchoLearn Database Schema
-- This file contains the complete database schema for the EchoLearn application
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sentence_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,
    audio_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0, -- milliseconds
    file_size INTEGER NOT NULL DEFAULT 0, -- bytes
    label TEXT NOT NULL CHECK (label IN ('official', 'test')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique recording per user, sentence, and slot
    UNIQUE(user_id, sentence_id, slot_index)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_sentence_id ON recordings(sentence_id);
CREATE INDEX IF NOT EXISTS idx_recordings_user_sentence ON recordings(user_id, sentence_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);
CREATE INDEX IF NOT EXISTS idx_recordings_label ON recordings(label);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at 
    BEFORE UPDATE ON recordings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies for Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Recordings policies
CREATE POLICY "Users can view own recordings" ON recordings
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own recordings" ON recordings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own recordings" ON recordings
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own recordings" ON recordings
    FOR DELETE USING (auth.uid()::text = user_id);

-- Create storage bucket for audio files
-- Note: This needs to be run in Supabase Storage section, not SQL editor
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('audio-recordings', 'audio-recordings', false);

-- Create storage policies for audio files
-- Note: These also need to be run in Supabase Storage section
-- CREATE POLICY "Users can upload own audio files" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own audio files" ON storage.objects
--     FOR SELECT USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can update own audio files" ON storage.objects
--     FOR UPDATE USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete own audio files" ON storage.objects
--     FOR DELETE USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Insert some sample data for testing (optional)
-- INSERT INTO users (id, email, name) VALUES 
--     ('test-user-1', 'test1@example.com', 'Test User 1'),
--     ('test-user-2', 'test2@example.com', 'Test User 2')
-- ON CONFLICT (id) DO NOTHING;

-- Sample recordings (optional)
-- INSERT INTO recordings (user_id, sentence_id, slot_index, audio_url, file_path, duration, file_size, label) VALUES
--     ('test-user-1', 1, 0, 'https://example.com/audio1.webm', 'user/test-user-1/sentence/1/test-recording.webm', 5000, 102400, 'test'),
--     ('test-user-1', 1, 3, 'https://example.com/audio2.webm', 'user/test-user-1/sentence/1/official-recording.webm', 4800, 98304, 'official')
-- ON CONFLICT (user_id, sentence_id, slot_index) DO NOTHING;


