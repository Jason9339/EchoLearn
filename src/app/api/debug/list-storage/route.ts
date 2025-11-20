import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/app/lib/supabase';

/**
 * GET /api/debug/list-storage
 * List all files in the course-uploads directory for debugging
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return Response.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // List all course-uploads directories
    const { data: folders, error: foldersError } = await supabase.storage
      .from('recordings')
      .list('course-uploads', {
        limit: 100,
      });

    if (foldersError) {
      return Response.json({
        success: false,
        error: foldersError.message,
      });
    }

    const allFiles = [];
    
    // For each folder, list the files inside
    for (const folder of folders || []) {
      if (folder.name) {
        const { data: files, error: filesError } = await supabase.storage
          .from('recordings')
          .list(`course-uploads/${folder.name}`, {
            limit: 10,
          });

        if (!filesError && files) {
          allFiles.push({
            tempId: folder.name,
            files: files.map(file => ({
              name: file.name,
              size: file.metadata?.size || 0,
              lastModified: file.updated_at,
            })),
          });
        }
      }
    }

    return Response.json({
      success: true,
      totalFolders: folders?.length || 0,
      uploads: allFiles,
    });

  } catch (error) {
    console.error('Debug list storage error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
