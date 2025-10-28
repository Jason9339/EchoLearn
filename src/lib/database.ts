import { supabaseAdmin } from './supabase';
import type { 
  RecordingRecord, 
  InsertRecordingRecord, 
  UpdateRecordingRecord,
  UserRecord,
  InsertUserRecord,
  UpdateUserRecord 
} from '@/types/database';

/**
 * Database operations for recordings
 */
export class RecordingService {
  /**
   * Create a new recording record
   * @param recordingData - Recording data to insert
   * @returns Created recording record
   */
  static async createRecording(
    recordingData: InsertRecordingRecord
  ): Promise<RecordingRecord> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .insert(recordingData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create recording: ${error.message}`);
    }

    return data;
  }

  /**
   * Get recording by ID
   * @param recordingId - Recording ID
   * @returns Recording record or null
   */
  static async getRecording(recordingId: string): Promise<RecordingRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get recording: ${error.message}`);
    }

    return data;
  }

  /**
   * Get recordings by user ID
   * @param userId - User ID
   * @param limit - Maximum number of records to return
   * @param offset - Number of records to skip
   * @returns Array of recording records
   */
  static async getUserRecordings(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<RecordingRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get user recordings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recordings by sentence ID and user ID
   * @param sentenceId - Sentence ID
   * @param userId - User ID
   * @returns Array of recording records for the sentence
   */
  static async getSentenceRecordings(
    sentenceId: number,
    userId: string
  ): Promise<RecordingRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('sentence_id', sentenceId)
      .eq('user_id', userId)
      .order('slot_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to get sentence recordings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update recording record
   * @param recordingId - Recording ID
   * @param updates - Fields to update
   * @returns Updated recording record
   */
  static async updateRecording(
    recordingId: string,
    updates: UpdateRecordingRecord
  ): Promise<RecordingRecord> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update recording: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete recording record
   * @param recordingId - Recording ID
   * @returns Success status
   */
  static async deleteRecording(recordingId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('recordings')
      .delete()
      .eq('id', recordingId);

    if (error) {
      throw new Error(`Failed to delete recording: ${error.message}`);
    }

    return true;
  }

  /**
   * Upsert recording (insert or update if exists)
   * @param recordingData - Recording data
   * @param conflictColumns - Columns to check for conflicts
   * @returns Recording record
   */
  static async upsertRecording(
    recordingData: InsertRecordingRecord,
    conflictColumns: string[] = ['user_id', 'sentence_id', 'slot_index']
  ): Promise<RecordingRecord> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .upsert(recordingData, {
        onConflict: conflictColumns.join(','),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert recording: ${error.message}`);
    }

    return data;
  }

  /**
   * Get recording statistics for a user
   * @param userId - User ID
   * @returns Recording statistics
   */
  static async getUserRecordingStats(userId: string): Promise<{
    totalRecordings: number;
    totalDuration: number;
    averageDuration: number;
    recordingsByLabel: { official: number; test: number };
  }> {
    const { data, error } = await supabaseAdmin
      .from('recordings')
      .select('duration, label')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get recording stats: ${error.message}`);
    }

    const recordings = data || [];
    const totalRecordings = recordings.length;
    const totalDuration = recordings.reduce((sum, rec) => sum + rec.duration, 0);
    const averageDuration = totalRecordings > 0 ? totalDuration / totalRecordings : 0;
    
    const recordingsByLabel = recordings.reduce(
      (acc, rec) => {
        acc[rec.label]++;
        return acc;
      },
      { official: 0, test: 0 }
    );

    return {
      totalRecordings,
      totalDuration,
      averageDuration,
      recordingsByLabel,
    };
  }
}

/**
 * Database operations for users
 */
export class UserService {
  /**
   * Create or update user record
   * @param userData - User data
   * @returns User record
   */
  static async upsertUser(userData: InsertUserRecord): Promise<UserRecord> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(userData, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert user: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User record or null
   */
  static async getUser(userId: string): Promise<UserRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data;
  }

  /**
   * Update user record
   * @param userId - User ID
   * @param updates - Fields to update
   * @returns Updated user record
   */
  static async updateUser(
    userId: string,
    updates: UpdateUserRecord
  ): Promise<UserRecord> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }
}


