// src/components/Viewer360.tsx
import { useEffect, useRef, useState } from 'react';

interface Viewer360Props {
  frames: string[];
  totalFrames: number;
}

export default function Viewer360({ frames, totalFrames }: Viewer360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);

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
      {frames.map((frame, index) => (
        <img
          key={frame}
          src={frame}
          alt={`Frame ${index}`}
          draggable={false}
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-100 select-none
            ${index === currentFrame ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        Drag to rotate
      </div>
    </div>
  );
} 