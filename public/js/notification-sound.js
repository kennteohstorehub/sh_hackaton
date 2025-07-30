/**
 * Notification Sound Manager
 * Handles playing notification sounds with progressive volume and repeat patterns
 */

class NotificationSoundManager {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.currentVolume = 0.3; // Start at 30% volume
    this.maxVolume = 0.8;     // Max 80% volume
    this.repeatCount = 0;
    this.maxRepeats = 5;      // Stop after 5 repeats if not acknowledged
    this.intervalId = null;
  }

  /**
   * Initialize audio context (required for web audio API)
   */
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /**
   * Play a pleasant notification chime
   */
  async playNotificationSound() {
    // Initialize on first use
    this.init();
    
    if (this.isPlaying) {
      console.log('[SOUND] Already playing notification sound');
      return;
    }
    
    this.isPlaying = true;
    this.repeatCount = 0;
    this.currentVolume = 0.3;
    
    // Play the sound pattern with repeats
    this.intervalId = setInterval(async () => {
      if (this.repeatCount >= this.maxRepeats || !this.isPlaying) {
        this.stop();
        return;
      }
      
      await this.playChimeSequence();
      this.repeatCount++;
      
      // Gradually increase volume with each repeat
      this.currentVolume = Math.min(this.maxVolume, this.currentVolume + 0.1);
      
    }, 3000); // Repeat every 3 seconds
    
    // Play first chime immediately
    await this.playChimeSequence();
    this.repeatCount++;
  }

  /**
   * Play a 3-note ascending chime sequence
   */
  async playChimeSequence() {
    const notes = [
      { frequency: 523.25, duration: 150 }, // C5
      { frequency: 659.25, duration: 150 }, // E5
      { frequency: 783.99, duration: 200 }  // G5
    ];
    
    for (const note of notes) {
      await this.playTone(note.frequency, note.duration);
      await this.wait(50); // Small gap between notes
    }
  }

  /**
   * Play a single tone
   */
  playTone(frequency, duration) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // Use sine wave for pleasant sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    // Connect oscillator -> gain -> destination
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Set volume with fade in/out for smooth sound
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.currentVolume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / 1000);
    
    // Play the tone
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
    
    return new Promise(resolve => {
      setTimeout(resolve, duration);
    });
  }

  /**
   * Play a success sound when customer acknowledges
   */
  async playAcknowledgmentSound() {
    this.init();
    
    // Stop any playing notification sounds
    this.stop();
    
    // Play a pleasant two-note success sound
    await this.playTone(659.25, 100); // E5
    await this.wait(50);
    await this.playTone(880.00, 150); // A5
  }

  /**
   * Stop playing notification sounds
   */
  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.repeatCount = 0;
    this.currentVolume = 0.3; // Reset volume
  }

  /**
   * Helper to wait for specified milliseconds
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test the notification sound
   */
  async test() {
    console.log('[SOUND] Testing notification sound...');
    await this.playNotificationSound();
    
    // Auto-stop after 5 seconds for testing
    setTimeout(() => {
      this.stop();
      console.log('[SOUND] Test completed');
    }, 5000);
  }
}

// Create global instance
window.notificationSoundManager = new NotificationSoundManager();