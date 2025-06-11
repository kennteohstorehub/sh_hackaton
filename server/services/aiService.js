const natural = require('natural');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', 
      natural.PorterStemmer, 'afinn');
    this.tokenizer = new natural.WordTokenizer();
    this.isReady = false;
  }

  async initialize() {
    try {
      logger.info('AI service initialized');
      this.isReady = true;
    } catch (error) {
      logger.error('AI service initialization error:', error);
    }
  }

  // Predict wait time based on queue length and historical data
  predictWaitTime(queueLength, averageServiceTime, historicalData = []) {
    try {
      // Simple calculation for now (can be enhanced later)
      const baseTime = queueLength * averageServiceTime;
      const peakHourMultiplier = this.getPeakHourMultiplier();
      return Math.round(baseTime * peakHourMultiplier);
    } catch (error) {
      logger.error('Error predicting wait time:', error);
      return queueLength * averageServiceTime;
    }
  }

  // Analyze sentiment of customer messages
  analyzeSentiment(text) {
    try {
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const score = this.sentimentAnalyzer.getSentiment(tokens);
      
      let sentiment = 'neutral';
      if (score > 0.1) sentiment = 'positive';
      else if (score < -0.1) sentiment = 'negative';
      
      return {
        score: Math.max(-1, Math.min(1, score)), // Normalize to -1 to 1
        sentiment,
        confidence: Math.abs(score)
      };
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      return { score: 0, sentiment: 'neutral', confidence: 0 };
    }
  }

  // Generate dynamic chatbot responses based on context
  generateResponse(intent, context = {}) {
    const responses = {
      greeting: [
        `Hello! Welcome to ${context.businessName || 'our business'}. How can I help you today?`,
        `Hi there! Ready to join our queue? I'm here to help make your wait easier.`,
        `Welcome! I can help you join a queue, check your status, or answer questions.`
      ],
      queue_full: [
        `I'm sorry, but our queue is currently full. Would you like me to notify you when a spot opens up?`,
        `Our queue has reached capacity. I can add you to a waitlist if you'd like.`,
        `We're at full capacity right now. Can I help you with anything else while you wait?`
      ],
      wait_time_long: [
        `I know the wait seems long, but we're working hard to serve everyone efficiently. Your patience is appreciated!`,
        `Thanks for your patience! While you wait, feel free to ask me any questions about our services.`,
        `The wait time is a bit longer than usual today. Would you like me to send you updates on your position?`
      ],
      position_update: [
        `You're now #{position} in line! Estimated wait time: #{waitTime} minutes.`,
        `Good news! You've moved up to position #{position}. About #{waitTime} minutes to go.`,
        `Update: You're #{position} in the queue. We'll have you served in approximately #{waitTime} minutes.`
      ]
    };

    const templates = responses[intent] || responses.greeting;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace placeholders with context values
    return template.replace(/#{(\w+)}/g, (match, key) => context[key] || match);
  }

  // Determine peak hour multiplier for wait time calculation
  getPeakHourMultiplier() {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Weekend multiplier
    if (day === 0 || day === 6) return 1.2;
    
    // Lunch hour (12-2 PM)
    if (hour >= 12 && hour <= 14) return 1.3;
    
    // Evening rush (5-7 PM)
    if (hour >= 17 && hour <= 19) return 1.4;
    
    // Morning rush (8-10 AM)
    if (hour >= 8 && hour <= 10) return 1.2;
    
    return 1.0;
  }

  // Smart notification timing
  calculateOptimalNotificationTime(customer, queue) {
    const baseNotificationTime = 5; // 5 minutes before
    const customerSentiment = customer.sentimentScore || 0;
    
    // Adjust based on sentiment
    if (customerSentiment < -0.3) {
      // Negative sentiment - notify earlier
      return baseNotificationTime + 2;
    } else if (customerSentiment > 0.3) {
      // Positive sentiment - can wait a bit longer
      return baseNotificationTime - 1;
    }
    
    return baseNotificationTime;
  }

  isServiceReady() {
    return this.isReady;
  }
}

module.exports = new AIService(); 