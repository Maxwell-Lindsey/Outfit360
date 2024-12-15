// src/utils/imageProcessing.ts

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as poseDetection from '@tensorflow-models/pose-detection';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

let faceModel: faceDetection.FaceDetector | null = null;
let bodyModel: poseDetection.PoseDetector | null = null;

async function loadFaceModel() {
  if (!faceModel) {
    await tf.ready();
    faceModel = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: 'tfjs',
      }
    );
  }
  return faceModel;
}

async function loadBodyModel() {
  if (!bodyModel) {
    await tf.ready();
    // Using BlazePose 'full' model type to ensure we get comprehensive keypoints, including the head
    bodyModel = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: 'tfjs',
      modelType: 'full',
    });
  }
  return bodyModel;
}

async function detectFaces(imageBuffer: Buffer, width: number, height: number) {
  await loadFaceModel();

  const detectionImage = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(
    new Uint8Array(detectionImage.data),
    [detectionImage.info.height, detectionImage.info.width, 3]
  );

  const faces = await faceModel?.estimateFaces(tensor);
  tensor.dispose();

  if (!faces || faces.length === 0) {
    return [];
  }

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

  return scaledFaces;
}

async function detectBody(imageBuffer: Buffer, width: number, height: number) {
  await loadBodyModel();

  const detectionImage = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(
    new Uint8Array(detectionImage.data),
    [detectionImage.info.height, detectionImage.info.width, 3]
  );

  const poses = await bodyModel?.estimatePoses(tensor);
  tensor.dispose();

  if (!poses || poses.length === 0) {
    return null;
  }

  // Assume first pose is main subject
  const pose = poses[0];
  if (!pose.keypoints || pose.keypoints.length === 0) {
    return null;
  }

  const xs = pose.keypoints.map((kp: { x: number }) => kp.x);
  const ys = pose.keypoints.map((kp: { y: number }) => kp.y);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const scaleX = width / detectionImage.info.width;
  const scaleY = height / detectionImage.info.height;

  const bodyBox = {
    xMin: Math.round(minX * scaleX),
    yMin: Math.round(minY * scaleY),
    width: Math.round((maxX - minX) * scaleX),
    height: Math.round((maxY - minY) * scaleY),
  };

  // Validate and clamp body box
  const clampedBodyBox = clampBox(bodyBox, width, height);

  // If clamped box has non-positive dimensions, consider no valid body
  if (clampedBodyBox.width <= 0 || clampedBodyBox.height <= 0) {
    return null;
  }

  return clampedBodyBox;
}

function clampBox(
  box: { xMin: number; yMin: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): { xMin: number; yMin: number; width: number; height: number } {
  let { xMin, yMin, width, height } = box;

  // Clamp xMin, yMin
  xMin = Math.max(0, xMin);
  yMin = Math.max(0, yMin);

  // Ensure width/height fit inside the image
  if (xMin + width > imageWidth) {
    width = imageWidth - xMin;
  }
  if (yMin + height > imageHeight) {
    height = imageHeight - yMin;
  }

  // Ensure positive dimensions
  width = Math.max(0, width);
  height = Math.max(0, height);

  return { xMin, yMin, width, height };
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
    const imageBuffer = await fs.readFile(inputPath);

    let outputImage = sharp(imageBuffer);

    let bodyBox: { xMin: number; yMin: number; width: number; height: number } | null = null;
    if (blurBackground) {
      bodyBox = await detectBody(imageBuffer, width, height);

      if (bodyBox) {
        const blurredFullImage = await sharp(imageBuffer)
          .blur(40)
          .toBuffer();

        // Clamp the bodyBox again just to be extra safe
        bodyBox = clampBox(bodyBox, width, height);

        // Only extract if box is valid
        if (bodyBox.width > 0 && bodyBox.height > 0) {
          const bodyRegion = await sharp(imageBuffer)
            .extract({
              left: bodyBox.xMin,
              top: bodyBox.yMin,
              width: bodyBox.width,
              height: bodyBox.height,
            })
            .toBuffer();

          outputImage = sharp(blurredFullImage).composite([
            {
              input: bodyRegion,
              top: bodyBox.yMin,
              left: bodyBox.xMin,
            },
          ]);
        } else {
          // If bodyBox is not valid, just blur everything
          outputImage = sharp(imageBuffer).blur(40);
        }
      } else {
        outputImage = outputImage.blur(40);
      }
    }

    if (blurFace) {
      const faces = await detectFaces(imageBuffer, width, height);
      if (faces.length > 0) {
        let currentImageBuffer = await outputImage.toBuffer();

        for (const face of faces) {
          const faceBox = clampBox(face.box, width, height);
          if (faceBox.width > 0 && faceBox.height > 0) {
            const blurredFace = await sharp(currentImageBuffer)
              .extract({
                left: faceBox.xMin,
                top: faceBox.yMin,
                width: faceBox.width,
                height: faceBox.height,
              })
              .blur(40)
              .toBuffer();

            const temp = sharp(currentImageBuffer).composite([
              {
                input: blurredFace,
                top: faceBox.yMin,
                left: faceBox.xMin,
              },
            ]);
            currentImageBuffer = await temp.toBuffer();
          }
        }

        outputImage = sharp(currentImageBuffer);
      }
    }

    await outputImage.jpeg().toFile(outputPath);
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
