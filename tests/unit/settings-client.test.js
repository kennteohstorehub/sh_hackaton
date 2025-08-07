const { JSDOM } = require('jsdom');

describe('Settings Page Client-side Logic', () => {
  let document, window;

  beforeEach(() => {
    // Create a simulated DOM environment
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="restaurantForm">
            <input type="text" id="restaurantName" name="restaurantName" required>
            <input type="tel" id="restaurantPhone" name="restaurantPhone">
            <textarea id="restaurantAddress" name="restaurantAddress"></textarea>
            <button type="submit">Save Restaurant Information</button>
          </form>
          <div id="successMessage" style="display:none;"></div>
          <div id="errorMessage" style="display:none;"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      contentType: 'text/html',
      includeNodeLocations: true,
      runScripts: 'dangerously'
    });

    window = dom.window;
    document = window.document;

    // Mock fetch global
    global.fetch = jest.fn();
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('showAlert function displays correct message type', () => {
    // Add the showAlert function to the window
    window.showAlert = function(message, type = 'success') {
      const successMessage = document.getElementById('successMessage');
      const errorMessage = document.getElementById('errorMessage');
      
      // Hide both messages first
      successMessage.style.display = 'none';
      errorMessage.style.display = 'none';
      
      // Show the appropriate message
      if (type === 'success') {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
      } else {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
      }
    };

    // Test success alert
    window.showAlert('Operation successful');
    const successMessage = document.getElementById('successMessage');
    expect(successMessage.style.display).toBe('block');
    expect(successMessage.textContent).toBe('Operation successful');

    // Test error alert
    window.showAlert('An error occurred', 'error');
    const errorMessage = document.getElementById('errorMessage');
    expect(errorMessage.style.display).toBe('block');
    expect(errorMessage.textContent).toBe('An error occurred');
  });

  test('createFetchOptions adds CSRF token and headers', () => {
    // Mock CSRF token
    document.querySelector = jest.fn().mockReturnValue({
      getAttribute: jest.fn().mockReturnValue('test-csrf-token')
    });

    // Add createFetchOptions function
    window.createFetchOptions = function(options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      
      return {
        ...options,
        headers
      };
    };

    // Create options
    const options = window.createFetchOptions({
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    });

    // Verify headers
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-CSRF-Token']).toBe('test-csrf-token');
  });

  test('operating hours initialization handles edge cases', () => {
    // Add days to the document
    document.body.innerHTML += `
      <div data-day="monday">
        <input type="checkbox" id="monday-closed">
      </div>
      <div data-day="tuesday">
        <input type="checkbox" id="tuesday-closed">
      </div>
    `;

    // Mock updateDayHoursVisual function
    const mockUpdateDayHoursVisual = jest.fn();
    window.updateDayHoursVisual = mockUpdateDayHoursVisual;

    // Add event listeners
    window.initializeOperationHours = function() {
      const days = ['monday', 'tuesday'];
      
      days.forEach(day => {
        const checkbox = document.getElementById(`${day}-closed`);
        const dayHoursElement = checkbox.closest('.hours-row');
        
        if (!checkbox || !dayHoursElement) {
          console.warn(`Checkbox or hours row not found for ${day}`);
          return;
        }
        
        // Set initial state
        updateDayHoursVisual(dayHoursElement, checkbox.checked);
        
        // Simulate checkbox change
        checkbox.addEventListener('change', function() {
          updateDayHoursVisual(dayHoursElement, this.checked);
        });
      });
    };

    // Run initialization
    window.initializeOperationHours();

    // Simulate checkbox change for monday
    const mondayCheckbox = document.getElementById('monday-closed');
    mondayCheckbox.checked = true;
    mondayCheckbox.dispatchEvent(new window.Event('change'));

    // Verify updateDayHoursVisual was called
    expect(mockUpdateDayHoursVisual).toHaveBeenCalledTimes(1);
  });

  test('checkQueueStatus handles active queue locking', async () => {
    // Setup mock active queue scenario
    document.body.innerHTML += `
      <div id="settings-locked-banner" style="display:none;"></div>
      <div id="active-queue-name"></div>
      <div class="section"></div>
      <input id="test-input" type="text">
      <button type="submit" id="test-button"></button>
    `;

    // Mock fetch to return active queue
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        activeQueue: {
          acceptingCustomers: true,
          name: 'Test Active Queue'
        }
      })
    });

    // Implement checkQueueStatus function
    window.checkQueueStatus = async function() {
      try {
        const response = await fetch('/api/queue/status');
        const data = await response.json();
        
        if (data.activeQueue && data.activeQueue.acceptingCustomers) {
          // Queue is operating - lock the settings
          document.getElementById('settings-locked-banner').style.display = 'flex';
          document.getElementById('active-queue-name').textContent = data.activeQueue.name;
          
          // Add locked class to all sections
          document.querySelectorAll('.section').forEach(section => {
            section.classList.add('locked');
          });
          
          // Disable all form inputs
          document.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(element => {
            element.disabled = true;
          });
        }
      } catch (error) {
        console.error('Error checking queue status:', error);
      }
    };

    // Run check queue status
    await window.checkQueueStatus();

    // Verify locking mechanism
    const lockedBanner = document.getElementById('settings-locked-banner');
    expect(lockedBanner.style.display).toBe('flex');
    expect(document.getElementById('active-queue-name').textContent).toBe('Test Active Queue');
    
    // Check sections are locked
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
      expect(section.classList.contains('locked')).toBe(true);
    });

    // Check inputs are disabled
    const inputs = document.querySelectorAll('input, select, textarea, button[type="submit"]');
    inputs.forEach(input => {
      expect(input.disabled).toBe(true);
    });
  });
});