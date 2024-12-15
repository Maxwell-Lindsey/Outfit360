// src/app/page.tsx
'use client';

import { useState } from 'react';
import Viewer360 from '@/components/Viewer360';

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [viewerData, setViewerData] = useState<{ frames: string[]; totalFrames: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('video', file);
      formData.append('blurFace', (document.getElementById('blur-face') as HTMLInputElement)?.checked ? 'true' : 'false');
      formData.append('blurBackground', (document.getElementById('blur-background') as HTMLInputElement)?.checked ? 'true' : 'false');

      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process video');
      }

      const data = await response.json();
      setViewerData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Transform Your Fashion Videos
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Create interactive, privacy-conscious rotating displays of your clothing items.
          Perfect for online sellers, boutiques, and fashion enthusiasts.
        </p>
      </div>

      {/* Upload Section */}
      <div className="mx-auto max-w-3xl">
        {!viewerData ? (
          <div className="rounded-lg border border-dashed border-gray-900/25 p-12">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-gray-300">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
                >
                  <span>Upload a video</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept="video/*"
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">MP4, MOV up to 100MB</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Viewer360 frames={viewerData.frames} totalFrames={viewerData.totalFrames} />
            <button
              onClick={() => setViewerData(null)}
              className="mt-4 w-full rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Upload Another Video
            </button>
          </div>
        )}

        {/* Processing Options */}
        {!viewerData && (
          <div className="mt-8 space-y-6">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="blur-face"
                  name="blur-face"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  defaultChecked
                />
              </div>
              <div className="ml-3">
                <label htmlFor="blur-face" className="font-medium text-gray-900">
                  Blur Face
                </label>
                <p className="text-sm text-gray-500">Automatically detect and blur faces for privacy</p>
              </div>
            </div>

            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="blur-background"
                  name="blur-background"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  defaultChecked
                />
              </div>
              <div className="ml-3">
                <label htmlFor="blur-background" className="font-medium text-gray-900">
                  Blur Background
                </label>
                <p className="text-sm text-gray-500">Remove distracting backgrounds to focus on your outfit</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isUploading && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Processing your video...</p>
          </div>
        )}
      </div>

      {/* Features Section */}
      {!viewerData && (
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Upload Your Video</h3>
              <p className="mt-2 text-gray-600">
                Record a short video (5-10 seconds) of your outfit with a 360° rotation
              </p>
            </div>
            <div className="relative p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Automatic Processing</h3>
              <p className="mt-2 text-gray-600">
                Our AI handles face detection and background removal while maintaining clothing quality
              </p>
            </div>
            <div className="relative p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Interactive Display</h3>
              <p className="mt-2 text-gray-600">
                Get a professional, interactive view that your customers can rotate and explore
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
