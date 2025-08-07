// Socket.io Origin Fix
// Ensures Socket.io always connects to the current page's origin
(function() {
    // Store the original io function
    const originalIo = window.io;
    
    // Override the io function
    window.io = function(url, options) {
        // If no URL provided or URL is a relative path, use current origin
        if (!url || typeof url === 'object') {
            // If url is actually options (no URL provided)
            options = url || {};
            url = window.location.origin;
        } else if (url.startsWith('/')) {
            // Relative URL, prepend origin
            url = window.location.origin + url;
        }
        
        console.log('[Socket.io Fix] Connecting to:', url);
        
        // Call original io with corrected URL
        return originalIo.call(this, url, options);
    };
    
    // Copy properties from original io
    Object.keys(originalIo).forEach(key => {
        window.io[key] = originalIo[key];
    });
    
    console.log('[Socket.io Fix] Applied - will force connections to:', window.location.origin);
})();