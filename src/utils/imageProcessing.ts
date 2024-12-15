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

  // Ensure the canvas starts transparent
  ctx.clearRect(0, 0, width, height);

  // Draw the face region in white on a transparent background
  ctx.fillStyle = 'white';

  for (const face of faces) {
    const box = face.box;
    ctx.beginPath();
    ctx.ellipse(
      box.xMin + box.width / 2,
      box.yMin + box.height / 2,
      box.width / 2,
      box.height / 2,
      0,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }

  // Export the mask as a PNG with transparency
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

      // Prepare image for face detection
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
        // Scale face coordinates back to original size
        const scaleX = width / detectionImage.info.width;
        const scaleY = height / detectionImage.info.height;

        const scaledFaces = faces.map(face => ({
          ...face,
          box: {
            xMin: Math.round(face.box.xMin * scaleX),
            yMin: Math.round(face.box.yMin * scaleY),
            width: Math.round(face.box.width * scaleX),
            height: Math.round(face.box.height * scaleY),
          },
          keypoints: face.keypoints?.map(kp => ({
            x: kp.x * scaleX,
            y: kp.y * scaleY,
          })),
        })) as faceDetection.Face[];

        // Start with the original image
        let outputImage = sharp(imageBuffer);

        // Process each face
        for (const face of scaledFaces) {
          const { box } = face;
          
          // Extract and blur the face region
          const blurredFace = await sharp(imageBuffer)
            .extract({
              left: box.xMin,
              top: box.yMin,
              width: box.width,
              height: box.height
            })
            .blur(40)
            .toBuffer();

          // Composite the blurred face back onto the original image
          outputImage = outputImage.composite([
            {
              input: blurredFace,
              top: box.yMin,
              left: box.xMin,
            }
          ]);
        }

        // Output the final image
        await outputImage
          .jpeg()
          .toFile(outputPath);
      } else {
        // No faces detected, just output the original image
        await sharp(imageBuffer).toFile(outputPath);
      }
    } else if (blurBackground) {
      // If implementing background blur in the future, apply similar logic
      await image.toFile(outputPath);
    } else {
      // No modifications
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
