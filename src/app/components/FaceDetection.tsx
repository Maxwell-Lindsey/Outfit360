// src/app/components/FaceDetection.tsx
import type { Face } from '@tensorflow-models/face-detection';

// Import statements remain the same...

const pixelateRegion = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pixelSize: number = 10
) => {
  // Get the specified region of pixels
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  
  // Iterate through pixel blocks
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      // Calculate the average color of the pixel block
      let r = 0, g = 0, b = 0, a = 0;
      let count = 0;
      
      // Sum up the colors in the block
      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const i = ((y + py) * width + (x + px)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }
      
      // Calculate averages
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      a = Math.floor(a / count);
      
      // Apply the average color to all pixels in the block
      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const i = ((y + py) * width + (x + px)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }
  
  // Put the modified pixels back
  ctx.putImageData(imageData, x, y);
};

const drawFaceDetections = (
  ctx: CanvasRenderingContext2D,
  detections: Face[]
) => {
  detections.forEach(detection => {
    const keypoints = detection.keypoints;
    if (keypoints && keypoints.length > 0) {
      const { box } = detection;
      const { xMin, yMin, width, height } = box;

      // Create a temporary canvas for the face region
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCanvas.width = ctx.canvas.width;
      tempCanvas.height = ctx.canvas.height;

      // Copy the original image to temp canvas
      tempCtx?.drawImage(ctx.canvas, 0, 0);

      // Create face mask path
      tempCtx?.beginPath();
      
      // Use keypoints to create face path
      if (tempCtx) {
        const points = keypoints;
        tempCtx.moveTo(points[0].x, points[0].y);
        points.forEach((point, i) => {
          if (i > 0) {
            tempCtx.lineTo(point.x, point.y);
          }
        });
      }
      
      tempCtx?.closePath();

      // Fill the face path
      if (tempCtx) {
        tempCtx.fillStyle = 'rgb(255, 255, 255)';
        tempCtx.fill();
      }

      // Create a new canvas for the blurred version
      const blurCanvas = document.createElement('canvas');
      const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
      blurCanvas.width = ctx.canvas.width;
      blurCanvas.height = ctx.canvas.height;

      // Copy original image to blur canvas
      blurCtx?.drawImage(ctx.canvas, 0, 0);

      // Apply extremely strong blur
      if (blurCtx) {
        blurCtx.filter = 'blur(50px)';
        blurCtx.drawImage(blurCanvas, 0, 0);
        blurCtx.filter = 'blur(50px)';
        blurCtx.drawImage(blurCanvas, 0, 0);
        blurCtx.filter = 'blur(50px)';
        blurCtx.drawImage(blurCanvas, 0, 0);
      }

      // Apply pixelation
      const pixelSize = 20;
      const regionData = blurCtx?.getImageData(xMin, yMin, width, height);
      if (regionData && blurCtx) {
        for (let py = 0; py < height; py += pixelSize) {
          for (let px = 0; px < width; px += pixelSize) {
            let r = 0, g = 0, b = 0, count = 0;
            
            // Average the pixels in the block
            for (let i = 0; i < pixelSize && py + i < height; i++) {
              for (let j = 0; j < pixelSize && px + j < width; j++) {
                const idx = ((py + i) * width + (px + j)) * 4;
                r += regionData.data[idx];
                g += regionData.data[idx + 1];
                b += regionData.data[idx + 2];
                count++;
              }
            }
            
            // Apply the averaged color
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
      }

      // Composite the blurred and masked version onto the main canvas
      if (tempCtx && blurCtx) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.restore();
      }
    }
  });
}; 