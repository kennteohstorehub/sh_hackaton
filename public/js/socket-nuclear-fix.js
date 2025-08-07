// NUCLEAR Socket.io Fix - Forces ALL connections to current origin
// This MUST be loaded IMMEDIATELY after socket.io.js

(function() {
    console.log('[NUCLEAR FIX] Applying Socket.io override...');
    
    // Wait for io to be available
    if (typeof io === 'undefined') {
        console.error('[NUCLEAR FIX] Socket.io not loaded yet! This script must run AFTER socket.io.js');
        return;
    }
    
    // Store original io
    const _originalIo = window.io;
    
    // Create interceptor
    window.io = function(url, opts) {
        // Log what was requested
        console.log('[NUCLEAR FIX] Intercepted io() call:', { url, opts });
        
        // Force current origin no matter what
        const forcedUrl = window.location.origin;
        
        // If url was an object (options), move it to opts
        if (typeof url === 'object' && url !== null) {
            opts = url;
            url = forcedUrl;
        } else {
            url = forcedUrl;
        }
        
        // Force options
        opts = opts || {};
        opts.transports = opts.transports || ['websocket', 'polling'];
        
        console.log('[NUCLEAR FIX] Forcing connection to:', forcedUrl);
        console.log('[NUCLEAR FIX] With options:', opts);
        
        // Create socket with forced URL
        const socket = _originalIo(forcedUrl, opts);
        
        // Log connection events
        socket.on('connect', () => {
            console.log('[NUCLEAR FIX] ✅ Connected to:', forcedUrl);
        });
        
        socket.on('connect_error', (error) => {
            console.error('[NUCLEAR FIX] ❌ Connection error:', error.message);
            console.error('[NUCLEAR FIX] Attempted URL:', forcedUrl);
        });
        
        return socket;
    };
    
    // Copy all properties
    for (let prop in _originalIo) {
        if (_originalIo.hasOwnProperty(prop)) {
            window.io[prop] = _originalIo[prop];
        }
    }
    
    // Also override Manager if it exists
    if (window.io.Manager) {
        const _originalManager = window.io.Manager;
        window.io.Manager = function(uri, opts) {
            console.log('[NUCLEAR FIX] Manager intercepted, forcing:', window.location.origin);
            return new _originalManager(window.location.origin, opts);
        };
        
        // Copy Manager properties
        for (let prop in _originalManager) {
            if (_originalManager.hasOwnProperty(prop)) {
                window.io.Manager[prop] = _originalManager[prop];
            }
        }
        window.io.Manager.prototype = _originalManager.prototype;
    }
    
    console.log('[NUCLEAR FIX] ✅ Override complete. All Socket.io connections will use:', window.location.origin);
    
    // Also set a global flag
    window.SOCKET_IO_NUCLEAR_FIX_APPLIED = true;
    window.FORCED_SOCKET_ORIGIN = window.location.origin;
})();