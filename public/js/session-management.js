/**
 * Session Management and Timeout Handling
 * Provides user-friendly session timeout notifications and management
 */

class SessionManager {
  constructor(options = {}) {
    this.options = {
      warningTime: options.warningTime || 5 * 60 * 1000, // 5 minutes before expiry
      sessionDuration: options.sessionDuration || 30 * 60 * 1000, // 30 minutes total
      checkInterval: options.checkInterval || 30 * 1000, // Check every 30 seconds
      isBackOffice: options.isBackOffice || false,
      extendUrl: options.extendUrl || '/auth/extend-session',
      logoutUrl: options.logoutUrl || '/auth/logout',
      ...options
    };
    
    this.warningShown = false;
    this.modal = null;
    this.countdownTimer = null;
    this.sessionTimer = null;
    this.lastActivity = Date.now();
    
    this.init();
  }
  
  init() {
    this.createModal();
    this.bindEvents();
    this.startSessionTimer();
    this.trackActivity();
  }
  
  createModal() {
    const modalHTML = `
      <div class="session-timeout-modal" id="sessionTimeoutModal" role="dialog" aria-labelledby="sessionTimeoutTitle" aria-describedby="sessionTimeoutMessage">
        <div class="session-timeout-content">
          <h3 class="session-timeout-title" id="sessionTimeoutTitle">
            ⏰ Session Expiring Soon
          </h3>
          <p class="session-timeout-message" id="sessionTimeoutMessage">
            Your session will expire in <strong><span id="countdownDisplay">5:00</span></strong> due to inactivity.
            ${this.options.isBackOffice ? 'This is for security purposes.' : ''}
          </p>
          <div class="session-timeout-timer">
            <div class="countdown-circle">
              <span id="countdownNumber">300</span>
            </div>
          </div>
          <div class="session-timeout-actions">
            <button class="btn-extend-session" id="extendSessionBtn" onclick="sessionManager.extendSession()">
              🔄 Stay Signed In
            </button>
            <button class="btn-logout-now" id="logoutNowBtn" onclick="sessionManager.logoutNow()">
              🚪 Sign Out Now
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('sessionTimeoutModal');
  }
  
  bindEvents() {
    // Track user activity
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activities.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });
    
    // Keyboard accessibility for modal
    document.addEventListener('keydown', (e) => {
      if (this.modal && this.modal.classList.contains('show')) {
        if (e.key === 'Escape') {
          this.extendSession();
        } else if (e.key === 'Enter') {
          if (document.activeElement === document.getElementById('logoutNowBtn')) {
            this.logoutNow();
          } else {
            this.extendSession();
          }
        }
      }
    });
  }
  
  updateActivity() {
    this.lastActivity = Date.now();
    if (this.warningShown) {
      this.hideWarning();
    }
  }
  
  startSessionTimer() {
    // Clear any existing timer
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
    
    this.sessionTimer = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivity;
      const timeUntilWarning = this.options.sessionDuration - this.options.warningTime;
      
      if (timeSinceActivity >= timeUntilWarning && !this.warningShown) {
        this.showWarning();
      } else if (timeSinceActivity >= this.options.sessionDuration) {
        this.forceLogout();
      }
    }, this.options.checkInterval);
  }
  
  showWarning() {
    this.warningShown = true;
    this.modal.classList.add('show');
    this.modal.setAttribute('aria-hidden', 'false');
    
    // Focus the extend session button for accessibility
    setTimeout(() => {
      document.getElementById('extendSessionBtn').focus();
    }, 100);
    
    // Start countdown
    this.startCountdown();
    
    // Add body class to prevent scrolling
    document.body.style.overflow = 'hidden';
    
    // Log warning event
    this.logEvent('session_warning_shown');
  }
  
  hideWarning() {
    this.warningShown = false;
    this.modal.classList.remove('show');
    this.modal.setAttribute('aria-hidden', 'true');
    
    // Stop countdown
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    this.logEvent('session_warning_dismissed');
  }
  
  startCountdown() {
    const warningDuration = this.options.warningTime;
    let timeLeft = Math.floor(warningDuration / 1000);
    
    const countdownDisplay = document.getElementById('countdownDisplay');
    const countdownNumber = document.getElementById('countdownNumber');
    
    this.countdownTimer = setInterval(() => {
      timeLeft--;
      
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      countdownDisplay.textContent = displayTime;
      countdownNumber.textContent = timeLeft;
      
      // Change color as time runs out
      if (timeLeft <= 30) {
        countdownNumber.style.color = '#ef4444';
        countdownDisplay.style.color = '#ef4444';
      } else if (timeLeft <= 60) {
        countdownNumber.style.color = '#f59e0b';
        countdownDisplay.style.color = '#f59e0b';
      }
      
      if (timeLeft <= 0) {
        clearInterval(this.countdownTimer);
        this.forceLogout();
      }
    }, 1000);
  }
  
  async extendSession() {
    try {
      const response = await fetch(this.options.extendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        this.updateActivity();
        this.hideWarning();
        this.showSuccessMessage('Session extended successfully');
        this.logEvent('session_extended');
      } else {
        throw new Error('Failed to extend session');
      }
    } catch (error) {
      console.error('Error extending session:', error);
      this.showErrorMessage('Failed to extend session. You may need to sign in again.');
      setTimeout(() => this.forceLogout(), 3000);
    }
  }
  
  logoutNow() {
    this.logEvent('manual_logout_from_warning');
    this.performLogout();
  }
  
  forceLogout() {
    this.logEvent('session_expired_forced_logout');
    this.performLogout();
  }
  
  performLogout() {
    // Show logout message
    this.showInfoMessage('Signing you out...', false);
    
    // Perform logout
    if (this.options.logoutUrl.includes('backoffice')) {
      // BackOffice logout with CSRF
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = this.options.logoutUrl;
      
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_csrf';
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);
      }
      
      document.body.appendChild(form);
      form.submit();
    } else {
      // Regular logout
      window.location.href = this.options.logoutUrl;
    }
  }
  
  trackActivity() {
    // Send periodic activity updates to server
    setInterval(() => {
      if (Date.now() - this.lastActivity < this.options.checkInterval * 2) {
        fetch('/auth/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          credentials: 'include',
          body: JSON.stringify({
            timestamp: this.lastActivity,
            page: window.location.pathname
          })
        }).catch(() => {
          // Silently handle errors - server might be down
        });
      }
    }, this.options.checkInterval * 3);
  }
  
  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }
  
  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }
  
  showInfoMessage(message, autoHide = true) {
    this.showNotification(message, 'info', autoHide);
  }
  
  showNotification(message, type = 'info', autoHide = true) {
    // Remove existing notifications
    const existing = document.querySelectorAll('.session-notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `session-notification session-notification-${type}`;
    notification.innerHTML = `
      <div class="session-notification-content">
        <span class="session-notification-icon">
          ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
        </span>
        <span class="session-notification-message">${message}</span>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 
                    type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 
                    'rgba(59, 130, 246, 0.9)'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 400px;
      font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto hide
    if (autoHide) {
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }
  
  logEvent(eventType) {
    try {
      fetch('/auth/log-session-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({
          event: eventType,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          page: window.location.pathname
        })
      }).catch(() => {
        // Silently handle errors
      });
    } catch (error) {
      // Silently handle errors
    }
  }
  
  // Public method to manually reset session
  resetSession() {
    this.updateActivity();
    if (this.warningShown) {
      this.hideWarning();
    }
  }
  
  // Public method to check session status
  getSessionStatus() {
    const timeSinceActivity = Date.now() - this.lastActivity;
    const timeUntilWarning = this.options.sessionDuration - this.options.warningTime;
    const timeUntilExpiry = this.options.sessionDuration;
    
    return {
      isActive: timeSinceActivity < timeUntilWarning,
      isWarning: timeSinceActivity >= timeUntilWarning && timeSinceActivity < timeUntilExpiry,
      isExpired: timeSinceActivity >= timeUntilExpiry,
      timeUntilWarning: Math.max(0, timeUntilWarning - timeSinceActivity),
      timeUntilExpiry: Math.max(0, timeUntilExpiry - timeSinceActivity)
    };
  }
  
  // Cleanup method
  destroy() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    if (this.modal) {
      this.modal.remove();
    }
  }
}

// Auto-initialize based on page context
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a protected page
  const isProtectedPage = document.body.classList.contains('protected-page') || 
                          window.location.pathname.includes('/dashboard') ||
                          window.location.pathname.includes('/backoffice');
  
  if (isProtectedPage) {
    const isBackOffice = window.location.pathname.includes('/backoffice');
    
    window.sessionManager = new SessionManager({
      isBackOffice: isBackOffice,
      sessionDuration: isBackOffice ? 45 * 60 * 1000 : 30 * 60 * 1000, // 45 min for admin, 30 for users
      warningTime: 5 * 60 * 1000, // 5 minutes warning
      extendUrl: isBackOffice ? '/backoffice/auth/extend-session' : '/auth/extend-session',
      logoutUrl: isBackOffice ? '/backoffice/auth/logout' : '/auth/logout'
    });
  }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionManager;
}