const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');

class TelegramService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.warn('Telegram bot token not provided, skipping initialization');
      return;
    }

    try {
      // Use webhook mode for production (Render-friendly)
      if (process.env.NODE_ENV === 'production') {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        const webhookUrl = `${process.env.APP_URL}/api/telegram/webhook`;
        await this.bot.setWebHook(webhookUrl);
        logger.info('Telegram webhook set:', webhookUrl);
      } else {
        // Use polling for development
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        logger.info('Telegram bot initialized with polling');
      }

      this.setupCommands();
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
    }
  }

  setupCommands() {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🎯 Welcome to Queue Management Bot!

Commands:
/join <queue_code> - Join a queue
/status - Check your queue status
/cancel - Cancel your queue entry
/help - Show this help message

Example: /join ABC123
      `;
      this.bot.sendMessage(chatId, welcomeMessage);
    });

    // /join command
    this.bot.onText(/\/join (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const queueCode = match[1];
      
      try {
        // Find queue by code
        const queue = await prisma.queue.findFirst({
          where: { 
            joinCode: queueCode,
            isActive: true
          },
          include: { merchant: true }
        });

        if (!queue) {
          return this.bot.sendMessage(chatId, '❌ Invalid queue code');
        }

        // Check if already in queue
        const existingEntry = await prisma.queueEntry.findFirst({
          where: {
            queueId: queue.id,
            telegramChatId: String(chatId),
            status: { in: ['waiting', 'notified'] }
          }
        });

        if (existingEntry) {
          return this.bot.sendMessage(chatId, '⚠️ You are already in this queue!');
        }

        // Create queue entry
        const entry = await prisma.queueEntry.create({
          data: {
            queueId: queue.id,
            customerName: msg.from.first_name || 'Guest',
            customerPhone: '', // Not available via Telegram
            telegramChatId: String(chatId),
            telegramUsername: msg.from.username,
            partySize: 1,
            status: 'waiting',
            notificationChannel: 'telegram'
          }
        });

        const position = await this.getQueuePosition(queue.id, entry.id);
        
        this.bot.sendMessage(chatId, `
✅ Successfully joined queue!

📍 ${queue.merchant.name} - ${queue.name}
🎫 Your number: ${entry.displayNumber || entry.id}
👥 Position: ${position}
⏱️ Estimated wait: ${position * 5} minutes

I'll notify you when it's your turn!
        `);
      } catch (error) {
        logger.error('Error joining queue via Telegram:', error);
        this.bot.sendMessage(chatId, '❌ Failed to join queue. Please try again.');
      }
    });

    // /status command
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      
      try {
        const entries = await prisma.queueEntry.findMany({
          where: {
            telegramChatId: String(chatId),
            status: { in: ['waiting', 'notified'] }
          },
          include: {
            queue: {
              include: { merchant: true }
            }
          }
        });

        if (entries.length === 0) {
          return this.bot.sendMessage(chatId, '📋 You are not in any queues');
        }

        let statusMessage = '📋 Your Queue Status:\n\n';
        
        for (const entry of entries) {
          const position = await this.getQueuePosition(entry.queue.id, entry.id);
          statusMessage += `📍 ${entry.queue.merchant.name} - ${entry.queue.name}\n`;
          statusMessage += `🎫 Number: ${entry.displayNumber || entry.id}\n`;
          statusMessage += `👥 Position: ${position}\n`;
          statusMessage += `⏱️ Est. wait: ${position * 5} minutes\n\n`;
        }

        this.bot.sendMessage(chatId, statusMessage);
      } catch (error) {
        logger.error('Error checking status:', error);
        this.bot.sendMessage(chatId, '❌ Failed to check status');
      }
    });
  }

  async sendQueueNotification(entry, type) {
    if (!this.isInitialized || !entry.telegramChatId) return;

    try {
      let message;
      const merchantName = entry.queue?.merchant?.name || 'The merchant';

      switch (type) {
        case 'joined':
          message = `✅ You've joined the queue at ${merchantName}!\n🎫 Your number: ${entry.displayNumber || entry.id}`;
          break;
        
        case 'almost_ready':
          message = `⏰ Almost your turn at ${merchantName}!\n🎫 Number: ${entry.displayNumber || entry.id}\nPlease be ready in 5 minutes.`;
          break;
        
        case 'ready':
          message = `🎉 It's your turn at ${merchantName}!\n🎫 Number: ${entry.displayNumber || entry.id}\nPlease proceed to the counter now!`;
          break;
        
        case 'cancelled':
          message = `❌ Your queue entry at ${merchantName} has been cancelled.`;
          break;
        
        default:
          message = `Queue update from ${merchantName}: ${type}`;
      }

      await this.bot.sendMessage(entry.telegramChatId, message);
      logger.info(`Telegram notification sent to ${entry.telegramChatId}`);
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error);
    }
  }

  async getQueuePosition(queueId, entryId) {
    const waitingEntries = await prisma.queueEntry.findMany({
      where: {
        queueId,
        status: 'waiting',
        id: { lte: entryId }
      },
      orderBy: { createdAt: 'asc' }
    });

    return waitingEntries.length;
  }

  // Webhook handler for production
  async handleWebhook(update) {
    if (this.bot) {
      this.bot.processUpdate(update);
    }
  }
}

module.exports = new TelegramService();