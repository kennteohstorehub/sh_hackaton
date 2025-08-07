// Fallback sound generation using Web Audio API
window.playNotificationSound = function() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.log('Could not play notification sound:', e);
    }
};

window.playTableReadySound = function() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime + (index * 0.1);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.2);
            gainNode.gain.linearRampToValueAtTime(0, startTime + 0.5);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.5);
        });
    } catch (e) {
        console.log('Could not play table ready sound:', e);
    }
};