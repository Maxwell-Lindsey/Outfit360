import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';

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
    const { id, format } = await request.json();

    if (!id || !format || !['gif', 'mp4'].includes(format)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', id);
    const framesDir = path.join(uploadsDir, 'processed-frames');
    const rawFramesDir = path.join(uploadsDir, 'raw-frames');
    
    // Use processed frames if they exist, otherwise use raw frames
    const sourceDir = await fs.access(framesDir)
      .then(() => framesDir)
      .catch(() => rawFramesDir);

    const outputPath = path.join(uploadsDir, `output.${format}`);
    const frameListPath = path.join(uploadsDir, 'frames.txt');

    // Create a file list for ffmpeg
    const frames = await fs.readdir(sourceDir);
    const sortedFrames = frames
      .filter(frame => frame.endsWith('.jpg'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

    await fs.writeFile(
      frameListPath,
      sortedFrames.map(frame => `file '${path.join(sourceDir, frame)}'`).join('\n')
    );

    // Ensure ffmpeg is executable
    try {
      await execAsync(`chmod +x "${ffmpegPath}"`);
    } catch (error) {
      console.warn('Failed to set executable permission on ffmpeg:', error);
    }

    if (format === 'gif') {
      // Create high-quality GIF using ffmpeg with palette generation
      const paletteFile = path.join(uploadsDir, 'palette.png');
      
      // Generate palette for better GIF quality
      await execAsync(
        `"${ffmpegPath}" -y -f concat -safe 0 -i "${frameListPath}" ` +
        `-vf "setpts=4*PTS,scale=800:-1:flags=lanczos,palettegen=stats_mode=full" ` +
        `"${paletteFile}"`
      );

      // Create GIF using the palette
      await execAsync(
        `"${ffmpegPath}" -y -f concat -safe 0 -i "${frameListPath}" -i "${paletteFile}" ` +
        `-lavfi "setpts=4*PTS,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ` +
        `-f gif "${outputPath}"`
      );

      // Clean up palette file
      await fs.unlink(paletteFile).catch(console.error);
    } else {
      // Create high-quality MP4
      await execAsync(
        `"${ffmpegPath}" -y -f concat -safe 0 -i "${frameListPath}" ` +
        `-c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p ` +
        `-vf "setpts=4*PTS,scale=1280:-1" ` +
        `-movflags +faststart "${outputPath}"`
      );
    }

    // Clean up frame list file
    await fs.unlink(frameListPath).catch(console.error);

    // Read the output file
    const fileBuffer = await fs.readFile(outputPath);

    // Delete the output file after reading
    await fs.unlink(outputPath).catch(console.error);

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': format === 'gif' ? 'image/gif' : 'video/mp4',
        'Content-Disposition': `attachment; filename="outfit360_${id}.${format}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Error exporting file' },
      { status: 500 }
    );
  }
} 