import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, 
  Maximize, Minimize, ArrowLeft, Settings, 
  Cloud, PartyPopper, Clipboard, ClipboardCheck,
  X, Check, Upload
} from 'lucide-react';
import { TbRewindForward10, TbRewindBackward10 } from "react-icons/tb";
import { usePeerJSWatchParty } from '../hooks/usePeerJSWatchParty';


// =================================================================
// HELPER COMPONENTS & ICONS
// =================================================================

// Chromecast Icon Component
const ChromecastIcon = (props) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1 18V20H5V18H1ZM1 14V16H8V14H1ZM1 10V12H12V10H1ZM21 3H3C1.9 3 1 3.9 1 5V8H3V5H21V19H14V21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3Z" />
  </svg>
);

// HELPER FUNCTION: Format time
const formatTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00";
  const result = new Date(timeInSeconds * 1000).toISOString().slice(11, 19);
  return timeInSeconds < 3600 ? result.slice(3) : result;
};

// =================================================================
// UI COMPONENTS (UNCHANGED)
// =================================================================
const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 p-1 rounded-full hover:bg-white/10"
          aria-label="Close dialog"
        >
          <X size={24} />
        </button>
        {children}
      </div>
    </div>
  );
};
const Button = ({ children, onClick, variant = "ghost", size = "default", className = "", disabled = false }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variantClasses = {
    default: "bg-white/20 text-white",
    ghost: "text-white hover:bg-white/10",
    outline: "border border-white/10 text-white hover:bg-white/10"
  };
  const sizeClasses = { default: "h-10 px-4 py-2", sm: "h-8 px-3 text-sm", lg: "h-12 px-8" };
  return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>{children}</button>;
};
const Popover = ({ open, onOpenChange, trigger, children }) => {
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (open && triggerRef.current && contentRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      setPosition({
        top: triggerRect.top - contentRect.height - 10,
        left: triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2),
      });
    }
  }, [open]);
  return (
    <div className="relative">
      <div ref={triggerRef} onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div ref={contentRef} className="fixed z-50 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
};
const Slider = ({ value, onValueChange, min = 0, max = 100, step = 1, className = "" }) => {
    const progress = ((value[0] - min) / (max - min)) * 100;
    return (
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step} 
            value={value[0]} 
            onChange={(e) => onValueChange([parseFloat(e.target.value)])} 
            className={`w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider ${className}`}
            style={{ '--progress': `${progress}%` }}
        />
    );
};
const Switch = ({ checked, onCheckedChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black/50 ${checked ? 'bg-blue-500' : 'bg-white/20'}`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);
const Label = ({ children, className = "" }) => <label className={`text-sm font-medium ${className}`}>{children}</label>;


// =================================================================
// CONSTANTS (UNCHANGED)
// =================================================================
const qualityOptions = [{ value: '1080p', label: '1080p', badge: 'Full HD' }, { value: '720p', label: '720p', badge: 'HD' }, { value: '480p', label: '480p', badge: null }, { value: '360p', label: '360p', badge: null }];
const subtitleOptions = ['Off', 'English', 'English - SDH', 'Japanese', 'Spanish'];
const subtitleColors = ['#FFFFFF', '#FF69B4', '#808080', '#7FFFD4', '#8A2BE2', '#FF0000', '#00CED1', '#FFA500', '#FFC0CB', '#1E90FF', '#000080', '#FFFF00'];
const playbackSpeedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
const fontOptions = ['Space Grotesk', 'Arial', 'Georgia', 'Courier New', 'Verdana', 'Roboto'];


// =================================================================
// THE MAIN VIDEO PLAYER COMPONENT
// =================================================================
const VideoPlayer = ({ src, title, getProxyUrl }) => {
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const isReceivingActionRef = useRef(false);
  const subtitleUploadRef = useRef(null);
  const isScrubbingRef = useRef(false);
  const loadingTimeoutRef = useRef(null);
  const messageHandlerRef = useRef(); // Ref to hold the message handler function
  const hlsRef = useRef(null); // HLS instance reference

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [videoError, setVideoError] = useState(null);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); 
  const [showServers, setShowServers] = useState(false);
  const [showWatchParty, setShowWatchParty] = useState(false);

  // Settings State
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [selectedServer, setSelectedServer] = useState(1);
  const [selectedSubtitle, setSelectedSubtitle] = useState('English');
  const [subtitleFontSize, setSubtitleFontSize] = useState(30);
  const [subtitleBackgroundBlur, setSubtitleBackgroundBlur] = useState(0);
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [isAutoplayNext, setIsAutoplayNext] = useState(true);
  const [isShowNextButton, setIsShowNextButton] = useState(true);
  const [selectedFont, setSelectedFont] = useState('Space Grotesk');

  // Watch Party State
  const [partyStatus, setPartyStatus] = useState('disconnected');
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Chromecast State
  const [castState, setCastState] = useState('unavailable');
  const [castSession, setCastSession] = useState(null);
  const [castDeviceName, setCastDeviceName] = useState('');
  const isCasting = castState === 'connected' && castSession;

  useEffect(() => { if (!showSettings) { setTimeout(() => setSettingsView('main'), 300); } }, [showSettings]);

  // =================================================================
  // WATCH PARTY LOGIC - FIXED & ROBUST
  // =================================================================

  // Define status change handler first, as it's independent.
  const handleStatusChange = useCallback((status) => {
    setPartyStatus(status);
    if (status === 'connected' || status === 'hosting') {
      setShowWatchParty(true);
    }
  }, []);

  // Initialize the hook. We pass a stable proxy function for onMessage
  // that will call the real handler stored in a ref. This breaks the circular dependency.
  const watchParty = usePeerJSWatchParty({
    onMessage: (data, fromPeerId) => messageHandlerRef.current?.(data, fromPeerId),
    onStatusChange: handleStatusChange
  });

  // Now, we can define the real message handler, which safely uses `watchParty`
  const handlePartyMessage = useCallback((data, fromPeerId) => {
    if (isCasting || !videoRef.current) return;

    if (watchParty.partyRole === 'host') {
      if (data.type === 'SYNC_REQUEST') {
        watchParty.sendMessage({
          type: 'SYNC_RESPONSE',
          time: videoRef.current.currentTime,
          isPlaying: !videoRef.current.paused,
        }, fromPeerId);
        return;
      } else {
        watchParty.sendMessage(data);
      }
    }

    isReceivingActionRef.current = true;
    switch (data.type) {
      case 'PLAY':
        if (videoRef.current.paused) videoRef.current.play();
        break;
      case 'PAUSE':
        if (!videoRef.current.paused) videoRef.current.pause();
        break;
      case 'SEEK':
        if (Math.abs(data.time - videoRef.current.currentTime) > 1.5) {
          videoRef.current.currentTime = data.time;
        }
        break;
      case 'SYNC_RESPONSE':
        videoRef.current.currentTime = data.time;
        if (data.isPlaying) videoRef.current.play(); else videoRef.current.pause();
        break;
      default:
        break;
    }
    setTimeout(() => { isReceivingActionRef.current = false; }, 200);
  }, [isCasting, watchParty.partyRole, watchParty.sendMessage]);

  // Keep the ref updated with the latest handler on every render
  useEffect(() => {
    messageHandlerRef.current = handlePartyMessage;
  });

  const shareLink = watchParty.peerId ? `${window.location.origin}${window.location.pathname}?party=${watchParty.peerId}` : '';
  const handleCopyLink = () => navigator.clipboard.writeText(shareLink).then(() => { setIsLinkCopied(true); setTimeout(() => setIsLinkCopied(false), 2000); });

  // Effect to automatically join a party if the URL contains a party ID
  useEffect(() => {
    const partyId = new URLSearchParams(window.location.search).get('party');
    if (partyId && !watchParty.isPartyActive) {
      setShowWatchParty(true);
      watchParty.joinParty(partyId);
    }
  }, [watchParty.isPartyActive, watchParty.joinParty]);


  // =================================================================
  // PLAYER CORE LOGIC (ACTION HANDLERS UPDATED FOR WATCH PARTY)
  // =================================================================
  const hideControls = useCallback(() => setShowControls(false), []);
  const displayControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlayingRef.current) controlsTimeoutRef.current = setTimeout(hideControls, 3000);
  }, [hideControls]);

  const togglePlayPause = useCallback(() => {
    if (isCasting || !videoRef.current) return;

    const isPaused = videoRef.current.paused;

    if (watchParty.isPartyActive) {
      if (isReceivingActionRef.current) return;
      watchParty.sendMessage({ type: isPaused ? 'PLAY' : 'PAUSE' });
    }

    if (isPaused) videoRef.current.play(); else videoRef.current.pause();

  }, [isCasting, watchParty]);

  const handleSeek = useCallback((amount) => {
    if (isCasting || !videoRef.current || duration <= 0) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + amount));

    if (watchParty.isPartyActive) {
      if (isReceivingActionRef.current) return;
      watchParty.sendMessage({ type: 'SEEK', time: newTime });
    }

    videoRef.current.currentTime = newTime;

  }, [duration, isCasting, watchParty]);

  const toggleMute = useCallback(() => {
    if (isCasting || !videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted; 
    setIsMuted(newMuted);
    if(newMuted) setVolume(0); else setVolume(videoRef.current.volume || 1);
  }, [isCasting]);

  const handleVolumeChange = (v) => {
    const newVolume = v[0];
    if (isCasting || !videoRef.current) return;
    setVolume(newVolume);
    videoRef.current.volume = newVolume; 
    const newMuted = newVolume === 0;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const adjustVolume = useCallback((delta) => handleVolumeChange([Math.max(0, Math.min(1, volume + delta))]), [volume, handleVolumeChange]);
  const toggleFullScreen = useCallback(() => {!document.fullscreenElement ? playerContainerRef.current?.requestFullscreen() : document.exitFullscreen()}, []);
  const changePlaybackSpeed = useCallback((speed) => {
    if (isCasting || !videoRef.current) return;
    videoRef.current.playbackRate = speed; setPlaybackSpeed(speed);
  }, [isCasting]);

  // Initialize HLS for m3u8 files
  const initializeHLS = useCallback((videoSrc) => {
    const video = videoRef.current;
    if (!video) return;

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isM3U8 = videoSrc?.toLowerCase().includes('.m3u8') || videoSrc?.toLowerCase().includes('application/vnd.apple.mpegurl');

    if (isM3U8 && Hls.isSupported()) {
      // Extract the original URL from the proxy URL if it's proxied
      let originalManifestUrl = videoSrc;
      if (videoSrc.includes('/proxy?url=')) {
        try {
          const urlParam = new URLSearchParams(videoSrc.split('?')[1]).get('url');
          originalManifestUrl = decodeURIComponent(urlParam);
        } catch (e) {
          console.error('Failed to extract original URL from proxy:', e);
        }
      }

      // Store the original URL base for resolving relative URLs
      const originalUrlBase = originalManifestUrl.substring(0, originalManifestUrl.lastIndexOf('/') + 1);

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        xhrSetup: function(xhr, url) {
          let finalUrl = url;

          console.log('HLS XHR Request:', { originalUrl: url, originalUrlBase });

          // Check if this URL is pointing to our Replit domain (indicating a mis-resolved relative URL)
          const currentHost = window.location.host;
          if (url.includes(currentHost) && !url.includes('/proxy?url=')) {
            // This URL is pointing to our Replit domain, extract the filename and resolve against original base
            const segments = url.split('/');
            const filename = segments[segments.length - 1];
            if (filename.includes('.m3u8') || filename.includes('.ts')) {
              finalUrl = originalUrlBase + filename;
              console.log('Corrected mis-resolved URL:', finalUrl);
            }
          }
          // Handle URL resolution for relative paths
          else if (!url.startsWith('http') && !url.includes('/proxy?url=')) {
            // This is a relative URL, resolve it against the original manifest's base URL
            finalUrl = originalUrlBase + url;
            console.log('Resolved relative URL:', finalUrl);
          }

          // Prevent double-proxying and ensure external URLs are proxied
          if (getProxyUrl && finalUrl.startsWith('http') && !finalUrl.includes('/proxy?url=')) {
            finalUrl = getProxyUrl(finalUrl);
            console.log('Proxied URL:', finalUrl);
          }

          if (finalUrl !== url) {
            xhr.open('GET', finalUrl, true);
          }

          xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          xhr.setRequestHeader('Referer', window.location.origin);
        }
      });

      // Use proxied URL for initial manifest loading
      hls.loadSource(getProxyUrl ? getProxyUrl(videoSrc) : videoSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('HLS manifest parsed successfully', data);
        if (data.levels && data.levels.length === 0) {
          setVideoError('No playable video streams found in this M3U8 file.');
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
      });

      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        console.log('Loading M3U8 manifest...');
        setVideoError(null);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);

        // Note: Some streaming services use obfuscated URLs that look like HTML pages
        // but actually serve video segments. We should not reject these automatically.

        // Check for manifest loading errors
        if (data.details === 'manifestLoadError') {
          console.log('Manifest load error - checking if URL is accessible');

          // Check if this is shadowlandschronicles or similar protected service
          const url = data.url || videoSrc;
          if (url.includes('shadowlandschronicles.com') || url.includes('tmstr')) {
            setVideoError('❌ shadowlandschronicles.com Stream Blocked\n\nThis streaming service actively blocks external players and proxy access. While the stream works in VLC (which bypasses web security), it cannot be played in web browsers due to:\n\n• Advanced CORS protection\n• Domain whitelist restrictions\n• Server-side access control\n\nThis is intentional protection by the streaming service to prevent unauthorized access. The stream can only be accessed through their official applications or authorized websites.');
          } else if (url.includes('private') || url.includes('protected')) {
            setVideoError('This stream appears to be from a private or protected server that blocks external access. These types of streams typically require special authentication or can only be accessed from specific domains/applications.');
          } else {
            setVideoError('Failed to load the M3U8 playlist. The stream may be protected by CORS, require authentication, or be temporarily unavailable. Try testing the URL directly in a browser first.');
          }

          setIsLoading(false);
          hls.destroy();
          hlsRef.current = null;
          return;
        }

        // Check for manifest parsing errors
        if (data.details === 'manifestParsingError') {
          console.log('Manifest parsing error - invalid M3U8 format');
          setVideoError('The M3U8 file format is invalid or corrupted. Please verify the stream URL is correct.');
          setIsLoading(false);
          hls.destroy();
          hlsRef.current = null;
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.details === 'fragLoadError') {
                console.log('Fragment load error - stream may be invalid');
                setVideoError('Video segments are failing to load. This stream may be broken, expired, or require special authentication.');
                setIsLoading(false);
                hls.destroy();
                hlsRef.current = null;
              } else if (data.details === 'manifestLoadError') {
                console.log('Manifest load error - stream may be inaccessible');
                setVideoError('Cannot access the M3U8 stream. It may be geo-blocked, expired, or require authentication.');
                setIsLoading(false);
                hls.destroy();
                hlsRef.current = null;
              } else {
                console.log('Network error, trying to recover...');
                setVideoError('Network error loading video. Retrying...');
                setTimeout(() => {
                  try {
                    hls.startLoad();
                    setVideoError(null);
                  } catch (e) {
                    setVideoError('Failed to load video. The stream may be unavailable.');
                  }
                }, 3000);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              setVideoError('Media error. Attempting to recover...');
              try {
                hls.recoverMediaError();
                setTimeout(() => setVideoError(null), 5000);
              } catch (e) {
                setVideoError('Video format not supported or corrupted.');
              }
              break;
            default:
              console.log('Fatal error, destroying HLS instance');
              setVideoError('Unable to play this video. The stream may be incompatible or unavailable.');
              setIsLoading(false);
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        } else {
          // Handle non-fatal errors more gracefully
          if (data.details === 'fragLoadError') {
            // Count consecutive fragment errors
            if (!hls.fragLoadErrorCount) hls.fragLoadErrorCount = 0;
            hls.fragLoadErrorCount++;

            // Note: Removed premature HTML detection for radiantquestlab.xyz
            // The proxy handles MIME type correction, so small segments are normal
            console.log('Fragment load error detected, but allowing proxy to handle MIME type correction');

            if (hls.fragLoadErrorCount > 3) {
              console.log('Too many fragment errors, treating as fatal');
              setVideoError('Multiple video segments are failing to load. This stream appears to be broken or expired.');
              setIsLoading(false);
              hls.destroy();
              hlsRef.current = null;
            } else {
              console.log(`Non-fatal fragment error ${hls.fragLoadErrorCount}/3`);
            }
          } else if (data.details === 'fragParsingError') {
            console.log(`Non-fatal ${data.details}, HLS will retry automatically`);
          }
        }
      });

      hlsRef.current = hls;
    } else if (isM3U8 && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari) - use proxy for initial manifest
      video.src = getProxyUrl ? getProxyUrl(videoSrc) : videoSrc;
    } else {
      // Regular video file
      video.src = getProxyUrl ? getProxyUrl(videoSrc) : videoSrc;
    }
  }, [getProxyUrl]);

  // Main useEffect for video state and event listeners.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => { if (!isScrubbingRef.current) setCurrentTime(video.currentTime); };
    const onLoadedMetadata = () => { setDuration(video.duration); setIsLoading(false); };
    const onPlaying = () => {
      setIsPlaying(true);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
      displayControls();
    };
    const onPause = () => setIsPlaying(false);
    const onCanPlay = () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
    };
    const onWaiting = () => {
      if (isScrubbingRef.current || !isPlayingRef.current) return;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => setIsLoading(true), 300);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    // Initialize video source with HLS support
    const currentSrc = hlsRef.current ? hlsRef.current.url : video.src;
    if (currentSrc !== src) {
      setIsLoading(true);
      setVideoError(null);
      initializeHLS(src);
    }

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);

      // Cleanup HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, displayControls, initializeHLS]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || showSettings || showWatchParty) return;
      const actions = { 'Space': togglePlayPause, 'KeyK': togglePlayPause, 'ArrowLeft': () => handleSeek(-10), 'KeyJ': () => handleSeek(-10), 'ArrowRight': () => handleSeek(10), 'KeyL': () => handleSeek(10), 'ArrowUp': () => adjustVolume(0.1), 'ArrowDown': () => adjustVolume(-0.1), 'KeyM': toggleMute, 'KeyF': toggleFullScreen, 'Escape': () => { setShowSettings(false); setShowWatchParty(false); } };
      if (actions[e.code]) { e.preventDefault(); actions[e.code](); }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayPause, handleSeek, adjustVolume, toggleMute, toggleFullScreen, showSettings, showWatchParty]);

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Scrubbing logic with touch support
  const handleScrub = useCallback((clientX) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
    const newTime = percent * duration;
    setCurrentTime(newTime);
    if (videoRef.current && !isCasting) videoRef.current.currentTime = newTime;
  }, [duration, isCasting]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!isScrubbingRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      handleScrub(clientX);
    };
    const handleEnd = (e) => {
      if (!isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const percent = Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
      const finalTime = percent * duration;

      if (watchParty.isPartyActive && !isCasting && !isReceivingActionRef.current) {
        watchParty.sendMessage({ type: 'SEEK', time: finalTime });
      }

      if (videoRef.current) { videoRef.current.currentTime = finalTime; }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [handleScrub, isCasting, watchParty, duration]);

  const handleScrubStart = (e) => {
    isScrubbingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    handleScrub(clientX);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : Volume2;
  const showLoader = isLoading && isPlaying;


  // =================================================================
  // SETTINGS PANEL RENDER LOGIC (UNCHANGED)
  // =================================================================
  const renderSettingsContent = () => {
    const viewTitles = { main: 'Settings', quality: 'Quality', subtitles: 'Subtitles', settings: 'Subtitle Settings', playback: 'Playback', fonts: 'Subtitle Font' };
    const SettingsOption = ({ label, value, onClick }) => ( <button onClick={onClick} className="w-full flex justify-between items-center text-left p-3 rounded-lg hover:bg-white/10 transition-colors"> <span>{label}</span> <span className="text-gray-400">{value} ›</span> </button> );
    const contentMap = {
      main: (<div className="space-y-1"><SettingsOption label="Quality" value={selectedQuality} onClick={() => setSettingsView('quality')} /><SettingsOption label="Subtitles" value={selectedSubtitle} onClick={() => setSettingsView('subtitles')} /><SettingsOption label="Subtitle Settings" value="" onClick={() => setSettingsView('settings')} /><SettingsOption label="Playback" value="" onClick={() => setSettingsView('playback')} /></div>),
      quality: (<div className="space-y-1 text-white">{qualityOptions.map(o => (<button key={o.value} onClick={() => setSelectedQuality(o.value)} className={`w-full flex items-center text-left p-3 rounded-lg hover:bg-white/10 ${selectedQuality === o.value ? 'text-white' : 'text-gray-300'}`}><div className="w-6 mr-2">{selectedQuality === o.value && <Check size={20} />}</div><span>{o.label}</span>{o.badge && <span className="ml-2 text-xs text-red-400 font-semibold">{o.badge}</span>}</button>))}</div>),
      subtitles: (<div className="space-y-1 text-white"><input type="file" ref={subtitleUploadRef} className="hidden" accept=".srt,.vtt" onChange={() => {}} />{subtitleOptions.map(o => (<button key={o} onClick={() => setSelectedSubtitle(o)} className={`w-full flex items-center text-left p-3 rounded-lg hover:bg-white/10 ${selectedSubtitle === o ? 'text-white' : 'text-gray-300'}`}><div className="w-6 mr-2">{selectedSubtitle === o && <Check size={20} />}</div><span>{o}</span></button>))} <div className="pt-2"><button onClick={() => subtitleUploadRef.current?.click()} className="w-full flex items-center text-left p-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white"><div className="w-6 mr-2 text-gray-400"><Upload size={18} /></div><span>Upload</span></button><button onClick={() => setSettingsView('settings')} className="w-full flex items-center text-left p-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white"><div className="w-6 mr-2 text-gray-400"><Settings size={18} /></div><span>Customize</span></button></div></div>),
      settings: (<div className="space-y-6"><SettingsOption label="Font" value={selectedFont} onClick={() => setSettingsView('fonts')} /><div className="grid grid-cols-2 gap-x-6 gap-y-4"><div><Label className="block mb-3 text-gray-200">Font Size</Label><div className="flex items-center gap-4"><Slider value={[subtitleFontSize]} onValueChange={(v) => setSubtitleFontSize(v[0])} min={16} max={48} step={1} /><span className="text-gray-400 tabular-nums">{subtitleFontSize}px</span></div></div><div><Label className="block mb-3 text-gray-200">BG Blur</Label><div className="flex items-center gap-4"><Slider value={[subtitleBackgroundBlur]} onValueChange={(v) => setSubtitleBackgroundBlur(v[0])} min={0} max={100} step={5} /><span className="text-gray-400 tabular-nums">{subtitleBackgroundBlur}%</span></div></div></div><div><Label className="block mb-3 text-gray-200">Color</Label><div className="grid grid-cols-6 gap-3">{subtitleColors.map(c => (<button key={c} className={`w-full h-8 rounded-lg border-2 ${subtitleColor === c ? 'border-white ring-2 ring-white ring-offset-2 ring-offset-black/50' : 'border-transparent hover:border-gray-500'}`} style={{ backgroundColor: c }} onClick={() => setSubtitleColor(c)} title={c} />))}</div></div><div className="pt-2"><Button onClick={() => { setSubtitleFontSize(30); setSubtitleBackgroundBlur(0); setSubtitleColor('#FFFFFF'); }} variant="outline" className="w-full">Reset</Button></div></div>),
      fonts: (<div className="space-y-1 text-white">{fontOptions.map(f => (<button key={f} onClick={() => setSelectedFont(f)} className={`w-full flex items-center text-left p-3 rounded-lg hover:bg-white/10 ${selectedFont === f ? 'text-white' : 'text-gray-300'}`}><div className="w-6 mr-2">{selectedFont === f && <Check size={20} />}</div><span style={{ fontFamily: f }}>{f}</span></button>))}</div>),
      playback: (<div className="space-y-6"><div><Label className="block mb-3 text-gray-200">Speed</Label><div className="grid grid-cols-4 gap-2">{playbackSpeedOptions.map(s => (<Button key={s} variant={playbackSpeed === s ? 'default' : 'ghost'} onClick={() => changePlaybackSpeed(s)} className="text-sm" disabled={isCasting || watchParty.isPartyActive}>{s === 1 ? '1x' : `${s}x`}</Button>))}</div></div><div className="pt-2 space-y-4"><div className="flex justify-between items-center"><Label className="text-gray-200">Autoplay next</Label><Switch checked={isAutoplayNext} onCheckedChange={setIsAutoplayNext} /></div><div className="flex justify-between items-center"><Label className="text-gray-200">Show next button</Label><Switch checked={isShowNextButton} onCheckedChange={setIsShowNextButton} /></div></div></div>),
    };
    return (<><div className="p-4 shrink-0 flex items-center border-b border-white/10">{settingsView !== 'main' && (<button onClick={() => setSettingsView(settingsView === 'fonts' ? 'settings' : 'main')} className="mr-4 p-2 -ml-2 rounded-full hover:bg-white/10"><ArrowLeft size={20} /></button>)}<h2 className="text-xl font-semibold text-white">{viewTitles[settingsView]}</h2></div><div className="p-4 overflow-y-auto overflow-x-hidden"><div key={settingsView} className="settings-content-pane">{contentMap[settingsView]}</div></div></>);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        .video-player-container { font-family: 'Space Grotesk', sans-serif; }
        .video-player-container video::cue { font-family: "${selectedFont}", sans-serif; font-size: ${subtitleFontSize}px; color: ${subtitleColor}; background: rgba(0, 0, 0, ${subtitleBackgroundBlur / 150}); backdrop-filter: blur(${subtitleBackgroundBlur / 20}px); text-shadow: 2px 2px 4px rgba(0,0,0,0.7); }
        input[type=range].slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: linear-gradient(to right, #ffffff var(--progress), rgba(255,255,255,0.3) var(--progress)); outline: none; transition: opacity .2s; cursor: pointer; border-radius: 2px; }
        input[type=range].slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: #ffffff; border-radius: 50%; cursor: pointer; margin-top: 0px; }
        .volume-slider-container { transition: width 0.3s ease, opacity 0.3s ease; width: 0; opacity: 0; }
        .volume-group:hover .volume-slider-container { width: 80px; opacity: 1; margin-left: 8px; }
        .party-active { color: #38bdf8; }
        .settings-content-pane { animation: slideIn 0.25s ease-out forwards; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        google-cast-launcher { width: 44px; height: 44px; --cast-button-color: white; cursor: pointer; display: inline-block; vertical-align: middle; }
      `}</style>

      <div className="video-player-container w-full h-screen bg-black relative flex items-center justify-center text-white overflow-hidden">
        <div ref={playerContainerRef} className={`w-full h-full relative group ${!showControls && isPlaying && !isCasting ? 'cursor-none' : 'cursor-pointer'}`} onMouseMove={displayControls} onMouseLeave={isPlaying ? hideControls : undefined}>
          <video ref={videoRef} className={`w-full h-full object-contain ${isCasting ? 'opacity-0 pointer-events-none' : ''}`} onClick={togglePlayPause} onDoubleClick={toggleFullScreen} crossOrigin="anonymous">
            {selectedSubtitle !== 'Off' && <track kind="subtitles" label={selectedSubtitle} srcLang="en" default />}
          </video>

          {isCasting && (<div className="absolute inset-0 flex flex-col items-center justify-center bg-black"><ChromecastIcon className="text-blue-400" width={80} height={80} /><p className="text-2xl mt-4 font-semibold">Casting to {castDeviceName}</p><p className="text-gray-400 mt-1">Playback is controlled on this device.</p></div>)}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {showLoader && !videoError && <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent"></div>}
            {videoError && (
              <div className="text-center p-6 max-w-md pointer-events-auto">
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">Video Error</h3>
                  <p className="text-sm text-gray-300 mb-4">{videoError}</p>
                  <button 
                    onClick={() => {
                      setVideoError(null);
                      setIsLoading(true);
                      initializeHLS(src);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            {showControls && !isPlaying && !showLoader && !videoError && (
              <button onClick={togglePlayPause} className="p-3 sm:p-4 pointer-events-auto transition-transform hover:scale-110 drop-shadow-lg" aria-label="Play">
                <Play size={64} />
              </button>
            )}
          </div>

          <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 z-30 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-center p-4 md:p-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
                <div className="flex items-center gap-4">
                    <button className="text-white hover:text-gray-300 transition-colors p-2 -ml-2"><ArrowLeft size={28} /></button>
                    <div>
                        <p className="text-xs md:text-sm text-gray-300">You're watching</p>
                        <h1 className="text-lg md:text-xl font-semibold text-white truncate max-w-[calc(100vw-220px)]">{title}</h1>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-6 pt-2 pb-3 md:pb-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
              <div ref={progressBarRef} className="w-full h-1 md:h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 relative group/progress" onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}>
                <div className="h-full bg-white rounded-full relative group-hover/progress:h-2 transition-all duration-150 pointer-events-none" style={{ width: `${progressPercent}%` }}>
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ right: '-6px' }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 md:space-x-4">
                  <button onClick={togglePlayPause} className="text-white p-2">{isPlaying ? <Pause size={32} /> : <Play size={32} />}</button>
                  <button onClick={() => handleSeek(-10)} className="text-white p-2" disabled={duration === 0} title="Rewind 10s"><TbRewindBackward10 size={28} /></button>
                  <button onClick={() => handleSeek(10)} className="text-white p-2" disabled={duration === 0} title="Forward 10s"><TbRewindForward10 size={28} /></button>
                  <div className="hidden md:flex items-center volume-group">
                    <button onClick={toggleMute} className="text-white p-2" title="Mute"><VolumeIcon size={28} /></button>
                    <div className="volume-slider-container">
                        <Slider value={[isMuted ? 0 : volume]} onValueChange={handleVolumeChange} min={0} max={1} step={0.05} />
                    </div>
                  </div>
                  <span className="text-base font-medium text-white/90 min-w-max tracking-wide">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className="flex items-center space-x-2 md:space-x-4">
                  <Popover open={showServers} onOpenChange={setShowServers} trigger={<button className="text-white p-2" title="Select Server"><Cloud size={28} /></button>}>
                    <div className="w-48 p-3"><h4 className="font-semibold text-white mb-2">Select Server</h4><div className="space-y-1">{[1, 2, 3, 4].map(s => (<Button key={s} variant={selectedServer === s ? "default" : "ghost"} className="w-full justify-start text-sm" onClick={() => { setSelectedServer(s); setShowServers(false); }}>Server {s}</Button>))}</div></div>
                  </Popover>
                  <button onClick={() => setShowWatchParty(true)} className={`text-white p-2 transition-colors ${watchParty.isPartyActive ? 'party-active' : ''}`} title="Watch Party"><PartyPopper size={28} /></button>
                  <button onClick={() => setShowSettings(true)} className="text-white p-2" title="Settings"><Settings size={28} /></button>
                  <button onClick={toggleFullScreen} className="text-white p-2" title="Fullscreen">{isFullScreen ? <Minimize size={28} /> : <Maximize size={28} />}</button>
                </div>
              </div>
            </div>
          </div>

          <Dialog open={showWatchParty} onOpenChange={setShowWatchParty}><div className="p-6 pt-12 text-center max-w-sm mx-auto"><div className="flex justify-center items-center mb-4"><PartyPopper className="mr-3 text-blue-400" size={32} /><h2 className="text-2xl font-semibold text-white">Watch Party</h2></div>{partyStatus === 'disconnected' && (<><p className="text-gray-400 mb-6">Start a party to watch with friends. A shareable link will be generated.</p><Button onClick={() => watchParty.startParty()} className="bg-blue-500 hover:bg-blue-600 text-white w-full">Start a New Party</Button></>)}{partyStatus === 'hosting' && (<><p className="text-gray-300 mb-2">You are hosting! Share this link:</p><div className="p-2 bg-black/30 border border-white/20 rounded-md text-sm text-gray-400 break-all mb-4">{shareLink}</div><Button onClick={handleCopyLink} variant="outline" className="w-full flex justify-center items-center space-x-2">{isLinkCopied ? <ClipboardCheck size={16}/> : <Clipboard size={16} />}<span>{isLinkCopied ? 'Copied!' : 'Copy Link'}</span></Button><Button onClick={() => watchParty.endParty()} variant="outline" className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 mt-4">End Party</Button></>)}{partyStatus === 'connecting' && (<p className="text-gray-300 animate-pulse">Connecting to party...</p>)}{partyStatus === 'connected' && (<><p className="text-lg text-green-400 font-bold mb-4">Party Connected!</p><p className="text-gray-300 mb-6">Playback is now synchronized with the host.</p><Button onClick={() => watchParty.endParty()} variant="outline" className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300">Leave Party</Button></>)}{partyStatus === 'error' && (<p className="text-red-400">Connection failed. Please try again.</p>)}</div></Dialog>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>{renderSettingsContent()}</Dialog>
        </div>
      </div>
    </>
  );
};

export default VideoPlayer;