// src/components/Viewer360.tsx
import { useEffect, useRef, useState } from 'react';

interface Viewer360Props {
  frames: string[];
  totalFrames: number;
}

export default function Viewer360({ frames, totalFrames }: Viewer360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [previousFrame, setPreviousFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const preloadBufferSize = 5; // Number of frames to preload ahead and behind

  // Preload images
  useEffect(() => {
    const preloadImages = (frameIndex: number) => {
      const imagesToLoad = new Set<number>();
      
      // Add frames ahead and behind the current frame
      for (let i = -preloadBufferSize; i <= preloadBufferSize; i++) {
        let index = (frameIndex + i) % totalFrames;
        if (index < 0) index += totalFrames;
        imagesToLoad.add(index);
      }

      // Preload images that aren't already loaded
      imagesToLoad.forEach(index => {
        if (!loadedImages.has(index)) {
          const img = new Image();
          img.onload = () => {
            setLoadedImages(prev => new Set([...prev, index]));
          };
          img.src = frames[index];
        }
      });
    };

    preloadImages(currentFrame);
  }, [currentFrame, frames, loadedImages, totalFrames]);

  // Update previous frame when current frame changes
  useEffect(() => {
    setPreviousFrame(currentFrame);
  }, [currentFrame]);

  useEffect(() => {
    if (containerRef.current) {
      setFrameWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const framesPerPixel = totalFrames / frameWidth;
    const frameChange = Math.floor(deltaX * framesPerPixel);
    
    let newFrame = (currentFrame - frameChange) % totalFrames;
    if (newFrame < 0) newFrame += totalFrames;
    
    setCurrentFrame(newFrame);
    setStartX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaX = e.touches[0].clientX - startX;
    const framesPerPixel = totalFrames / frameWidth;
    const frameChange = Math.floor(deltaX * framesPerPixel);
    
    let newFrame = (currentFrame - frameChange) % totalFrames;
    if (newFrame < 0) newFrame += totalFrames;
    
    setCurrentFrame(newFrame);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 w-full h-full">
        {/* Previous frame - always visible underneath */}
        <img
          key={`prev-${frames[previousFrame]}`}
          src={frames[previousFrame]}
          alt={`Frame ${previousFrame}`}
          draggable={false}
          className="absolute top-0 left-0 w-full h-full object-cover select-none"
        />
        
        {/* Current frame - slides in on top */}
        <img
          key={`current-${frames[currentFrame]}`}
          src={frames[currentFrame]}
          alt={`Frame ${currentFrame}`}
          draggable={false}
          className="absolute top-0 left-0 w-full h-full object-cover select-none transform-gpu"
          style={{
            transform: 'translate3d(0, 0, 1px)', // Force GPU layer and ensure it's on top
            backfaceVisibility: 'hidden',
          }}
        />
      </div>

      <div className="absolute bottom-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm" style={{ transform: 'translate3d(0, 0, 2px)' }}>
        Drag to rotate
      </div>
    </div>
  );
} 