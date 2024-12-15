'use client';

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => {
                const resetViewer = (window as any).__resetOutfit360Viewer;
                if (resetViewer) resetViewer();
              }}
              className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Outfit360
            </button>
          </div>
        </div>
      </div>
    </header>
  );
} 