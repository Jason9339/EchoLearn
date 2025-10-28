import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/courses/temp-upload/[tempId]
 * Get temporary upload information
 * Returns JSON: { success, audioUrl, fileName, fileSize }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tempId: string }> }
): Promise<Response> {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    const { tempId } = await params;

    // List files in the temp upload directory
    const supabase = getSupabaseAdmin();
    const { data: files, error } = await supabase.storage
      .from('recordings')
      .list(`course-uploads/${tempId}`, {
        limit: 1,
      });

    if (error || !files || files.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Temporary upload not found' 
      }, { status: 404 });
    }

    const file = files[0];
    const storagePath = `course-uploads/${tempId}/${file.name}`;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(storagePath);

    return Response.json({
      success: true,
      audioUrl: urlData.publicUrl,
      fileName: file.name,
      fileSize: file.metadata?.size || 0,
    });

  } catch (error) {
    console.error('Get temp upload error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
