// Navigation Preloading for Faster Page Transitions
(function() {
  'use strict';
  
  // Cache for preloaded pages
  const pageCache = new Map();
  const MAX_CACHE_SIZE = 5;
  
  // Preload link on hover with delay
  let preloadTimer;
  
  function preloadPage(url) {
    // Don't preload if already cached
    if (pageCache.has(url)) return;
    
    // Create a hidden link with prefetch
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
    
    // Mark as cached
    pageCache.set(url, true);
    
    // Limit cache size
    if (pageCache.size > MAX_CACHE_SIZE) {
      const firstKey = pageCache.keys().next().value;
      pageCache.delete(firstKey);
    }
  }
  
  // Add hover preloading to navigation links
  document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav a, .nav-link');
    
    navLinks.forEach(link => {
      // Preload on hover after 200ms
      link.addEventListener('mouseenter', function() {
        clearTimeout(preloadTimer);
        preloadTimer = setTimeout(() => {
          preloadPage(link.href);
        }, 200);
      });
      
      // Cancel preload if mouse leaves quickly
      link.addEventListener('mouseleave', function() {
        clearTimeout(preloadTimer);
      });
      
      // Add loading indicator on click
      link.addEventListener('click', function() {
        if (!link.classList.contains('loading')) {
          link.classList.add('loading');
          // Add subtle loading indicator
          const originalText = link.innerHTML;
          link.innerHTML = `<span style="opacity: 0.7">${originalText}</span>`;
        }
      });
    });
  });
  
  // Preload critical resources
  function preloadCriticalResources() {
    // Preload common CSS/JS that will be needed
    const resources = [
      '/css/common-header.css',
      '/css/dashboard.css',
      '/socket.io/socket.io.js'
    ];
    
    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.as = resource.endsWith('.css') ? 'style' : 'script';
      document.head.appendChild(link);
    });
  }
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadCriticalResources);
  } else {
    preloadCriticalResources();
  }
})();