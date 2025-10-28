import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/app/lib/supabase';
import { validateAudioFile } from '@/app/lib/audio';
import type { UploadAudioResponse } from '@/app/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/courses/upload-audio
 * Upload audio file for course creation
 * Accepts multipart/form-data: audio (file)
 * Returns JSON: { success, tempId, audioUrl, duration, fileSize }
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    } as UploadAudioResponse, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('audio');

    if (!(file instanceof File)) {
      return Response.json({ 
        success: false, 
        error: 'Missing audio file' 
      } as UploadAudioResponse, { status: 400 });
    }

    // Validate file properties (increased size limit for course audio)
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    const { isValid, error } = validateAudioFile(file, maxSizeBytes);
    if (!isValid) {
      return Response.json({ 
        success: false, 
        error 
      } as UploadAudioResponse, { status: 400 });
    }

    // Generate temporary ID for this upload session
    const tempId = uuidv4();

    // Upload file to Supabase Storage
    const supabase = getSupabaseAdmin();
    const fileName = `${tempId}_${file.name}`;
    const storagePath = `course-uploads/${tempId}/${fileName}`;
    
    console.log(`[upload-audio] Uploading file:`, {
      tempId,
      fileName,
      storagePath,
      fileSize: file.size,
      fileType: file.type
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return Response.json({ 
        success: false, 
        error: 'Failed to upload audio file' 
      } as UploadAudioResponse, { status: 500 });
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // Get audio duration (approximate based on file size and format)
    // TODO: Implement actual audio duration detection
    const estimatedDuration = Math.floor(file.size / (128 * 1024 / 8)); // rough estimate for 128kbps

    console.log(`[upload-audio] Upload successful:`, {
      tempId,
      audioUrl,
      storagePath,
      duration: estimatedDuration
    });

    return Response.json({
      success: true,
      tempId,
      audioUrl,
      duration: estimatedDuration,
      fileSize: file.size,
    } as UploadAudioResponse);

  } catch (error) {
    console.error('Audio upload error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    } as UploadAudioResponse, { status: 500 });
  }
}
