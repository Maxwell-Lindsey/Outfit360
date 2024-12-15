// src/utils/imageProcessing.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

let model: faceDetection.FaceDetector | null = null;

async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: 'tfjs',
      }
    );
  }
  return model;
}

async function createFaceMask(
  width: number,
  height: number,
  faces: faceDetection.Face[]
): Promise<Buffer> {
  const { createCanvas } = await import('canvas');
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill with black (transparent area in mask)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);
  
  // Draw white face shapes (areas to be blurred)
  ctx.fillStyle = 'white';
  
  for (const face of faces) {
    const keypoints = face.keypoints;
    if (!keypoints || keypoints.length === 0) {
      // Fallback to rectangle if no keypoints
      const box = face.box;
      // Add padding to the face region for better blending
      const padding = {
        x: box.width * 0.2,
        y: box.height * 0.2
      };
      
      ctx.beginPath();
      ctx.ellipse(
        box.xMin + box.width / 2,
        box.yMin + box.height / 2,
        (box.width + padding.x) * 0.6,
        (box.height + padding.y) * 0.8,
        0,
        0,
        2 * Math.PI
      );
      // Add feathering effect
      const gradient = ctx.createRadialGradient(
        box.xMin + box.width / 2, box.yMin + box.height / 2, 
        Math.min(box.width, box.height) * 0.3,
        box.xMin + box.width / 2, box.yMin + box.height / 2, 
        Math.min(box.width, box.height) * 0.8
      );
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
      continue;
    }

    // Create a path for the face shape
    ctx.beginPath();
    ctx.moveTo(keypoints[0].x, keypoints[0].y);
    for (let i = 1; i < keypoints.length; i++) {
      ctx.lineTo(keypoints[i].x, keypoints[i].y);
    }
    ctx.closePath();
    
    // Create a gradient for smooth edge blending
    const bbox = face.box;
    const gradient = ctx.createRadialGradient(
      bbox.xMin + bbox.width / 2, bbox.yMin + bbox.height / 2,
      Math.min(bbox.width, bbox.height) * 0.3,
      bbox.xMin + bbox.width / 2, bbox.yMin + bbox.height / 2,
      Math.min(bbox.width, bbox.height) * 0.8
    );
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  return canvas.toBuffer('image/png');
}

export async function processImage(
  inputPath: string,
  outputPath: string,
  blurFace: boolean,
  blurBackground: boolean
) {
  try {
    const image = await sharp(inputPath);
    const metadata = await image.metadata();
    const { width = 0, height = 0 } = metadata;

    if (blurFace) {
      await loadModel();
      const imageBuffer = await fs.readFile(inputPath);
      
      // Create a normalized version for face detection
      const detectionImage = await sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const tensor = tf.tensor3d(
        new Uint8Array(detectionImage.data),
        [detectionImage.info.height, detectionImage.info.width, 3]
      );

      const faces = await model?.estimateFaces(tensor);
      tensor.dispose();

      if (faces && faces.length > 0) {
        // Scale the face coordinates back to original image size
        const scaleX = width / detectionImage.info.width;
        const scaleY = height / detectionImage.info.height;
        
        const scaledFaces = faces.map(face => ({
          ...face,
          box: {
            xMin: face.box.xMin * scaleX,
            yMin: face.box.yMin * scaleY,
            width: face.box.width * scaleX,
            height: face.box.height * scaleY,
            xMax: (face.box.xMin + face.box.width) * scaleX,
            yMax: (face.box.yMin + face.box.height) * scaleY
          },
          keypoints: face.keypoints?.map(kp => ({
            x: kp.x * scaleX,
            y: kp.y * scaleY,
          })),
        })) as faceDetection.Face[];

        // Create face mask with feathered edges
        const faceMask = await createFaceMask(width, height, scaledFaces);
        
        // Create heavily blurred version of the image
        const blurredImage = await sharp(imageBuffer)
          .blur(40)
          .toBuffer();

        // Process the mask to match the image dimensions
        const processedMask = await sharp(faceMask)
          .resize(width, height)
          .ensureAlpha()
          .raw()
          .toBuffer();

        // Combine the blurred image with the mask
        const maskedBlur = await sharp(blurredImage)
          .ensureAlpha()
          .composite([
            {
              input: processedMask,
              raw: {
                width,
                height,
                channels: 4
              },
              blend: 'dest-in'
            }
          ])
          .toBuffer();

        // Composite the masked blur over the original
        await sharp(imageBuffer)
          .composite([
            {
              input: maskedBlur,
              blend: 'over'
            }
          ])
          .toFile(outputPath);
      } else {
        // No faces detected, just save the original
        await sharp(imageBuffer).toFile(outputPath);
      }
    } else if (blurBackground) {
      await image.toFile(outputPath);
    } else {
      await image.toFile(outputPath);
    }

  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

export async function processFrames(
  inputDir: string,
  outputDir: string,
  blurFace: boolean,
  blurBackground: boolean
) {
  const files = await fs.readdir(inputDir);
  const frameFiles = files.filter(file => file.endsWith('.jpg'));

  for (const file of frameFiles) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    await processImage(inputPath, outputPath, blurFace, blurBackground);
  }
} 