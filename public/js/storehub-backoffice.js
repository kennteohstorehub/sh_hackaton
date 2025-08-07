// StoreHub BackOffice JavaScript - Interactive Behaviors
// ======================================================

(function() {
  'use strict';

  // Design System Configuration
  const config = {
    animations: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
    },
    colors: {
      primary: '#FA8C16',
      success: '#52C41A',
      warning: '#FADB14',
      error: '#CF1322',
      info: '#1890FF'
    }
  };

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeSearch();
    initializeNotifications();
    initializeTooltips();
    initializeForms();
    initializeTables();
    initializeCharts();
    initializeAnimations();
    initializeModals();
    initializeRealTimeUpdates();
  });

  // Sidebar Management
  function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    // Mobile menu toggle
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function() {
        sidebar.classList.toggle('mobile-open');
        document.body.classList.toggle('sidebar-open');
      });
    }
    
    // Sidebar collapse toggle
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
      });
    }
    
    // Restore sidebar state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
    }
    
    // Close mobile sidebar on outside click
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768 && 
          sidebar.classList.contains('mobile-open') &&
          !sidebar.contains(e.target) &&
          !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
        document.body.classList.remove('sidebar-open');
      }
    });
    
    // Handle active nav item
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') === currentPath) {
        item.classList.add('active');
      }
    });
  }

  // Search Functionality
  function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    
    if (searchInput) {
      searchInput.parentElement.appendChild(searchResults);
      
      let searchTimeout;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length > 2) {
          searchTimeout = setTimeout(() => performSearch(query, searchResults), 300);
        } else {
          searchResults.innerHTML = '';
          searchResults.classList.remove('active');
        }
      });
      
      // Close search results on outside click
      document.addEventListener('click', function(e) {
        if (!searchInput.parentElement.contains(e.target)) {
          searchResults.innerHTML = '';
          searchResults.classList.remove('active');
        }
      });
    }
  }
  
  function performSearch(query, resultsContainer) {
    // Simulate search API call
    fetch(`/backoffice/api/search?q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        displaySearchResults(data, resultsContainer);
      })
      .catch(error => {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
      });
  }
  
  function displaySearchResults(results, container) {
    if (!results || results.length === 0) {
      container.innerHTML = '<div class="search-no-results">No results found</div>';
      container.classList.add('active');
      return;
    }
    
    const html = results.map(result => `
      <a href="${result.url}" class="search-result-item">
        <span class="search-result-icon">${result.icon || '📄'}</span>
        <div class="search-result-content">
          <div class="search-result-title">${result.title}</div>
          <div class="search-result-description">${result.description}</div>
        </div>
      </a>
    `).join('');
    
    container.innerHTML = html;
    container.classList.add('active');
  }

  // Notifications System
  function initializeNotifications() {
    const notificationBadge = document.querySelector('.notification-badge');
    
    if (notificationBadge) {
      notificationBadge.addEventListener('click', function() {
        toggleNotificationPanel();
      });
      
      // Check for new notifications periodically
      setInterval(checkNotifications, 60000); // Every minute
    }
  }
  
  function toggleNotificationPanel() {
    let panel = document.querySelector('.notification-panel');
    
    if (!panel) {
      panel = createNotificationPanel();
      document.body.appendChild(panel);
    }
    
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
      loadNotifications();
    }
  }
  
  function createNotificationPanel() {
    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.innerHTML = `
      <div class="notification-header">
        <h3>Notifications</h3>
        <button class="notification-close">&times;</button>
      </div>
      <div class="notification-content">
        <div class="notification-loading">Loading...</div>
      </div>
      <div class="notification-footer">
        <a href="/backoffice/notifications">View All</a>
      </div>
    `;
    
    panel.querySelector('.notification-close').addEventListener('click', () => {
      panel.classList.remove('active');
    });
    
    return panel;
  }
  
  function loadNotifications() {
    fetch('/backoffice/api/notifications')
      .then(response => response.json())
      .then(notifications => {
        displayNotifications(notifications);
      })
      .catch(error => {
        console.error('Failed to load notifications:', error);
      });
  }
  
  function displayNotifications(notifications) {
    const content = document.querySelector('.notification-content');
    
    if (!notifications || notifications.length === 0) {
      content.innerHTML = '<div class="notification-empty">No new notifications</div>';
      return;
    }
    
    const html = notifications.map(notification => `
      <div class="notification-item ${notification.read ? '' : 'unread'}">
        <div class="notification-icon">${notification.icon || '🔔'}</div>
        <div class="notification-body">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${formatTime(notification.timestamp)}</div>
        </div>
      </div>
    `).join('');
    
    content.innerHTML = html;
  }
  
  function checkNotifications() {
    fetch('/backoffice/api/notifications/count')
      .then(response => response.json())
      .then(data => {
        const badge = document.querySelector('.notification-badge');
        if (data.count > 0) {
          badge.classList.add('has-notifications');
          badge.setAttribute('data-count', data.count);
        } else {
          badge.classList.remove('has-notifications');
          badge.removeAttribute('data-count');
        }
      });
  }

  // Tooltips
  function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      element.addEventListener('mouseenter', showTooltip);
      element.addEventListener('mouseleave', hideTooltip);
    });
  }
  
  function showTooltip(e) {
    const text = e.target.getAttribute('data-tooltip');
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = e.target.getBoundingClientRect();
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
    tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
    
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
    
    e.target._tooltip = tooltip;
  }
  
  function hideTooltip(e) {
    const tooltip = e.target._tooltip;
    if (tooltip) {
      tooltip.classList.remove('visible');
      setTimeout(() => tooltip.remove(), 200);
      e.target._tooltip = null;
    }
  }

  // Form Enhancements
  function initializeForms() {
    // Auto-save draft
    document.querySelectorAll('form[data-autosave]').forEach(form => {
      initializeAutoSave(form);
    });
    
    // Form validation
    document.querySelectorAll('form[data-validate]').forEach(form => {
      initializeFormValidation(form);
    });
    
    // File upload
    document.querySelectorAll('.file-upload').forEach(upload => {
      initializeFileUpload(upload);
    });
  }
  
  function initializeAutoSave(form) {
    const formId = form.getAttribute('id') || 'form_' + Date.now();
    let saveTimeout;
    
    form.addEventListener('input', function() {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        localStorage.setItem(`draft_${formId}`, JSON.stringify(data));
        showToast('Draft saved', 'info');
      }, 2000);
    });
    
    // Restore draft on load
    const draft = localStorage.getItem(`draft_${formId}`);
    if (draft) {
      const data = JSON.parse(draft);
      Object.keys(data).forEach(key => {
        const field = form.elements[key];
        if (field) field.value = data[key];
      });
      showToast('Draft restored', 'info');
    }
    
    // Clear draft on submit
    form.addEventListener('submit', function() {
      localStorage.removeItem(`draft_${formId}`);
    });
  }
  
  function initializeFormValidation(form) {
    form.addEventListener('submit', function(e) {
      const errors = validateForm(form);
      
      if (errors.length > 0) {
        e.preventDefault();
        displayFormErrors(form, errors);
      }
    });
    
    // Real-time validation
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('blur', function() {
        validateField(field);
      });
    });
  }
  
  function validateForm(form) {
    const errors = [];
    
    form.querySelectorAll('[required]').forEach(field => {
      if (!field.value.trim()) {
        errors.push({
          field: field.name,
          message: `${field.getAttribute('data-label') || field.name} is required`
        });
      }
    });
    
    form.querySelectorAll('[type="email"]').forEach(field => {
      if (field.value && !isValidEmail(field.value)) {
        errors.push({
          field: field.name,
          message: 'Please enter a valid email address'
        });
      }
    });
    
    return errors;
  }
  
  function validateField(field) {
    const parent = field.closest('.form-group');
    if (!parent) return;
    
    // Remove existing error
    const existingError = parent.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    field.classList.remove('error');
    
    // Check required
    if (field.hasAttribute('required') && !field.value.trim()) {
      showFieldError(field, `${field.getAttribute('data-label') || field.name} is required`);
      return false;
    }
    
    // Check email
    if (field.type === 'email' && field.value && !isValidEmail(field.value)) {
      showFieldError(field, 'Please enter a valid email address');
      return false;
    }
    
    return true;
  }
  
  function showFieldError(field, message) {
    field.classList.add('error');
    
    const error = document.createElement('div');
    error.className = 'field-error';
    error.textContent = message;
    
    const parent = field.closest('.form-group');
    if (parent) {
      parent.appendChild(error);
    }
  }
  
  function displayFormErrors(form, errors) {
    // Clear existing errors
    form.querySelectorAll('.field-error').forEach(error => error.remove());
    form.querySelectorAll('.error').forEach(field => field.classList.remove('error'));
    
    // Display new errors
    errors.forEach(error => {
      const field = form.elements[error.field];
      if (field) {
        showFieldError(field, error.message);
      }
    });
    
    // Scroll to first error
    const firstError = form.querySelector('.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError.focus();
    }
  }
  
  function initializeFileUpload(upload) {
    const input = upload.querySelector('input[type="file"]');
    const dropZone = upload.querySelector('.file-drop-zone') || upload;
    
    // Drag and drop
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', function() {
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      handleFiles(files, upload);
    });
    
    // File input change
    input.addEventListener('change', function() {
      handleFiles(this.files, upload);
    });
  }
  
  function handleFiles(files, upload) {
    const preview = upload.querySelector('.file-preview') || createFilePreview(upload);
    preview.innerHTML = '';
    
    Array.from(files).forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-preview-item';
      item.innerHTML = `
        <span class="file-icon">📄</span>
        <span class="file-name">${file.name}</span>
        <span class="file-size">${formatFileSize(file.size)}</span>
        <button class="file-remove" data-file="${file.name}">&times;</button>
      `;
      
      preview.appendChild(item);
    });
  }
  
  function createFilePreview(upload) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    upload.appendChild(preview);
    return preview;
  }

  // Table Enhancements
  function initializeTables() {
    document.querySelectorAll('.dashboard-table').forEach(table => {
      // Sortable columns
      table.querySelectorAll('th[data-sortable]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => sortTable(table, th));
      });
      
      // Row selection
      if (table.classList.contains('selectable')) {
        initializeRowSelection(table);
      }
      
      // Responsive tables
      makeTableResponsive(table);
    });
  }
  
  function sortTable(table, th) {
    const column = Array.from(th.parentElement.children).indexOf(th);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = th.classList.contains('sort-asc');
    
    rows.sort((a, b) => {
      const aValue = a.children[column].textContent.trim();
      const bValue = b.children[column].textContent.trim();
      
      if (!isNaN(aValue) && !isNaN(bValue)) {
        return isAscending ? bValue - aValue : aValue - bValue;
      }
      
      return isAscending ? 
        bValue.localeCompare(aValue) : 
        aValue.localeCompare(bValue);
    });
    
    // Update sort indicators
    table.querySelectorAll('th').forEach(header => {
      header.classList.remove('sort-asc', 'sort-desc');
    });
    
    th.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
    
    // Re-append rows
    rows.forEach(row => tbody.appendChild(row));
  }
  
  function initializeRowSelection(table) {
    const checkAll = table.querySelector('.check-all');
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    
    if (checkAll) {
      checkAll.addEventListener('change', function() {
        checkboxes.forEach(cb => {
          cb.checked = this.checked;
          cb.closest('tr').classList.toggle('selected', this.checked);
        });
        updateBulkActions(table);
      });
    }
    
    checkboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        this.closest('tr').classList.toggle('selected', this.checked);
        
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        const someChecked = Array.from(checkboxes).some(c => c.checked);
        
        if (checkAll) {
          checkAll.checked = allChecked;
          checkAll.indeterminate = !allChecked && someChecked;
        }
        
        updateBulkActions(table);
      });
    });
  }
  
  function updateBulkActions(table) {
    const selected = table.querySelectorAll('tbody tr.selected').length;
    const bulkActions = document.querySelector('.bulk-actions');
    
    if (bulkActions) {
      if (selected > 0) {
        bulkActions.classList.add('active');
        bulkActions.querySelector('.selected-count').textContent = `${selected} selected`;
      } else {
        bulkActions.classList.remove('active');
      }
    }
  }
  
  function makeTableResponsive(table) {
    if (window.innerWidth <= 768) {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
      
      table.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((td, index) => {
          td.setAttribute('data-label', headers[index]);
        });
      });
    }
  }

  // Charts Initialization
  function initializeCharts() {
    // Initialize ApexCharts if available
    if (typeof ApexCharts !== 'undefined') {
      initializeApexCharts();
    }
    
    // Initialize Chart.js if available
    if (typeof Chart !== 'undefined') {
      initializeChartJS();
    }
  }
  
  function initializeApexCharts() {
    // Traffic Chart
    const trafficElement = document.querySelector('#trafficChart');
    if (trafficElement && !trafficElement.hasAttribute('data-initialized')) {
      const trafficChart = new ApexCharts(trafficElement, getTrafficChartOptions());
      trafficChart.render();
      trafficElement.setAttribute('data-initialized', 'true');
    }
    
    // Queue Distribution Chart
    const queueElement = document.querySelector('#queueChart');
    if (queueElement && !queueElement.hasAttribute('data-initialized')) {
      const queueChart = new ApexCharts(queueElement, getQueueChartOptions());
      queueChart.render();
      queueElement.setAttribute('data-initialized', 'true');
    }
  }
  
  function getTrafficChartOptions() {
    return {
      series: [{
        name: 'Customers',
        data: generateRandomData(7, 400, 800)
      }, {
        name: 'Queue Entries',
        data: generateRandomData(7, 300, 600)
      }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        fontFamily: 'Open Sans, sans-serif',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      colors: [config.colors.primary, config.colors.success],
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      fill: {
        type: 'gradient',
        gradient: {
          opacityFrom: 0.4,
          opacityTo: 0.1
        }
      },
      xaxis: {
        categories: getLast7Days(),
        labels: {
          style: { colors: '#595959' }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#595959' }
        }
      },
      legend: {
        position: 'bottom',
        horizontalAlign: 'center'
      },
      tooltip: {
        theme: 'light',
        x: { show: true },
        y: {
          formatter: function(val) {
            return val.toLocaleString();
          }
        }
      }
    };
  }
  
  function getQueueChartOptions() {
    return {
      series: [30, 25, 35, 10],
      chart: {
        type: 'donut',
        height: 300,
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      labels: ['Active', 'Waiting', 'Completed', 'Cancelled'],
      colors: [config.colors.primary, config.colors.warning, config.colors.success, config.colors.error],
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                formatter: function(w) {
                  return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                }
              }
            }
          }
        }
      },
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        horizontalAlign: 'center'
      },
      tooltip: {
        y: {
          formatter: function(val) {
            return val + '%';
          }
        }
      }
    };
  }

  // Animations
  function initializeAnimations() {
    // Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          
          // Animate numbers
          if (entry.target.classList.contains('stats-value')) {
            animateNumber(entry.target);
          }
        }
      });
    }, observerOptions);
    
    // Observe elements
    document.querySelectorAll('.dashboard-animate').forEach(el => {
      observer.observe(el);
    });
    
    // Page transitions
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      link.addEventListener('click', function(e) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const href = this.getAttribute('href');
          
          document.body.classList.add('page-exit');
          setTimeout(() => {
            window.location.href = href;
          }, 200);
        }
      });
    });
  }
  
  function animateNumber(element) {
    const finalValue = parseInt(element.textContent);
    const duration = 1000;
    const steps = 30;
    const stepValue = finalValue / steps;
    let currentValue = 0;
    let step = 0;
    
    const timer = setInterval(() => {
      currentValue += stepValue;
      step++;
      
      if (step >= steps) {
        element.textContent = finalValue.toLocaleString();
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(currentValue).toLocaleString();
      }
    }, duration / steps);
  }

  // Modals
  function initializeModals() {
    // Open modal triggers
    document.querySelectorAll('[data-modal]').forEach(trigger => {
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        const modalId = this.getAttribute('data-modal');
        openModal(modalId);
      });
    });
    
    // Close modal triggers
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(trigger => {
      trigger.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) closeModal(modal.id);
      });
    });
    
    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) {
        if (e.target === this) {
          closeModal(this.id);
        }
      });
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) closeModal(activeModal.id);
      }
    });
  }
  
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    
    // Focus first input
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }
  
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }

  // Real-time Updates
  function initializeRealTimeUpdates() {
    // Update dashboard metrics every 30 seconds
    setInterval(updateDashboardMetrics, 30000);
    
    // Update activity feed every minute
    setInterval(updateActivityFeed, 60000);
    
    // Check system health every 5 minutes
    setInterval(checkSystemHealth, 300000);
  }
  
  function updateDashboardMetrics() {
    fetch('/backoffice/api/metrics')
      .then(response => response.json())
      .then(data => {
        updateMetricCards(data);
        updateCharts(data);
      })
      .catch(error => console.error('Failed to update metrics:', error));
  }
  
  function updateMetricCards(data) {
    Object.keys(data).forEach(key => {
      const card = document.querySelector(`[data-metric="${key}"]`);
      if (card) {
        const valueElement = card.querySelector('.stats-value');
        const trendElement = card.querySelector('.stats-trend');
        
        if (valueElement && data[key].value !== undefined) {
          animateNumberChange(valueElement, data[key].value);
        }
        
        if (trendElement && data[key].trend !== undefined) {
          updateTrend(trendElement, data[key].trend);
        }
      }
    });
  }
  
  function animateNumberChange(element, newValue) {
    const oldValue = parseInt(element.textContent.replace(/,/g, ''));
    const difference = newValue - oldValue;
    
    if (difference === 0) return;
    
    const duration = 500;
    const steps = 20;
    const stepValue = difference / steps;
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      const currentValue = oldValue + (stepValue * currentStep);
      
      if (currentStep >= steps) {
        element.textContent = newValue.toLocaleString();
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(currentValue).toLocaleString();
      }
    }, duration / steps);
  }
  
  function updateTrend(element, trend) {
    element.className = 'stats-trend';
    
    if (trend > 0) {
      element.classList.add('trend-positive');
      element.innerHTML = `<span>↑ ${Math.abs(trend)}%</span>`;
    } else if (trend < 0) {
      element.classList.add('trend-negative');
      element.innerHTML = `<span>↓ ${Math.abs(trend)}%</span>`;
    } else {
      element.classList.add('trend-neutral');
      element.innerHTML = `<span>→ No change</span>`;
    }
  }
  
  function updateActivityFeed() {
    fetch('/backoffice/api/activity')
      .then(response => response.json())
      .then(activities => {
        const feed = document.querySelector('.activity-feed');
        if (feed && activities.length > 0) {
          const newItems = activities.map(activity => createActivityItem(activity));
          
          // Add new items with animation
          newItems.forEach((item, index) => {
            setTimeout(() => {
              feed.insertBefore(item, feed.firstChild);
              item.classList.add('activity-new');
              
              // Remove oldest items if too many
              const items = feed.querySelectorAll('.activity-item');
              if (items.length > 10) {
                items[items.length - 1].remove();
              }
            }, index * 100);
          });
        }
      })
      .catch(error => console.error('Failed to update activity feed:', error));
  }
  
  function createActivityItem(activity) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="activity-indicator"></div>
      <div class="activity-content">
        <div class="activity-action">${activity.action}</div>
        <div class="activity-details">${activity.details}</div>
        <div class="activity-time">${formatTime(activity.timestamp)}</div>
      </div>
    `;
    return item;
  }
  
  function checkSystemHealth() {
    fetch('/backoffice/api/health')
      .then(response => response.json())
      .then(health => {
        updateSystemHealth(health);
        
        if (health.status !== 'healthy') {
          showToast(`System Health: ${health.status}`, 'warning');
        }
      })
      .catch(error => console.error('Failed to check system health:', error));
  }
  
  function updateSystemHealth(health) {
    const healthCard = document.querySelector('.stats-card.health');
    if (!healthCard) return;
    
    const icon = healthCard.querySelector('.stats-icon');
    const value = healthCard.querySelector('.stats-value');
    const trend = healthCard.querySelector('.stats-trend');
    
    if (icon) {
      icon.textContent = health.status === 'healthy' ? '✓' : '⚠️';
    }
    
    if (value) {
      animateNumberChange(value, health.score);
    }
    
    if (trend) {
      trend.className = 'stats-trend';
      trend.classList.add(health.status === 'healthy' ? 'trend-positive' : 'trend-negative');
      trend.innerHTML = `<span>${health.status === 'healthy' ? '↑' : '↓'} ${health.message}</span>`;
    }
  }

  // Toast Notifications
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.querySelector('.toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${getToastIcon(type)}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });
    
    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      dismissToast(toast);
    }, duration);
    
    // Manual dismiss
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(dismissTimer);
      dismissToast(toast);
    });
  }
  
  function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }
  
  function dismissToast(toast) {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    
    setTimeout(() => {
      toast.remove();
      
      // Remove container if empty
      const container = document.querySelector('.toast-container');
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }
  
  function getToastIcon(type) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  // Utility Functions
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  function generateRandomData(count, min, max) {
    return Array.from({ length: count }, () => 
      Math.floor(Math.random() * (max - min + 1)) + min
    );
  }
  
  function getLast7Days() {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    return days;
  }

  // Export functions for external use
  window.StoreHubBackOffice = {
    showToast,
    openModal,
    closeModal,
    showFieldError,
    animateNumber,
    updateDashboardMetrics
  };

})();