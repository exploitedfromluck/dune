
import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import './App.css';

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      setCurrentVideo({
        src: videoUrl,
        title: 'M3U8 Video Player'
      });
    }
  };

  // Function to get proxy URL for CORS bypass
  const getProxyUrl = (url) => {
    if (!url) return '';
    return `/proxy?url=${encodeURIComponent(url)}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {!currentVideo ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md w-full mx-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
              <h1 className="text-3xl font-bold text-center mb-6">M3U8 Video Player</h1>
              <p className="text-gray-400 text-center mb-6">
                Enter an M3U8 stream URL to start watching. This player supports HLS streams and handles CORS automatically.
              </p>
              
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-300 mb-2">
                    M3U8 Stream URL
                  </label>
                  <input
                    type="url"
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://example.com/stream.m3u8"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                >
                  Load Video
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="text-lg font-semibold mb-3">Features:</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• HLS.js support for M3U8 streams</li>
                  <li>• CORS proxy for cross-origin requests</li>
                  <li>• Watch party sync with friends</li>
                  <li>• Quality selection and playback controls</li>
                  <li>• Subtitle support and customization</li>
                  <li>• Fullscreen mode</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setCurrentVideo(null)}
            className="absolute top-4 left-4 z-50 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-md transition-colors"
          >
            ← Back
          </button>
          <VideoPlayer 
            src={currentVideo.src} 
            title={currentVideo.title}
            getProxyUrl={getProxyUrl}
          />
        </div>
      )}
    </div>
  );
}

export default App;
