const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes with comprehensive headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

// Additional CORS middleware for proxy requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  next();
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from the dist directory (production build)
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy endpoint for CORS bypass
app.get('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Check if URL is properly encoded
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
      console.log('Proxying request to:', decodedUrl);
    } catch (error) {
      console.error('URL decoding error:', error);
      return res.status(400).json({ error: 'Invalid URL encoding' });
    }

    // Validate URL format
    try {
      new URL(decodedUrl);
    } catch (error) {
      console.error('Invalid URL format:', decodedUrl);
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Proxying request to:', decodedUrl);

    const urlObj = new URL(decodedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Enhanced headers for better compatibility
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Forward Range headers for video segment requests
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    // Special handling for protected streaming services
    if (hostname.includes('shadowlandschronicles') || hostname.includes('tmstr')) {
      console.log('Applying enhanced protection bypass for shadowlandschronicles.com');
      
      // Set headers to mimic direct access from their own domain
      headers['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
      headers['Origin'] = `${urlObj.protocol}//${urlObj.host}`;
      
      // Add headers that streaming services often expect
      headers['X-Requested-With'] = 'XMLHttpRequest';
      
      // Mimic a video player request
      if (decodedUrl.includes('.m3u8')) {
        headers['Accept'] = 'application/vnd.apple.mpegurl, application/x-mpegurl, */*';
        // Keep Accept-Encoding for M3U8 files as they need proper decompression
        headers['Accept-Encoding'] = 'gzip, deflate';
      } else if (decodedUrl.includes('.ts') || decodedUrl.includes('seg-') || decodedUrl.includes('page-') || decodedUrl.includes('play?')) {
        // Handle both standard .ts files and obfuscated URLs that serve video segments
        headers['Accept'] = 'video/mp2t, application/octet-stream, */*';
        headers['Range'] = 'bytes=0-';
        // Remove Accept-Encoding for video segments
        delete headers['Accept-Encoding'];
      }
      
      // Remove browser security headers that might trigger blocking
      delete headers['Sec-Fetch-Dest'];
      delete headers['Sec-Fetch-Mode'];
      delete headers['Sec-Fetch-Site'];
      
    } else {
      // Standard CORS bypass headers for other domains
      headers['Sec-Fetch-Dest'] = 'empty';
      headers['Sec-Fetch-Mode'] = 'cors';
      headers['Sec-Fetch-Site'] = 'cross-site';
      
      // Add referer and origin for fragment requests
      if (decodedUrl.includes('.ts') || decodedUrl.includes('seg-') || decodedUrl.includes('chunk-') || decodedUrl.includes('.m3u8')) {
        headers['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
        headers['Origin'] = `${urlObj.protocol}//${urlObj.host}`;
      } else {
        // Default referer and origin for other requests
        headers['Referer'] = 'https://replit.com/';
        headers['Origin'] = req.get('origin') || 'https://replit.com';
      }
    }

    // Use fetch with timeout and retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 2; // Reduced retries for faster failure

    while (retryCount <= maxRetries) {
      try {
        const controller = new AbortController();
        // Increased timeout for shadowlandschronicles due to their slower response times
        const timeoutDuration = (hostname.includes('shadowlandschronicles') || hostname.includes('tmstr')) ? 20000 : 10000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        // Enhanced fetch options for protected services
        const fetchOptions = {
          method: 'GET',
          headers: headers,
          signal: controller.signal,
          redirect: 'follow',
          credentials: 'omit'
        };
        
        // For shadowlandschronicles, add additional options
        if (hostname.includes('shadowlandschronicles') || hostname.includes('tmstr')) {
          fetchOptions.mode = 'cors';
          fetchOptions.cache = 'no-cache';
        }
        
        response = await fetch(decodedUrl, fetchOptions);

        clearTimeout(timeoutId);

        if (response.ok) {
          break; // Success, exit retry loop
        } else if (retryCount < maxRetries && (response.status >= 500)) {
          console.log(`Retry ${retryCount + 1}/${maxRetries} for ${decodedUrl} (status: ${response.status})`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Faster backoff
          continue;
        } else {
          break; // Non-retryable error
        }
      } catch (fetchError) {
        if (retryCount < maxRetries && (fetchError.name === 'AbortError' || fetchError.name === 'TypeError')) {
          console.log(`Retry ${retryCount + 1}/${maxRetries} for ${decodedUrl} due to ${fetchError.name}`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          continue;
        } else {
          throw fetchError; // Re-throw if max retries reached
        }
      }
    }

    if (!response.ok) {
      console.error(`Upstream server returned ${response.status} for ${decodedUrl}`);

      // Check if we got HTML instead of expected content
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') && (decodedUrl.includes('.ts') || decodedUrl.includes('.m3u8'))) {
        console.error('Received HTML instead of expected media content');
        
        // Special handling for shadowlandschronicles blocking
        if (hostname.includes('shadowlandschronicles') || hostname.includes('tmstr')) {
          console.error('shadowlandschronicles.com returned HTML instead of M3U8 - trying alternative approach');
          
          // Try one more time with minimal headers
          try {
            const retryHeaders = {
              'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
              'Accept': '*/*',
              'Connection': 'keep-alive'
            };
            
            const retryResponse = await fetch(decodedUrl, {
              method: 'GET',
              headers: retryHeaders,
              redirect: 'follow',
              credentials: 'omit'
            });
            
            if (retryResponse.ok) {
              const retryContentType = retryResponse.headers.get('content-type') || '';
              if (!retryContentType.includes('text/html')) {
                // Success with alternative headers
                if (retryContentType) {
                  res.set('Content-Type', retryContentType);
                }
                res.set('Access-Control-Allow-Origin', '*');
                const buffer = await retryResponse.arrayBuffer();
                return res.send(Buffer.from(buffer));
              }
            }
          } catch (retryError) {
            console.error('Retry attempt failed:', retryError.message);
          }
          
          return res.status(403).json({
            error: 'Stream blocked by server',
            details: 'shadowlandschronicles.com is actively blocking proxy requests. The service has advanced protection.',
            suggestion: 'Try using a different stream source or access the content directly from their website.'
          });
        }
        
        return res.status(404).json({
          error: 'Invalid media stream',
          details: 'The stream appears to be broken or redirected to a webpage'
        });
      }

      // For HLS fragments, try to return a more specific error
      if (response.status === 404 && (decodedUrl.includes('.ts') || decodedUrl.includes('seg-'))) {
        return res.status(404).json({
          error: 'Video segment not found',
          details: 'This video segment may have expired or moved'
        });
      }

      return res.status(response.status).json({
        error: `Upstream server returned ${response.status}`,
        url: decodedUrl
      });
    }

    // Check content type and handle special cases
    const contentType = response.headers.get('content-type') || '';
    
    // Handle M3U8 playlist rewriting and MIME type correction
    if (contentType.includes('application/vnd.apple.mpegurl') || decodedUrl.includes('.m3u8')) {
      // It's an M3U8 playlist - rewrite segment URLs
      let body = await response.text();
      
      // Rewrite all .html segment links to .ts
      body = body.replace(/\.html/g, ".ts");
      
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Access-Control-Allow-Origin', '*');
      return res.send(body);
      
    } else if (decodedUrl.includes('radiantquestlab.xyz') && decodedUrl.includes('page-')) {
      // ALWAYS treat radiantquestlab.xyz page-X.html as video segments, ignore server content-type
      console.log('Force-correcting radiantquestlab.xyz obfuscated video segment:', decodedUrl);
      res.set('Content-Type', 'video/mp2t');
      
    } else if ((decodedUrl.includes('.ts') || decodedUrl.includes('.m4s')) && contentType.includes('text/html')) {
      // Standard .ts segments that are mislabeled as HTML
      console.log('Force-correcting Content-Type for .ts segment:', decodedUrl);
      res.set('Content-Type', 'video/mp2t');
      
    } else if (contentType.includes('text/html') && (decodedUrl.includes('.m3u8') || decodedUrl.includes('index'))) {
      // Only reject HTML for actual manifest files
      const buffer = await response.arrayBuffer();
      const textContent = Buffer.from(buffer).toString('utf8');
      
      if (textContent.length < 500) {
        console.error('Received HTML instead of expected M3U8 manifest');
        return res.status(404).json({
          error: 'Invalid manifest',
          details: 'Expected M3U8 manifest but received HTML content'
        });
      }
      
      res.set('Content-Type', contentType);
    } else {
      // Use original content type for all other responses
      res.set('Content-Type', contentType);
    }

    // Forward important response headers
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }
    if (contentRange) {
      res.set('Content-Range', contentRange);
    }
    if (acceptRanges) {
      res.set('Accept-Ranges', acceptRanges);
    }

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, Range');
    res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // Set cache headers for HLS content
    if (decodedUrl.includes('.m3u8')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (decodedUrl.includes('.ts') || decodedUrl.includes('seg-')) {
      res.set('Cache-Control', 'public, max-age=3600');
    }

    // Set proper status code for range requests
    if (response.status === 206) {
      res.status(206);
    }

    // Stream the response body directly
    if (response.body) {
      response.body.pipe(res);
    } else {
      // Fallback for cases where body is not readable stream
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error('Proxy error:', error);

    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout', details: 'The upstream server took too long to respond' });
    }

    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
});

// Handle OPTIONS requests for CORS preflight
app.options('*', cors());

// Serve the React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Build not found. Please run "npm run build" first.');
  }
});

// Start the server with better error handling
const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server successfully started on port ${PORT}`);
    console.log(`🌍 Server is accessible externally at http://0.0.0.0:${PORT}`);
    console.log(`🔗 Proxy endpoint: /proxy?url=YOUR_M3U8_URL`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
    console.log(`🎬 Visit the app at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
  });

  server.on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error('Unknown server error:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  });

  return server;
};

// Add explicit logging before starting
console.log('🚀 Starting server initialization...');
console.log('Current working directory:', process.cwd());
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Start the server
try {
  startServer();
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}