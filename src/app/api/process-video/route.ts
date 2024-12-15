// src/app/api/process-video/route.ts
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { processFrames } from '@/utils/imageProcessing';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root directory
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

// Get the ffmpeg path from node_modules
const ffmpegPath = path.join(projectRoot, 'node_modules', 'ffmpeg-static', 'ffmpeg');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const blurFace = formData.get('blurFace') === 'true';
    const blurBackground = formData.get('blurBackground') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Create unique directory for this upload
    const timestamp = Date.now();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', `${timestamp}`);
    await createDirectory(uploadDir);

    // Save the uploaded video
    const videoPath = path.join(uploadDir, 'input.mp4');
    const bytes = await file.arrayBuffer();
    await writeFile(videoPath, Buffer.from(bytes));

    // Extract frames using FFmpeg
    const rawFramesDir = path.join(uploadDir, 'raw-frames');
    const processedFramesDir = path.join(uploadDir, 'processed-frames');
    await createDirectory(rawFramesDir);
    await createDirectory(processedFramesDir);
    
    await extractFrames(videoPath, rawFramesDir);

    // Process frames with ML models if needed
    if (blurFace || blurBackground) {
      await processFrames(rawFramesDir, processedFramesDir, blurFace, blurBackground);
    }

    // Create the frame sequence data
    const frames = await getFramesList(blurFace || blurBackground ? processedFramesDir : rawFramesDir);
    const viewerData = {
      id: timestamp.toString(),
      frames: frames.map((frame: string) => `/uploads/${timestamp}/${(blurFace || blurBackground ? 'processed-frames' : 'raw-frames')}/${frame}`),
      totalFrames: frames.length,
    };

    return NextResponse.json(viewerData);
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { error: 'Error processing video' },
      { status: 500 }
    );
  }
}

async function createDirectory(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
}

async function extractFrames(videoPath: string, outputDir: string) {
  try {
    // Use chmod to ensure the ffmpeg binary is executable
    try {
      await execAsync(`chmod +x "${ffmpegPath}"`);
    } catch (error) {
      console.warn('Failed to set executable permission on ffmpeg:', error);
    }
    
    // Extract 24 frames (for smooth rotation)
    const command = `"${ffmpegPath}" -i "${videoPath}" -vf fps=24 "${path.join(outputDir, 'frame_%04d.jpg')}"`;
    await execAsync(command);
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  }
}

async function getFramesList(framesDir: string) {
  const { readdir } = require('fs/promises');
  const files = await readdir(framesDir);
  return files
    .filter((file: string) => file.endsWith('.jpg'))
    .sort();
} 