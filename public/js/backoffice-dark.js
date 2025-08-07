// Backoffice Dark Theme JavaScript

(function() {
  'use strict';

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    initializeSearch();
    initializeNotifications();
    initializeSidebarHover();
    initializeAnimations();
  });

  // Theme Management
  function initializeTheme() {
    // Ensure dark theme is applied
    document.body.classList.add('dark-theme');
    
    // Store theme preference
    localStorage.setItem('backoffice-theme', 'dark');
  }

  // Search Functionality
  function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      const query = e.target.value.toLowerCase();
      
      // Debounce search
      searchTimeout = setTimeout(() => {
        if (query.length > 2) {
          performSearch(query);
        } else {
          clearSearchResults();
        }
      }, 300);
    });

    // Focus search on Cmd/Ctrl + K
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  function performSearch(query) {
    // This would typically make an API call
    console.log('Searching for:', query);
    // Add visual feedback
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.classList.add('searching');
      setTimeout(() => {
        searchContainer.classList.remove('searching');
      }, 1000);
    }
  }

  function clearSearchResults() {
    // Clear any search results
  }

  // Notification System
  function initializeNotifications() {
    const notificationBadge = document.querySelector('.notification-badge');
    if (!notificationBadge) return;

    notificationBadge.addEventListener('click', function() {
      // Toggle notification panel
      toggleNotificationPanel();
    });

    // Check for new notifications periodically
    setInterval(checkNotifications, 30000);
  }

  function toggleNotificationPanel() {
    // This would show/hide a notification dropdown
    console.log('Toggle notifications');
  }

  function checkNotifications() {
    // This would check for new notifications via API
    fetch('/backoffice/api/notifications/count')
      .then(response => response.json())
      .then(data => {
        const badge = document.querySelector('.notification-badge');
        if (badge && data.count > 0) {
          badge.classList.add('has-notifications');
        }
      })
      .catch(error => console.error('Error checking notifications:', error));
  }

  // Sidebar Hover Effects
  function initializeSidebarHover() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Persist sidebar state
    const sidebarExpanded = localStorage.getItem('sidebar-expanded') === 'true';
    if (sidebarExpanded) {
      sidebar.classList.add('expanded');
    }

    // Double-click to toggle persistent state
    sidebar.addEventListener('dblclick', function() {
      sidebar.classList.toggle('expanded');
      localStorage.setItem('sidebar-expanded', sidebar.classList.contains('expanded'));
    });
  }

  // Smooth Animations
  function initializeAnimations() {
    // Animate number counters
    const statValues = document.querySelectorAll('.stats-value');
    statValues.forEach(stat => {
      animateValue(stat, 0, parseInt(stat.textContent) || 0, 1000);
    });

    // Stagger animations for dashboard elements
    const animatedElements = document.querySelectorAll('.dashboard-animate');
    animatedElements.forEach((el, index) => {
      el.style.animationDelay = `${index * 50}ms`;
    });
  }

  // Utility function to animate numbers
  function animateValue(element, start, end, duration) {
    if (start === end) return;
    
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      element.textContent = current;
      if (current === end) {
        clearInterval(timer);
      }
    }, stepTime);
  }

  // Chart Theme Updates
  window.updateChartTheme = function(isDark) {
    if (typeof ApexCharts === 'undefined') return;
    
    // Update all charts to match theme
    Apex.theme = {
      mode: isDark ? 'dark' : 'light'
    };
  };

  // Export functions for external use
  window.backofficeUtils = {
    showNotification: function(message, type = 'info') {
      // Create toast notification
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--dark-bg-card);
        color: var(--dark-text-primary);
        border: 1px solid var(--dark-border);
        border-radius: 8px;
        box-shadow: var(--dark-shadow-lg);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
      `;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
    
    confirmAction: function(message) {
      return confirm(message);
    }
  };

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .search-container.searching .search-icon {
      animation: pulse 1s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `;
  document.head.appendChild(style);

})();