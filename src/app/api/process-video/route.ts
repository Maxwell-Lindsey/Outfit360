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
    
    // Get video duration using ffprobe
    const durationCommand = `"${ffmpegPath}" -i "${videoPath}" 2>&1 | grep "Duration"`;
    const { stdout: durationOutput } = await execAsync(durationCommand);
    const durationMatch = durationOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}.\d{2})/);
    
    if (!durationMatch) {
      throw new Error('Could not determine video duration');
    }
    
    // Calculate total seconds from duration
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseFloat(durationMatch[3]);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
    // Calculate timestamps for 16 evenly distributed frames
    const frameCount = 16;
    const interval = totalSeconds / (frameCount - 1); // -1 to include both start and end frames
    
    // Extract frames at specific timestamps
    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * interval;
      const outputPath = path.join(outputDir, `frame_${String(i).padStart(4, '0')}.jpg`);
      const command = `"${ffmpegPath}" -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
      await execAsync(command);
    }
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