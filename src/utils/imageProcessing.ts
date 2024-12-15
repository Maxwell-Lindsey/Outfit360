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
    // Draw an ellipse for simplicity
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
            xMin: face.box.xMin * scaleX,
            yMin: face.box.yMin * scaleY,
            width: face.box.width * scaleX,
            height: face.box.height * scaleY,
          },
          keypoints: face.keypoints?.map(kp => ({
            x: kp.x * scaleX,
            y: kp.y * scaleY,
          })),
        })) as faceDetection.Face[];

        // Create a mask for the face region
        const faceMask = await createFaceMask(width, height, scaledFaces);

        // Create a heavily blurred version of the entire image, ensuring alpha
        const blurredImage = await sharp(imageBuffer)
          .blur(40)
          .ensureAlpha()
          .toBuffer();

        // Apply the mask with dest-in to isolate the face region in the blurred image
        const maskedBlurredFace = await sharp(blurredImage)
          .composite([
            {
              input: faceMask,
              blend: 'dest-in', // Keeps only pixels where mask is non-transparent
            },
          ])
          .toBuffer();

        // Now composite the masked blurred face over the original image
        // Ensure the original also has alpha so the blending works as expected
        await sharp(imageBuffer)
          .ensureAlpha()
          .composite([
            {
              input: maskedBlurredFace,
              blend: 'over',
            },
          ])
          // Output as JPEG or PNG. JPEG will remove any alpha and show original image outside the face.
          .jpeg()
          .toFile(outputPath);
      } else {
        // No faces detected, just output the original image
        await sharp(imageBuffer).toFile(outputPath);
      }
    } else if (blurBackground) {
      // If implementing background blur, similar logic would apply
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
