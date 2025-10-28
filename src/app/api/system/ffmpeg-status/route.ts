import { NextResponse } from 'next/server';
import { getFFmpegInfo } from '@/lib/audio-segmentation';

/**
 * GET /api/system/ffmpeg-status
 * Check FFmpeg availability and get system information
 * Returns JSON: { available, version, formats, error }
 */
export async function GET(): Promise<Response> {
  try {
    console.log('[ffmpeg-status] Checking FFmpeg availability...');
    
    const ffmpegInfo = await getFFmpegInfo();
    
    console.log('[ffmpeg-status] FFmpeg info:', ffmpegInfo);
    
    return NextResponse.json({
      success: true,
      ffmpeg: ffmpegInfo,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[ffmpeg-status] Error checking FFmpeg:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ffmpeg: { available: false },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
