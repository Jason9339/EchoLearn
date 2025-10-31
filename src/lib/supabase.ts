import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration
 * Uses environment variables for authentication and connection
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables. Please check your .env file.'
  );
}

/**
 * Supabase client for client-side operations (browser)
 * Uses anon key for public operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase client for server-side operations (API routes)
 * Uses service role key for admin operations
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);


/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  RECORDINGS: 'audio-recordings',
} as const;

/**
 * Initialize storage bucket if it doesn't exist
 * This should be called once during setup
 */
export async function initializeStorageBucket(): Promise<void> {
  try {
    const { data: _bucket, error } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKETS.RECORDINGS);
    
    if (error && error.message.includes('not found')) {
      // Create bucket if it doesn't exist
      const { error: createError } = await supabaseAdmin.storage.createBucket(
        STORAGE_BUCKETS.RECORDINGS,
        {
          public: false, // Private bucket for user recordings
          fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
          allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'],
        }
      );
      
      if (createError) {
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
      
      console.log('✅ Storage bucket created successfully');
    } else if (error) {
      throw new Error(`Failed to check storage bucket: ${error.message}`);
    } else {
      console.log('✅ Storage bucket already exists');
    }
  } catch (error) {
    console.error('❌ Failed to initialize storage bucket:', error);
    throw error;
  }
}

/**
 * Upload audio file to Supabase Storage
 * @param file - Audio file to upload
 * @param filePath - Path in storage bucket
 * @param options - Upload options
 * @returns Upload result with public URL
 */
export async function uploadAudioFile(
  file: File | Buffer,
  filePath: string,
  options: {
    upsert?: boolean;
    contentType?: string;
  } = {}
): Promise<{
  data: { path: string } | null;
  error: unknown;
  publicUrl?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.RECORDINGS)
      .upload(filePath, file, {
        upsert: options.upsert ?? true,
        contentType: options.contentType ?? 'audio/webm',
        cacheControl: '3600',
      });

    if (error) {
      return { data: null, error };
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKETS.RECORDINGS)
      .getPublicUrl(filePath);

    return {
      data,
      error: null,
      publicUrl: urlData.publicUrl,
    };
  } catch (error) {
    return {
      data: null,
      error,
    };
  }
}

/**
 * Delete audio file from Supabase Storage
 * @param filePath - Path of file to delete
 * @returns Deletion result
 */
export async function deleteAudioFile(filePath: string): Promise<{
  data: unknown;
  error: unknown;
}> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.RECORDINGS)
      .remove([filePath]);

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Get signed URL for private audio file
 * @param filePath - Path of file in storage
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL for private access
 */
export async function getSignedAudioUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{
  data: { signedUrl: string } | null;
  error: unknown;
}> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.RECORDINGS)
      .createSignedUrl(filePath, expiresIn);

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}


