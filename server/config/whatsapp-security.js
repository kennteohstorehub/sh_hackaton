/**
 * WhatsApp Security Configuration
 * 
 * This file contains security settings for WhatsApp message sending.
 * It prevents accidental messages to random numbers during testing.
 */

// SECURITY: Strict phone number whitelist for testing
// Only these numbers are allowed to receive WhatsApp messages
const ALLOWED_PHONE_NUMBERS = [
  '60126368832',    // Your primary number
  '+60126368832',   // Your primary number with + prefix
  '126368832',      // Your number without country code
  
  // Add more of your numbers here if needed:
  // '60123456789',  // Example: Add another number if you have multiple
  // '+60987654321', // Example: Another number with + prefix
];

// Environment-based configuration
// DEMO MODE: Temporarily disable whitelist for demo purposes
const ENFORCE_WHITELIST = false; // Set to true to re-enable security
// const ENFORCE_WHITELIST = process.env.NODE_ENV !== 'production' || 
//                          process.env.WHATSAPP_ENFORCE_WHITELIST === 'true';

// Load additional numbers from environment variable if provided
if (process.env.WHATSAPP_ALLOWED_NUMBERS) {
  const envNumbers = process.env.WHATSAPP_ALLOWED_NUMBERS.split(',').map(n => n.trim());
  ALLOWED_PHONE_NUMBERS.push(...envNumbers);
}

module.exports = {
  ALLOWED_PHONE_NUMBERS,
  ENFORCE_WHITELIST,
  
  /**
   * Check if a phone number is allowed to receive messages
   * @param {string} phoneNumber - The phone number to check
   * @returns {boolean} - True if allowed, false if blocked
   */
  isPhoneNumberAllowed(phoneNumber) {
    if (!ENFORCE_WHITELIST) {
      return true; // Allow all numbers in production
    }

    // Clean the phone number for comparison
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Check against all allowed formats
    return ALLOWED_PHONE_NUMBERS.some(allowedNumber => {
      const cleanAllowed = allowedNumber.replace(/\D/g, '');
      return cleanNumber === cleanAllowed || 
             cleanNumber.endsWith(cleanAllowed) || 
             cleanAllowed.endsWith(cleanNumber);
    });
  },

  /**
   * Add a phone number to the whitelist
   * @param {string} phoneNumber - Phone number to add
   * @returns {boolean} - True if added successfully
   */
  addToWhitelist(phoneNumber) {
    if (!ENFORCE_WHITELIST) {
      return false;
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (!ALLOWED_PHONE_NUMBERS.includes(phoneNumber) && 
        !ALLOWED_PHONE_NUMBERS.includes(cleanNumber)) {
      ALLOWED_PHONE_NUMBERS.push(phoneNumber);
      return true;
    }
    
    return false;
  },

  /**
   * Get current whitelist information
   * @returns {object} - Whitelist configuration
   */
  getWhitelistInfo() {
    return {
      enforced: ENFORCE_WHITELIST,
      allowedNumbers: [...ALLOWED_PHONE_NUMBERS],
      count: ALLOWED_PHONE_NUMBERS.length,
      environment: process.env.NODE_ENV || 'development'
    };
  }
}; 