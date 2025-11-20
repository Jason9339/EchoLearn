/**
 * Database schema types for PostgreSQL tables
 * These types correspond to the actual database structure
 */

export interface Database {
  public: {
    Tables: {
      recordings: {
        Row: {
          id: string;
          user_id: string;
          sentence_id: number;
          slot_index: number;
          audio_url: string;
          file_path: string;
          duration: number; // milliseconds
          file_size: number; // bytes
          label: 'official' | 'test';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sentence_id: number;
          slot_index: number;
          audio_url: string;
          file_path: string;
          duration: number;
          file_size: number;
          label: 'official' | 'test';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sentence_id?: number;
          slot_index?: number;
          audio_url?: string;
          file_path?: string;
          duration?: number;
          file_size?: number;
          label?: 'official' | 'test';
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

/**
 * Recording record type for application use
 */
export type RecordingRecord = Database['public']['Tables']['recordings']['Row'];

/**
 * Insert recording record type
 */
export type InsertRecordingRecord = Database['public']['Tables']['recordings']['Insert'];

/**
 * Update recording record type
 */
export type UpdateRecordingRecord = Database['public']['Tables']['recordings']['Update'];

/**
 * User record type for application use
 */
export type UserRecord = Database['public']['Tables']['users']['Row'];

/**
 * Insert user record type
 */
export type InsertUserRecord = Database['public']['Tables']['users']['Insert'];

/**
 * Update user record type
 */
export type UpdateUserRecord = Database['public']['Tables']['users']['Update'];


