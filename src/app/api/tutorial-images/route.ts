import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Helper function to get image paths from a directory
async function getImagePaths(directoryPath: string, baseUrl: string) {
  try {
    const files = await fs.readdir(directoryPath);
    const imageFiles = files
      .filter(file => /\.(png|jpe?g|gif|webp|svg)$/i.test(file))
      .sort(); // Sort alphabetically

    return imageFiles.map(file => `${baseUrl}/${file}`);
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}:`, error);
    return [];
  }
}

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public');

  // Course Tutorial Images
  const courseTutorialDir = path.join(publicDir, 'course-tutorial-images');
  const courseTutorialImages = await getImagePaths(courseTutorialDir, '/course-tutorial-images');

  // Recording Tutorial Images
  const recordingTutorialDir = path.join(publicDir, 'recording-tutorial-images');
  const recordingTutorialImages = await getImagePaths(recordingTutorialDir, '/recording-tutorial-images');

  // Peer Review Tutorial Images
  const peerReviewTutorialDir = path.join(publicDir, 'peer-review-tutorial-images');
  const peerReviewTutorialImages = await getImagePaths(peerReviewTutorialDir, '/peer-review-tutorial-images');

  return NextResponse.json({
    courseTutorialImages,
    recordingTutorialImages,
    peerReviewTutorialImages,
  });
}
