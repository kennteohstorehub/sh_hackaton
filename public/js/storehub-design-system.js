// StoreHub Design System JavaScript Implementation
// Handles dynamic styling, font loading, and interactive components

(function() {
  'use strict';

  // Load Open Sans font from Google Fonts
  function loadFonts() {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  // Initialize design system
  function initDesignSystem() {
    loadFonts();
    initButtons();
    initForms();
    initToasts();
    initModals();
    initTables();
    initQueueCards();
    applyThemeClasses();
  }

  // Apply theme classes to existing elements
  function applyThemeClasses() {
    // Convert existing buttons
    document.querySelectorAll('.btn-primary, .btn-success').forEach(btn => {
      if (!btn.classList.contains('btn')) {
        btn.classList.add('btn');
      }
    });

    // Convert existing forms
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], textarea, select').forEach(input => {
      if (!input.classList.contains('form-control')) {
        input.classList.add('form-control');
      }
    });

    // Add form-group wrapper if missing
    document.querySelectorAll('.form-control').forEach(input => {
      const parent = input.parentElement;
      if (!parent.classList.contains('form-group')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        
        // Move label if exists
        const label = parent.querySelector('label');
        if (label && label.getAttribute('for') === input.id) {
          wrapper.insertBefore(label, input);
          label.classList.add('form-label');
        }
      }
    });

    // Style tables
    document.querySelectorAll('table').forEach(table => {
      if (!table.classList.contains('table')) {
        table.classList.add('table');
      }
    });

    // Style cards
    document.querySelectorAll('.card, .panel').forEach(card => {
      if (!card.classList.contains('card')) {
        card.classList.add('card');
      }
    });
  }

  // Initialize button interactions
  function initButtons() {
    document.addEventListener('click', function(e) {
      if (e.target.matches('.btn')) {
        // Add ripple effect
        const btn = e.target;
        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        btn.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      }
    });
  }

  // Initialize form validation styling
  function initForms() {
    document.addEventListener('blur', function(e) {
      if (e.target.matches('.form-control')) {
        validateField(e.target);
      }
    }, true);

    document.addEventListener('input', function(e) {
      if (e.target.matches('.form-control.is-invalid')) {
        validateField(e.target);
      }
    });
  }

  // Field validation
  function validateField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required');
    
    if (isRequired && !value) {
      field.classList.add('is-invalid');
      showFieldError(field, 'This field is required');
    } else if (field.type === 'email' && value && !isValidEmail(value)) {
      field.classList.add('is-invalid');
      showFieldError(field, 'Please enter a valid email address');
    } else {
      field.classList.remove('is-invalid');
      hideFieldError(field);
    }
  }

  // Show field error
  function showFieldError(field, message) {
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    let errorEl = formGroup.querySelector('.form-text.text-danger');
    if (!errorEl) {
      errorEl = document.createElement('small');
      errorEl.className = 'form-text text-danger';
      formGroup.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  // Hide field error
  function hideFieldError(field) {
    const formGroup = field.closest('.form-group');
    if (!formGroup) return;
    
    const errorEl = formGroup.querySelector('.form-text.text-danger');
    if (errorEl) {
      errorEl.remove();
    }
  }

  // Email validation
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Initialize toast notifications
  function initToasts() {
    // Create toast container if not exists
    if (!document.querySelector('.toast-container')) {
      const container = document.createElement('div');
      container.className = 'toast-container';
      container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1050;';
      document.body.appendChild(container);
    }
  }

  // Show toast notification
  window.showToast = function(message, type = 'info', duration = 4000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast alert alert-${type} fade-in`;
    toast.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        <span>${message}</span>
        <button type="button" class="btn-text" onclick="this.closest('.toast').remove()">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // Initialize modals
  function initModals() {
    // Close modal on backdrop click
    document.addEventListener('click', function(e) {
      if (e.target.matches('.modal-backdrop')) {
        closeModal();
      }
    });

    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.querySelector('.modal-backdrop')) {
        closeModal();
      }
    });
  }

  // Open modal
  window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade-in';
    document.body.appendChild(backdrop);
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.add('fade-in');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  };

  // Close modal
  window.closeModal = function() {
    const modal = document.querySelector('.modal[style*="display: block"]');
    const backdrop = document.querySelector('.modal-backdrop');
    
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('fade-in');
    }
    
    if (backdrop) {
      backdrop.remove();
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
  };

  // Initialize sortable tables
  function initTables() {
    document.querySelectorAll('.table-sortable th').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', function() {
        sortTable(this);
      });
    });
  }

  // Sort table
  function sortTable(th) {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const columnIndex = Array.from(th.parentElement.children).indexOf(th);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = th.classList.contains('sort-asc');
    
    // Remove sort classes from all headers
    table.querySelectorAll('th').forEach(header => {
      header.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Sort rows
    rows.sort((a, b) => {
      const aValue = a.children[columnIndex].textContent.trim();
      const bValue = b.children[columnIndex].textContent.trim();
      
      // Try to parse as number
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return isAscending ? bNum - aNum : aNum - bNum;
      }
      
      // Sort as string
      return isAscending 
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue);
    });
    
    // Add sort class to current header
    th.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
    
    // Reorder rows
    rows.forEach(row => tbody.appendChild(row));
  }

  // Initialize queue cards
  function initQueueCards() {
    // Add hover effects and click handlers
    document.querySelectorAll('.queue-card').forEach(card => {
      card.style.cursor = 'pointer';
      
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px)';
        this.style.boxShadow = 'var(--shadow-lg)';
      });
      
      card.addEventListener('mouseleave', function() {
        this.style.transform = '';
        this.style.boxShadow = '';
      });
    });
  }

  // Utility function to format time
  window.formatTime = function(date) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Utility function to format wait time
  window.formatWaitTime = function(minutes) {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Add ripple effect styles
  const style = document.createElement('style');
  style.textContent = `
    .btn {
      position: relative;
      overflow: hidden;
    }
    
    .ripple {
      position: absolute;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.3);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
    }
    
    @keyframes ripple-animation {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
    
    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .table th.sort-asc::after {
      content: ' ↑';
      opacity: 0.6;
    }
    
    .table th.sort-desc::after {
      content: ' ↓';
      opacity: 0.6;
    }
  `;
  document.head.appendChild(style);

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDesignSystem);
  } else {
    initDesignSystem();
  }

  // Re-apply theme on dynamic content
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        applyThemeClasses();
      }
    });
  });

  // Only observe if document.body exists
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    });
  }

})();