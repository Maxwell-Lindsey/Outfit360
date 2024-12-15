// src/components/Viewer360.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface Viewer360Props {
  frames: string[];
  totalFrames: number;
  id: string;
}

export default function Viewer360({ frames, totalFrames, id }: Viewer360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [previousFrame, setPreviousFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const preloadBufferSize = 5;
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveToFrame = useCallback((newFrame: number) => {
    let adjustedFrame = newFrame % totalFrames;
    if (adjustedFrame < 0) adjustedFrame += totalFrames;
    setCurrentFrame(adjustedFrame);
  }, [totalFrames]);

  // Auto-rotation logic
  useEffect(() => {
    if (isAutoRotating) {
      autoRotateTimerRef.current = setInterval(() => {
        moveToFrame(currentFrame + 1);
      }, 125);
    } else if (autoRotateTimerRef.current) {
      clearInterval(autoRotateTimerRef.current);
    }
    return () => {
      if (autoRotateTimerRef.current) {
        clearInterval(autoRotateTimerRef.current);
      }
    };
  }, [isAutoRotating, currentFrame, moveToFrame]);

  // Preload images
  useEffect(() => {
    const preloadImages = (frameIndex: number) => {
      const imagesToLoad = new Set<number>();
      for (let i = -preloadBufferSize; i <= preloadBufferSize; i++) {
        let index = (frameIndex + i) % totalFrames;
        if (index < 0) index += totalFrames;
        imagesToLoad.add(index);
      }
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

  useEffect(() => {
    setPreviousFrame(currentFrame);
  }, [currentFrame]);

  useEffect(() => {
    if (containerRef.current) {
      setFrameWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAutoRotating) return;
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isAutoRotating) return;

    const deltaX = e.clientX - startX;
    const framesPerPixel = totalFrames / frameWidth;
    const frameChange = Math.round(deltaX * framesPerPixel);
    
    if (frameChange !== 0) {
      moveToFrame(previousFrame - frameChange);
      setStartX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAutoRotating) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isAutoRotating) return;

    const deltaX = e.touches[0].clientX - startX;
    const framesPerPixel = totalFrames / frameWidth;
    const frameChange = Math.round(deltaX * framesPerPixel);
    
    if (frameChange !== 0) {
      moveToFrame(previousFrame - frameChange);
      setStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAutoRotating) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          moveToFrame(currentFrame - 1);
          break;
        case 'ArrowRight':
          moveToFrame(currentFrame + 1);
          break;
        case 'Space':
          setIsAutoRotating(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFrame, moveToFrame, isAutoRotating]);

  // Click areas for navigation
  const handleAreaClick = (direction: 'left' | 'right') => {
    if (isAutoRotating) return;
    moveToFrame(currentFrame + (direction === 'left' ? -1 : 1));
  };

  const handleExport = async (format: 'gif' | 'mp4') => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outfit360_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      setError('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative" ref={containerRef}>
        <div className="relative group">
          <div 
            ref={containerRef}
            className={`relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden 
              ${isAutoRotating ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
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
              
              {/* Current frame - on top */}
              <img
                key={`current-${frames[currentFrame]}`}
                src={frames[currentFrame]}
                alt={`Frame ${currentFrame}`}
                draggable={false}
                className="absolute top-0 left-0 w-full h-full object-cover select-none transform-gpu"
                style={{
                  transform: 'translate3d(0, 0, 1px)',
                  backfaceVisibility: 'hidden',
                }}
              />
            </div>

            {/* Click areas for navigation */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-1/4 bg-transparent z-10"
              onClick={() => handleAreaClick('left')}
            />
            <div 
              className="absolute right-0 top-0 bottom-0 w-1/4 bg-transparent z-10"
              onClick={() => handleAreaClick('right')}
            />

            {/* Control overlay - appears on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* Navigation arrows */}
              <button
                onClick={() => handleAreaClick('left')}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white 
                  hover:bg-black/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Previous frame"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleAreaClick('right')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white 
                  hover:bg-black/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Next frame"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>

              {/* Auto-rotate toggle */}
              <button
                onClick={() => setIsAutoRotating(prev => !prev)}
                className={`absolute bottom-4 right-4 p-2 rounded-full transition-colors duration-200 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  ${isAutoRotating 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-black/50 text-white hover:bg-black/70'}`}
                aria-label="Toggle auto-rotate"
              >
                <ArrowPathIcon className={`w-6 h-6 ${isAutoRotating ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-lg text-sm">
              {isAutoRotating ? 'Auto-rotating' : 'Drag or use arrows to rotate'}
            </div>
          </div>
        </div>
      </div>

      {/* Export options */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
        <button
          onClick={() => handleExport('gif')}
          disabled={isExporting}
          className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium
            transition-colors duration-200 ease-in-out
            ${isExporting 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'}`}
        >
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          {isExporting ? 'Exporting GIF...' : 'Export as GIF'}
          <span className="ml-1 text-xs text-gray-500 group relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline-block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span className="invisible group-hover:visible absolute bottom-full mb-2 w-48 bg-gray-900 text-white text-xs rounded py-1 px-2 left-1/2 transform -translate-x-1/2">
              Optimized for web sharing with smaller file size and wide compatibility
              <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </span>
          </span>
        </button>
        <button
          onClick={() => handleExport('mp4')}
          disabled={isExporting}
          className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium
            transition-colors duration-200 ease-in-out
            ${isExporting 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'}`}
        >
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          {isExporting ? 'Exporting MP4...' : 'Export as MP4'}
          <span className="ml-1 text-xs text-gray-500 group relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline-block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span className="invisible group-hover:visible absolute bottom-full mb-2 w-48 bg-gray-900 text-white text-xs rounded py-1 px-2 left-1/2 transform -translate-x-1/2">
              HD quality (1280p) with high-quality encoding, resulting in larger file size
              <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </span>
          </span>
        </button>
      </div>

      {/* Error message for export */}
      {error && (
        <div className="mt-2 text-sm text-red-600 text-center">
          {error}
        </div>
      )}
    </div>
  );
} 