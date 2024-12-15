// src/app/components/FaceDetection.tsx

import React, { useRef, useEffect } from 'react';
import type { Face } from '@tensorflow-models/face-detection';

interface FaceDetectionProps {
  imageUrl: string;
  detections: Face[];
}

const drawFaceDetections = (
  ctx: CanvasRenderingContext2D,
  detections: Face[],
  image: HTMLImageElement
) => {
  detections.forEach((detection) => {
    const keypoints = detection.keypoints;
    if (!keypoints || keypoints.length === 0) return;

    const { box } = detection;
    const { xMin, yMin, width, height } = box;

    // Create face mask canvas
    const faceMaskCanvas = document.createElement('canvas');
    faceMaskCanvas.width = ctx.canvas.width;
    faceMaskCanvas.height = ctx.canvas.height;
    const faceMaskCtx = faceMaskCanvas.getContext('2d', { willReadFrequently: true });
    if (!faceMaskCtx) return;

    faceMaskCtx.clearRect(0, 0, faceMaskCanvas.width, faceMaskCanvas.height);
    faceMaskCtx.fillStyle = 'white';
    faceMaskCtx.beginPath();
    faceMaskCtx.moveTo(keypoints[0].x, keypoints[0].y);
    for (let i = 1; i < keypoints.length; i++) {
      faceMaskCtx.lineTo(keypoints[i].x, keypoints[i].y);
    }
    faceMaskCtx.closePath();
    faceMaskCtx.fill();

    // Create a separate canvas for the blurred image
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = ctx.canvas.width;
    blurCanvas.height = ctx.canvas.height;
    const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
    if (!blurCtx) return;

    // Draw the original image onto blur canvas
    blurCtx.drawImage(image, 0, 0);

    // Apply heavy blur multiple times
    blurCtx.filter = 'blur(50px)';
    blurCtx.drawImage(blurCanvas, 0, 0);
    blurCtx.filter = 'blur(50px)';
    blurCtx.drawImage(blurCanvas, 0, 0);
    blurCtx.filter = 'blur(50px)';
    blurCtx.drawImage(blurCanvas, 0, 0);
    blurCtx.filter = 'none'; // reset filter

    // Pixelate the face region on the blurred image
    const regionData = blurCtx.getImageData(xMin, yMin, width, height);
    const pixelSize = 20;
    for (let py = 0; py < height; py += pixelSize) {
      for (let px = 0; px < width; px += pixelSize) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < pixelSize && py + i < height; i++) {
          for (let j = 0; j < pixelSize && px + j < width; j++) {
            const idx = ((py + i) * width + (px + j)) * 4;
            r += regionData.data[idx];
            g += regionData.data[idx + 1];
            b += regionData.data[idx + 2];
            count++;
          }
        }
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        for (let i = 0; i < pixelSize && py + i < height; i++) {
          for (let j = 0; j < pixelSize && px + j < width; j++) {
            const idx = ((py + i) * width + (px + j)) * 4;
            regionData.data[idx] = r;
            regionData.data[idx + 1] = g;
            regionData.data[idx + 2] = b;
          }
        }
      }
    }
    blurCtx.putImageData(regionData, xMin, yMin);

    // Mask the blurred image so only face region remains
    blurCtx.globalCompositeOperation = 'destination-in';
    blurCtx.drawImage(faceMaskCanvas, 0, 0);

    // Reset the composite operation
    blurCtx.globalCompositeOperation = 'source-over';

    // Draw the masked blurred face over the original image on the main canvas
    ctx.drawImage(blurCanvas, 0, 0);
  });
};

const FaceDetection: React.FC<FaceDetectionProps> = ({ imageUrl, detections }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new Image();
    image.src = imageUrl;
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw the original image first
      ctx.drawImage(image, 0, 0);

      // Now draw the blurred face overlays
      drawFaceDetections(ctx, detections, image);
    };
  }, [imageUrl, detections]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />;
};

export default FaceDetection;
