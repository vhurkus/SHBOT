import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import logger from './logger.js';

class NotificationService {
    constructor() {
        this.bot = null;
        this.chatId = null;

        if (config.notifications.telegram.enabled) {
            const token = config.notifications.telegram.botToken;
            this.chatId = config.notifications.telegram.chatId;

            if (token && this.chatId) {
                try {
                    this.bot = new TelegramBot(token);
                    logger.info('✅ Telegram bildirim servisi aktif edildi.');
                } catch (error) {
                    logger.error('❌ Telegram botu başlatılamadı. Token veya Chat ID hatalı olabilir.', { error: error.message });
                    this.bot = null;
                }
            } else {
                logger.warn('⚠️  Telegram bildirimleri aktif ancak token veya chat ID eksik.');
            }
        }
    }

    /**
     * Sends an alert message via Telegram.
     * @param {string} message The message to send.
     */
    sendAlert(message) {
        if (!this.bot || !this.chatId) {
            return; // Do nothing if not configured
        }

        try {
            // Simple markdown cleanup
            const safeMessage = message.replace(/_/g, '\\_').replace(/\*/g, '\\*').replace(/`/g, '\\`');
            this.bot.sendMessage(this.chatId, safeMessage);
            logger.info(`📲 Telegram uyarısı gönderildi.`);
        } catch (error) {
            logger.error('❌ Telegram mesajı gönderme hatası.', { error: error.message });
        }
    }
}

// Export a singleton instance
const notificationService = new NotificationService();
export default notificationService;
